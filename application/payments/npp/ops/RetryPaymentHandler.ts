/**
 * Retry Payment Handler - Ops Action
 * 
 * RULE: Retry only allowed from FAILED or EXPIRED states
 * RULE: Creates new attempt (does not mutate existing)
 * RULE: Emits PaymentAttemptCreated event
 * RULE: Policy gate: requires ops approval
 */

import {
  NPPPaymentState,
  NPPPaymentEventUnion,
  InvariantViolationError,
  OpsViolationError,
} from "../../../../core/payments/npp";

export interface RetryPaymentInput {
  paymentIntentId: string;
  currentState: NPPPaymentState;
  operatorId: string;
  reason: string;
  policyApproval: boolean; // Policy gate
}

export interface RetryPaymentOutput {
  event: NPPPaymentEventUnion;
  newAttemptId: string;
}

/**
 * Retry a failed or expired payment
 * 
 * Creates a new attempt and returns to CREATED state
 */
export function retryPayment(input: RetryPaymentInput): RetryPaymentOutput {
  // Policy gate: require approval
  if (!input.policyApproval) {
    throw new OpsViolationError("retry requires policy approval");
  }

  // State gate: only FAILED or EXPIRED
  const allowedStates = [NPPPaymentState.FAILED, NPPPaymentState.EXPIRED];
  if (!allowedStates.includes(input.currentState)) {
    throw new OpsViolationError(
      `retry only allowed from FAILED or EXPIRED, current state: ${input.currentState}`
    );
  }

  // Generate new attempt ID
  const newAttemptId = `att_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Emit PaymentAttemptCreated event
  const event: NPPPaymentEventUnion = {
    type: "PaymentAttemptCreated",
    paymentIntentId: input.paymentIntentId,
    occurredAt: new Date(),
    attemptId: newAttemptId,
    rail: "NPP",
    data: {
      operatorId: input.operatorId,
      reason: input.reason,
      retryFrom: input.currentState,
    },
  };

  return {
    event,
    newAttemptId,
  };
}
