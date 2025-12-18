/**
 * NPP Adapter
 * 
 * Stateless adapter for the New Payments Platform (NPP).
 * 
 * CRITICAL INVARIANTS (from todo.md):
 * - MUST NOT mutate balances
 * - MUST NOT call Deposits Core directly
 * - MUST NOT advance payment state
 * - MUST NOT store state
 * - MUST NOT rely on ordering guarantees from NPP
 * - Emits PaymentFacts only
 * - Is stateless
 * - Is idempotent
 * - Survives retries, duplicates, and reordering
 */

import { nanoid } from "nanoid";
import type {
  NppCreditTransfer,
  NppPaymentStatusReport,
  NppPaymentReturn,
  NppCallback,
  NppAdapterConfig,
  NppTransactionStatus,
} from "./NppTypes";
import { DEFAULT_NPP_CONFIG } from "./NppTypes";
import { nppIdempotencyService } from "./NppIdempotency";
import {
  mapToNppCreditTransfer,
  mapFromNppStatusReport,
  mapFromNppPaymentReturn,
  mapCallbackToPaymentFact,
  validateNppCreditTransfer,
  type PaymentFactType,
} from "./NppMessageMapper";
import type { Payment } from "../../../server/core/payments/PaymentsSpine";
import { nppProductionClient } from "./NppProductionClient";

// ============================================
// NPP ADAPTER RESULT TYPES
// ============================================

export interface NppSubmissionResult {
  success: boolean;
  messageId?: string;
  endToEndId?: string;
  schemeReference?: string;
  error?: string;
  errorCode?: string;
}

export interface NppCallbackResult {
  processed: boolean;
  fact?: {
    factType: PaymentFactType;
    factData: Record<string, unknown>;
  };
  ignored?: boolean;
  ignoreReason?: string;
  error?: string;
}

// ============================================
// NPP ADAPTER
// ============================================

class NppAdapter {
  private config: NppAdapterConfig;
  
  constructor(config: NppAdapterConfig = DEFAULT_NPP_CONFIG) {
    this.config = config;
  }

  /**
   * Submit payment to NPP.
   * 
   * STATELESS: Does not store any state.
   * IDEMPOTENT: Same payment always produces same result.
   */
  async submitPayment(payment: Payment): Promise<NppSubmissionResult> {
    // Generate idempotency key
    const idempotencyKey = `${payment.instruction.idempotencyKey}:${payment.paymentId}`;
    
    // Check for duplicate submission
    const duplicateCheck = nppIdempotencyService.checkDuplicate(
      payment.paymentId,
      payment.instruction.endToEndId,
      payment
    );
    
    if (duplicateCheck.isDuplicate) {
      // Return cached result for duplicate
      const record = duplicateCheck.record!;
      
      if (duplicateCheck.payloadMismatch) {
        return {
          success: false,
          error: "Payload mismatch for duplicate submission",
          errorCode: "PAYLOAD_MISMATCH",
        };
      }
      
      if (record.status === "COMPLETED") {
        return record.result as NppSubmissionResult;
      }
      
      if (record.status === "FAILED") {
        return {
          success: false,
          error: record.error,
          errorCode: "PREVIOUS_FAILURE",
        };
      }
      
      // Still processing
      return {
        success: false,
        error: "Payment submission in progress",
        errorCode: "IN_PROGRESS",
      };
    }
    
    // Register new submission
    const idempotencyRecord = nppIdempotencyService.registerMessage(
      payment.paymentId,
      payment.instruction.endToEndId,
      payment
    );
    
    try {
      // Map to NPP message
      const nppMessage = mapToNppCreditTransfer(payment);
      
      // Validate message
      const validation = validateNppCreditTransfer(nppMessage);
      if (!validation.valid) {
        const error = `Validation failed: ${validation.errors.join(", ")}`;
        nppIdempotencyService.markFailed(idempotencyRecord.key, error);
        return {
          success: false,
          error,
          errorCode: "VALIDATION_FAILED",
        };
      }
      
      // Submit to NPP (simulated)
      const submissionResult = await this.sendToNpp(nppMessage);
      
      if (submissionResult.success) {
        const result: NppSubmissionResult = {
          success: true,
          messageId: nppMessage.messageId,
          endToEndId: nppMessage.paymentInformation.creditTransferTransaction.paymentId.endToEndId,
          schemeReference: submissionResult.schemeReference,
        };
        
        nppIdempotencyService.markComplete(idempotencyRecord.key, result);
        return result;
      } else {
        nppIdempotencyService.markFailed(idempotencyRecord.key, submissionResult.error || "Unknown error");
        return {
          success: false,
          error: submissionResult.error,
          errorCode: submissionResult.errorCode,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      nppIdempotencyService.markFailed(idempotencyRecord.key, errorMessage);
      return {
        success: false,
        error: errorMessage,
        errorCode: "EXCEPTION",
      };
    }
  }

  /**
   * Send message to NPP (simulated).
   * In production, this would make actual API calls.
   */
  private async sendToNpp(message: NppCreditTransfer): Promise<{
    success: boolean;
    schemeReference?: string;
    error?: string;
    errorCode?: string;
  }> {
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate success (95% success rate)
    if (Math.random() < 0.95) {
      return {
        success: true,
        schemeReference: `NPP-${Date.now()}-${nanoid(6)}`,
      };
    }
    
    // Simulate failure
    return {
      success: false,
      error: "NPP temporarily unavailable",
      errorCode: "NPP_UNAVAILABLE",
    };
  }

  /**
   * Handle NPP callback (status report).
   * 
   * STATELESS: Does not store any state.
   * IDEMPOTENT: Same callback always produces same result.
   * EMITS FACTS ONLY: Only produces PaymentFacts.
   */
  async handleStatusCallback(statusReport: NppPaymentStatusReport): Promise<NppCallbackResult> {
    // Map to internal callback format
    const callback = mapFromNppStatusReport(statusReport);
    
    // Process with idempotency
    const idempotencyResult = nppIdempotencyService.processCallback(callback);
    
    if (!idempotencyResult.shouldProcess) {
      return {
        processed: false,
        ignored: true,
        ignoreReason: idempotencyResult.reason,
      };
    }
    
    // Map to payment fact
    const fact = mapCallbackToPaymentFact(callback);
    
    // Mark callback as processed
    nppIdempotencyService.markCallbackProcessed(callback.callbackId, callback.originalMessageId);
    
    return {
      processed: true,
      fact: fact || undefined,
    };
  }

  /**
   * Handle NPP payment return.
   * 
   * STATELESS: Does not store any state.
   * IDEMPOTENT: Same return always produces same result.
   * EMITS FACTS ONLY: Only produces PaymentFacts.
   */
  async handleReturnCallback(returnMsg: NppPaymentReturn): Promise<NppCallbackResult> {
    // Map to internal callback format
    const callback = mapFromNppPaymentReturn(returnMsg);
    
    // Process with idempotency
    const idempotencyResult = nppIdempotencyService.processCallback(callback);
    
    if (!idempotencyResult.shouldProcess) {
      return {
        processed: false,
        ignored: true,
        ignoreReason: idempotencyResult.reason,
      };
    }
    
    // Map to payment fact (always PAYMENT_FAILED for returns)
    const fact = mapCallbackToPaymentFact(callback);
    
    // Mark callback as processed
    nppIdempotencyService.markCallbackProcessed(callback.callbackId, callback.originalMessageId);
    
    return {
      processed: true,
      fact: fact || undefined,
    };
  }

  /**
   * Get adapter statistics.
   */
  getStatistics(): {
    idempotency: ReturnType<typeof nppIdempotencyService.getStatistics>;
    config: {
      endpoint: string;
      participantBic: string;
      oskoEnabled: boolean;
      payIdEnabled: boolean;
    };
  } {
    return {
      idempotency: nppIdempotencyService.getStatistics(),
      config: {
        endpoint: this.config.endpoint,
        participantBic: this.config.participantBic,
        oskoEnabled: this.config.oskoEnabled,
        payIdEnabled: this.config.payIdEnabled,
      },
    };
  }

  /**
   * Health check.
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    latencyMs?: number;
    error?: string;
  }> {
    const start = Date.now();
    
    try {
      // Simulate health check call
      await new Promise(resolve => setTimeout(resolve, 50));
      
      return {
        healthy: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Export singleton instance
export const nppAdapter = new NppAdapter();
export default nppAdapter;

// Export class for testing with custom config
export { NppAdapter };
