/**
 * NPP Scheme Adapter
 * 
 * Wraps the NPP Adapter to implement the SchemeAdapter interface.
 * Connects the NPP adapter to the Payments Spine.
 */

import type { SchemeAdapter, SchemeSubmissionResult, SchemeCallbackResult, SchemeHealthCheck } from "../SchemeAdapterInterface";
import type { Payment, PaymentScheme } from "../PaymentsSpine";
import { nppAdapter } from "../../../../adapters/payments/npp/NppAdapter";
import type { NppPaymentStatusReport, NppPaymentReturn, NppCallback } from "../../../../adapters/payments/npp/NppTypes";
import { mapNppStatusToInternal } from "../../../../adapters/payments/npp/NppMessageMapper";

// ============================================
// NPP SCHEME ADAPTER
// ============================================

class NppSchemeAdapter implements SchemeAdapter {
  readonly scheme: PaymentScheme = "NPP";

  /**
   * Submit payment to NPP.
   */
  async submit(payment: Payment): Promise<SchemeSubmissionResult> {
    const result = await nppAdapter.submitPayment(payment);
    
    return {
      success: result.success,
      messageId: result.messageId,
      schemeReference: result.schemeReference,
      error: result.error,
      errorCode: result.errorCode,
    };
  }

  /**
   * Handle NPP callback.
   * Accepts either NppPaymentStatusReport or NppPaymentReturn.
   */
  async handleCallback(callbackData: unknown): Promise<SchemeCallbackResult> {
    // Determine callback type
    const data = callbackData as Record<string, unknown>;
    
    if (this.isStatusReport(data)) {
      return this.handleStatusReport(data as unknown as NppPaymentStatusReport);
    }
    
    if (this.isPaymentReturn(data)) {
      return this.handlePaymentReturn(data as unknown as NppPaymentReturn);
    }
    
    return {
      processed: false,
      error: "Unknown callback type",
    };
  }

  /**
   * Check if callback is a status report.
   */
  private isStatusReport(data: Record<string, unknown>): boolean {
    return "transactionStatus" in data && "originalMessageId" in data;
  }

  /**
   * Check if callback is a payment return.
   */
  private isPaymentReturn(data: Record<string, unknown>): boolean {
    return "returnReason" in data && "returnedAmount" in data;
  }

  /**
   * Handle status report callback.
   */
  private async handleStatusReport(report: NppPaymentStatusReport): Promise<SchemeCallbackResult> {
    const result = await nppAdapter.handleStatusCallback(report);
    
    if (!result.processed) {
      return {
        processed: false,
        ignored: result.ignored,
        ignoreReason: result.ignoreReason,
      };
    }
    
    const newStatus = mapNppStatusToInternal(report.transactionStatus);
    
    return {
      processed: true,
      newStatus,
      fact: result.fact,
    };
  }

  /**
   * Handle payment return callback.
   */
  private async handlePaymentReturn(returnMsg: NppPaymentReturn): Promise<SchemeCallbackResult> {
    const result = await nppAdapter.handleReturnCallback(returnMsg);
    
    if (!result.processed) {
      return {
        processed: false,
        ignored: result.ignored,
        ignoreReason: result.ignoreReason,
      };
    }
    
    return {
      processed: true,
      newStatus: "FAILED",
      fact: result.fact,
    };
  }

  /**
   * Health check NPP connection.
   */
  async healthCheck(): Promise<SchemeHealthCheck> {
    return nppAdapter.healthCheck();
  }

  /**
   * Get NPP adapter statistics.
   */
  getStatistics(): Record<string, unknown> {
    return nppAdapter.getStatistics();
  }
}

export const nppSchemeAdapter = new NppSchemeAdapter();
export default nppSchemeAdapter;
