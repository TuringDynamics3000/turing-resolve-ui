/**
 * Cancel Payment Handler - Ops Action
 * 
 * RULE: Cancel only allowed from AUTHORISED state
 * RULE: Cannot cancel after sent to rail
 * RULE: Emits PaymentCancelled event (custom ops event)
 * RULE: Policy gate: requires ops approval
 */

import {
  NPPPaymentState,
  NPPFailureReason,
  NPPPaymentEventUnion,
  OpsViolationError,
} from "../../../../core/payments/npp";

export interface CancelPaymentInput {
  paymentIntentId: string;
  currentState: NPPPaymentState;
  operatorId: string;
  reason: string;
  policyApproval: boolean; // Policy gate
}

export interface CancelPaymentOutput {
  event: NPPPaymentEventUnion;
}

/**
 * Cancel an authorised payment before it's sent to rail
 * 
 * Transitions to FAILED state with CANCELLED reason
 */
export function cancelPayment(input: CancelPaymentInput): CancelPaymentOutput {
  // Policy gate: require approval
  if (!input.policyApproval) {
    throw new OpsViolationError("cancel requires policy approval");
  }

  // State gate: only AUTHORISED
  if (input.currentState !== NPPPaymentState.AUTHORISED) {
    throw new OpsViolationError(
      `cancel only allowed from AUTHORISED, current state: ${input.currentState}`
    );
  }

  // Emit PaymentFailed event with CANCELLED reason
  const event: NPPPaymentEventUnion = {
    type: "PaymentFailed",
    paymentIntentId: input.paymentIntentId,
    occurredAt: new Date(),
    reason: NPPFailureReason.CANCELLED,
    fundsReleased: 0n, // Will be filled by handler
    data: {
      operatorId: input.operatorId,
      cancelReason: input.reason,
    },
  };

  return {
    event,
  };
}
