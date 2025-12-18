/**
 * BECS Scheme Adapter
 * 
 * Wraps the BECS Adapter to implement the SchemeAdapter interface.
 * Connects the BECS adapter to the Payments Spine.
 */

import type { SchemeAdapter, SchemeSubmissionResult, SchemeCallbackResult, SchemeHealthCheck } from "../SchemeAdapterInterface";
import type { Payment, PaymentScheme } from "../PaymentsSpine";
import { becsAdapter } from "../../../../adapters/payments/becs/BecsAdapter";
import type { BecsCallback } from "../../../../adapters/payments/becs/BecsTypes";

// ============================================
// BECS SCHEME ADAPTER
// ============================================

class BecsSchemeAdapter implements SchemeAdapter {
  readonly scheme: PaymentScheme = "BECS";

  /**
   * Submit payment to BECS.
   * Creates a batch and submits it.
   */
  async submit(payment: Payment): Promise<SchemeSubmissionResult> {
    const result = await becsAdapter.submitPayment(payment);
    
    return {
      success: result.success,
      schemeReference: result.schemeReference,
      error: result.error,
    };
  }

  /**
   * Handle BECS callback.
   */
  async handleCallback(callbackData: unknown): Promise<SchemeCallbackResult> {
    const callback = callbackData as BecsCallback;
    
    const result = await becsAdapter.handleCallback(callback);
    
    if (!result.processed) {
      return {
        processed: false,
        error: result.error,
      };
    }
    
    // Map BECS status to internal status
    let newStatus: "PENDING" | "SETTLED" | "FAILED" | undefined;
    
    if (result.fact?.factType === "BATCH_SETTLED") {
      newStatus = "SETTLED";
    }
    
    return {
      processed: true,
      newStatus,
      fact: result.fact,
    };
  }

  /**
   * Health check BECS connection.
   */
  async healthCheck(): Promise<SchemeHealthCheck> {
    return becsAdapter.healthCheck();
  }

  /**
   * Get BECS adapter statistics.
   */
  getStatistics(): Record<string, unknown> {
    return becsAdapter.getStatistics();
  }

  /**
   * Add payment to batch (for batch processing).
   */
  async addToBatch(payment: Payment): Promise<{
    success: boolean;
    batchId?: string;
    transactionId?: string;
    error?: string;
  }> {
    return becsAdapter.addToBatch(payment);
  }

  /**
   * Finalize and submit a batch.
   */
  async finalizeBatch(batchId: string): Promise<{
    success: boolean;
    schemeReference?: string;
    abaFileContent?: string;
    error?: string;
  }> {
    return becsAdapter.finalizeBatch(batchId);
  }

  /**
   * Get batch by ID.
   */
  getBatch(batchId: string) {
    return becsAdapter.getBatch(batchId);
  }
}

export const becsSchemeAdapter = new BecsSchemeAdapter();
export default becsSchemeAdapter;
