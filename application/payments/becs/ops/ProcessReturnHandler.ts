/**
 * BECS Manual Return Processing Handler
 * 
 * Operator action: Manually process a late return for a cleared BECS payment
 * 
 * RULES:
 * - Can only process return from CLEARED state
 * - Requires policy approval (ops action must be authorized)
 * - Return amount must match cleared amount
 * - Records return reason and code
 * - Reverses funds exactly
 * 
 * Usage:
 * ```typescript
 * const result = await processReturn({
 *   paymentIntentId: "pay_001",
 *   operatorId: "op_123",
 *   returnCode: "01", // BECS return code
 *   returnReason: "Insufficient funds",
 *   policyApproval: true,
 * });
 * ```
 */

import { BECSPayment, applyBECSEvent, BECSPaymentState, BECSReturnCode } from "../../../../core/payments/becs";
import type { BECSPaymentEvent } from "../../../../core/payments/becs";

/**
 * Process Return Request
 */
export interface ProcessReturnRequest {
  readonly paymentIntentId: string;
  readonly operatorId: string;
  readonly returnCode: BECSReturnCode;
  readonly returnReason: string;
  readonly policyApproval: boolean;
}

/**
 * Process Return Result
 */
export interface ProcessReturnResult {
  readonly success: boolean;
  readonly eventsEmitted: BECSPaymentEvent[];
  readonly fundsReversed?: bigint;
  readonly error?: string;
}

/**
 * Manually process a late return for a cleared BECS payment
 * 
 * This is a policy-gated operator action that requires explicit approval.
 */
export async function processReturn(
  payment: BECSPayment,
  request: ProcessReturnRequest
): Promise<ProcessReturnResult> {
  // RULE: Policy approval required
  if (!request.policyApproval) {
    return {
      success: false,
      eventsEmitted: [],
      error: "POLICY_DENIED: Manual return processing requires policy approval",
    };
  }
  
  // RULE: Can only process return from CLEARED state
  if (payment.state !== BECSPaymentState.CLEARED) {
    return {
      success: false,
      eventsEmitted: [],
      error: `INVALID_STATE: Cannot process return from ${payment.state} (must be CLEARED)`,
    };
  }
  
  // RULE: Payment intent ID must match
  if (payment.paymentIntentId !== request.paymentIntentId) {
    return {
      success: false,
      eventsEmitted: [],
      error: `PAYMENT_MISMATCH: Payment ${payment.paymentIntentId} does not match request ${request.paymentIntentId}`,
    };
  }
  
  // RULE: Return amount must match cleared amount
  const fundsReversed = payment.amount;
  
  // Emit PaymentReturned event
  const returnedEvent: BECSPaymentEvent = {
    type: "PaymentReturned",
    paymentIntentId: payment.paymentIntentId,
    occurredAt: new Date(),
    batchId: payment.batchId!,
    returnCode: request.returnCode,
    returnDate: new Date().toISOString().split("T")[0],
    returnReason: request.returnReason,
    fundsReversed,
  };
  
  return {
    success: true,
    eventsEmitted: [returnedEvent],
    fundsReversed,
  };
}

/**
 * Validate process return request
 */
export function validateProcessReturnRequest(
  request: ProcessReturnRequest
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!request.paymentIntentId) {
    errors.push("paymentIntentId is required");
  }
  
  if (!request.operatorId) {
    errors.push("operatorId is required");
  }
  
  if (!request.returnCode) {
    errors.push("returnCode is required");
  }
  
  if (!request.returnReason || request.returnReason.trim().length === 0) {
    errors.push("returnReason is required");
  }
  
  if (!request.policyApproval) {
    errors.push("policyApproval is required");
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
