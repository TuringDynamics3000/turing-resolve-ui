/**
 * NPP State Transition Matrix - Single Source of Truth
 * 
 * This table defines the ONLY legal state transitions for NPP payments.
 * Any transition not listed here is ILLEGAL by definition.
 * 
 * Enforced by assertLegalTransition() - no exceptions, no ops bypass.
 */

import { NPPPaymentState } from "./NPPPaymentState";

/**
 * NPP Allowed Transitions
 * 
 * Maps each state to the list of states it can transition to.
 * Terminal states (SETTLED, FAILED, EXPIRED) have empty arrays.
 */
export const NPP_ALLOWED_TRANSITIONS: Record<
  NPPPaymentState,
  NPPPaymentState[]
> = {
  [NPPPaymentState.CREATED]: [
    NPPPaymentState.AUTHORISED,
    NPPPaymentState.FAILED,
    NPPPaymentState.EXPIRED,
  ],
  [NPPPaymentState.AUTHORISED]: [
    NPPPaymentState.SENT,
    NPPPaymentState.FAILED,
    NPPPaymentState.EXPIRED,
  ],
  [NPPPaymentState.SENT]: [
    NPPPaymentState.ACKNOWLEDGED,
    NPPPaymentState.FAILED,
    NPPPaymentState.EXPIRED,
  ],
  [NPPPaymentState.ACKNOWLEDGED]: [
    NPPPaymentState.SETTLED,
    NPPPaymentState.FAILED,
    NPPPaymentState.EXPIRED,
  ],
  // Terminal states - no transitions allowed
  [NPPPaymentState.SETTLED]: [],
  [NPPPaymentState.FAILED]: [],
  [NPPPaymentState.EXPIRED]: [],
};

/**
 * Check if a transition is legal
 */
export function isLegalTransition(
  from: NPPPaymentState,
  to: NPPPaymentState
): boolean {
  const allowed = NPP_ALLOWED_TRANSITIONS[from];
  return allowed.includes(to);
}
