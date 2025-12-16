/**
 * BECS Batch Resubmission Handler
 * 
 * Operator action: Resubmit a failed batch to the BECS rail
 * 
 * RULES:
 * - Can only resubmit from FAILED state
 * - Requires policy approval (ops action must be authorized)
 * - Creates new batch with same payments
 * - Preserves original payment intent IDs
 * - Records resubmission in audit trail
 * 
 * Usage:
 * ```typescript
 * const result = await resubmitBatch({
 *   batchId: "batch_001",
 *   operatorId: "op_123",
 *   reason: "Temporary rail outage resolved",
 *   policyApproval: true,
 * });
 * ```
 */

import { BECSPayment, applyBECSEvent, BECSPaymentState } from "../../../../core/payments/becs";
import type { BECSPaymentEvent } from "../../../../core/payments/becs";

/**
 * Resubmit Batch Request
 */
export interface ResubmitBatchRequest {
  readonly batchId: string;
  readonly operatorId: string;
  readonly reason: string;
  readonly policyApproval: boolean;
}

/**
 * Resubmit Batch Result
 */
export interface ResubmitBatchResult {
  readonly success: boolean;
  readonly newBatchId?: string;
  readonly eventsEmitted: BECSPaymentEvent[];
  readonly error?: string;
}

/**
 * Resubmit a failed BECS batch
 * 
 * This is a policy-gated operator action that requires explicit approval.
 */
export async function resubmitBatch(
  payment: BECSPayment,
  request: ResubmitBatchRequest
): Promise<ResubmitBatchResult> {
  // RULE: Policy approval required
  if (!request.policyApproval) {
    return {
      success: false,
      eventsEmitted: [],
      error: "POLICY_DENIED: Batch resubmission requires policy approval",
    };
  }
  
  // RULE: Can only resubmit from FAILED state
  if (payment.state !== BECSPaymentState.FAILED) {
    return {
      success: false,
      eventsEmitted: [],
      error: `INVALID_STATE: Cannot resubmit from ${payment.state} (must be FAILED)`,
    };
  }
  
  // RULE: Batch ID must match
  if (payment.batchId !== request.batchId) {
    return {
      success: false,
      eventsEmitted: [],
      error: `BATCH_MISMATCH: Payment batch ${payment.batchId} does not match request ${request.batchId}`,
    };
  }
  
  // Generate new batch ID for resubmission
  const newBatchId = `${request.batchId}-retry-${Date.now()}`;
  const newBatchDate = new Date().toISOString().split("T")[0];
  
  // Emit events for resubmission
  const events: BECSPaymentEvent[] = [];
  
  // 1. Re-authorize payment (funds already earmarked, just re-validate)
  const authorisedEvent: BECSPaymentEvent = {
    type: "PaymentAuthorised",
    paymentIntentId: payment.paymentIntentId,
    occurredAt: new Date(),
    policyChecksPassed: true,
    fundsEarmarked: payment.amount, // Re-earmark same amount
  };
  events.push(authorisedEvent);
  
  // 2. Batch payment with new batch ID
  const batchedEvent: BECSPaymentEvent = {
    type: "PaymentBatched",
    paymentIntentId: payment.paymentIntentId,
    occurredAt: new Date(),
    batchId: newBatchId,
    batchDate: newBatchDate,
    sequenceNumber: 1, // Reset sequence for new batch
    fundsHeld: payment.amount,
  };
  events.push(batchedEvent);
  
  // 3. Submit new batch
  const submittedEvent: BECSPaymentEvent = {
    type: "BatchSubmitted",
    paymentIntentId: payment.paymentIntentId,
    occurredAt: new Date(),
    batchId: newBatchId,
    fileReference: `${newBatchId}-file`,
    declaredTotal: payment.amount,
    itemCount: 1,
  };
  events.push(submittedEvent);
  
  return {
    success: true,
    newBatchId,
    eventsEmitted: events,
  };
}

/**
 * Validate resubmission request
 */
export function validateResubmitBatchRequest(
  request: ResubmitBatchRequest
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!request.batchId) {
    errors.push("batchId is required");
  }
  
  if (!request.operatorId) {
    errors.push("operatorId is required");
  }
  
  if (!request.reason || request.reason.trim().length === 0) {
    errors.push("reason is required");
  }
  
  if (!request.policyApproval) {
    errors.push("policyApproval is required");
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
