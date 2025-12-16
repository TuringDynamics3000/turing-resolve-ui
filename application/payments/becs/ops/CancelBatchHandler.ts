/**
 * BECS Batch Cancellation Handler
 * 
 * Operator action: Cancel a batch before it's submitted or cleared
 * 
 * RULES:
 * - Can only cancel from BATCHED or SUBMITTED states
 * - Cannot cancel after CLEARED (use ProcessReturnHandler instead)
 * - Requires policy approval (ops action must be authorized)
 * - Releases all held funds
 * - Records cancellation reason
 * 
 * Usage:
 * ```typescript
 * const result = await cancelBatch({
 *   batchId: "batch_001",
 *   operatorId: "op_123",
 *   reason: "Duplicate batch detected",
 *   policyApproval: true,
 * });
 * ```
 */

import { BECSPayment, applyBECSEvent, BECSPaymentState, BECSFailureReason } from "../../../../core/payments/becs";
import type { BECSPaymentEvent } from "../../../../core/payments/becs";

/**
 * Cancel Batch Request
 */
export interface CancelBatchRequest {
  readonly batchId: string;
  readonly operatorId: string;
  readonly reason: string;
  readonly policyApproval: boolean;
}

/**
 * Cancel Batch Result
 */
export interface CancelBatchResult {
  readonly success: boolean;
  readonly eventsEmitted: BECSPaymentEvent[];
  readonly fundsReleased?: bigint;
  readonly error?: string;
}

/**
 * Cancel a BECS batch before clearing
 * 
 * This is a policy-gated operator action that requires explicit approval.
 */
export async function cancelBatch(
  payment: BECSPayment,
  request: CancelBatchRequest
): Promise<CancelBatchResult> {
  // RULE: Policy approval required
  if (!request.policyApproval) {
    return {
      success: false,
      eventsEmitted: [],
      error: "POLICY_DENIED: Batch cancellation requires policy approval",
    };
  }
  
  // RULE: Can only cancel from BATCHED or SUBMITTED states
  const allowedStates = [BECSPaymentState.BATCHED, BECSPaymentState.SUBMITTED];
  if (!allowedStates.includes(payment.state)) {
    return {
      success: false,
      eventsEmitted: [],
      error: `INVALID_STATE: Cannot cancel from ${payment.state} (must be BATCHED or SUBMITTED)`,
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
  
  // RULE: Cannot cancel after CLEARED
  if (payment.state === BECSPaymentState.CLEARED) {
    return {
      success: false,
      eventsEmitted: [],
      error: "INVALID_STATE: Cannot cancel cleared batch (use ProcessReturnHandler instead)",
    };
  }
  
  // Release all held funds
  const fundsReleased = payment.amount;
  
  // Emit PaymentFailed event with cancellation reason
  // Note: Additional details in request.reason are recorded in ops action audit trail
  const failedEvent: BECSPaymentEvent = {
    type: "PaymentFailed",
    paymentIntentId: payment.paymentIntentId,
    occurredAt: new Date(),
    batchId: payment.batchId!,
    reason: BECSFailureReason.CANCELLED,
    fundsReleased,
  };
  
  return {
    success: true,
    eventsEmitted: [failedEvent],
    fundsReleased,
  };
}

/**
 * Validate cancel batch request
 */
export function validateCancelBatchRequest(
  request: CancelBatchRequest
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
