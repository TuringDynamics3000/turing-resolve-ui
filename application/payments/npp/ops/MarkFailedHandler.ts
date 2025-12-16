/**
 * Mark Failed Handler - Ops Action
 * 
 * RULE: Mark failed only from SENT or ACKNOWLEDGED states
 * RULE: Used when rail doesn't respond or late failure detected
 * RULE: Emits PaymentFailed event with ops reason
 * RULE: Policy gate: requires ops approval + reason
 */

import {
  NPPPaymentState,
  NPPFailureReason,
  NPPPaymentEventUnion,
  OpsViolationError,
} from "../../../../core/payments/npp";

export interface MarkFailedInput {
  paymentIntentId: string;
  currentState: NPPPaymentState;
  operatorId: string;
  reason: string;
  failureReason: NPPFailureReason;
  policyApproval: boolean; // Policy gate
}

export interface MarkFailedOutput {
  event: NPPPaymentEventUnion;
}

/**
 * Manually mark a payment as failed
 * 
 * Used when rail doesn't respond or late failure detected
 */
export function markFailed(input: MarkFailedInput): MarkFailedOutput {
  // Policy gate: require approval
  if (!input.policyApproval) {
    throw new OpsViolationError("mark failed requires policy approval");
  }

  // State gate: only SENT or ACKNOWLEDGED
  const allowedStates = [NPPPaymentState.SENT, NPPPaymentState.ACKNOWLEDGED];
  if (!allowedStates.includes(input.currentState)) {
    throw new OpsViolationError(
      `mark failed only allowed from SENT or ACKNOWLEDGED, current state: ${input.currentState}`
    );
  }

  // Emit PaymentFailed event
  const event: NPPPaymentEventUnion = {
    type: "PaymentFailed",
    paymentIntentId: input.paymentIntentId,
    occurredAt: new Date(),
    reason: input.failureReason,
    fundsReleased: 0n, // Will be filled by handler
    data: {
      operatorId: input.operatorId,
      opsReason: input.reason,
      markedFrom: input.currentState,
    },
  };

  return {
    event,
  };
}
