/**
 * NPP Payment Invariants - Hard Enforcement Rules
 * 
 * These invariants are NON-NEGOTIABLE.
 * Violations must fail tests and block merges.
 * 
 * Categories:
 * 1. State Transition Invariants
 * 2. Economic Invariants
 * 3. Idempotency Invariants
 * 4. NPP-Specific Invariants
 */

import { NPPPaymentState } from "./NPPPaymentState";
import { NPPPaymentEventUnion } from "./NPPPaymentEvent";
import { NPP_ALLOWED_TRANSITIONS } from "./NPPStateTransitions";
import {
  IllegalTransitionError,
  InvariantViolationError,
} from "./NPPPaymentErrors";

// ============================================================================
// 1. STATE TRANSITION INVARIANTS
// ============================================================================

/**
 * Assert legal state transition
 * 
 * RULE: This guard MUST be called before every state change.
 * No exceptions. No ops bypass.
 */
export function assertLegalTransition(
  from: NPPPaymentState,
  to: NPPPaymentState
): void {
  const allowed = NPP_ALLOWED_TRANSITIONS[from];

  if (!allowed.includes(to)) {
    throw new IllegalTransitionError(from, to);
  }
}

/**
 * Assert terminal state immutability
 * 
 * RULE: Terminal states (SETTLED, FAILED, EXPIRED) cannot transition
 */
export function assertNotTerminal(state: NPPPaymentState): void {
  const terminalStates = [
    NPPPaymentState.SETTLED,
    NPPPaymentState.FAILED,
    NPPPaymentState.EXPIRED,
  ];

  if (terminalStates.includes(state)) {
    throw new InvariantViolationError(
      `Cannot transition from terminal state ${state}`
    );
  }
}

// ============================================================================
// 2. ECONOMIC INVARIANTS
// ============================================================================

/**
 * Assert positive amount
 * 
 * RULE: amount > 0
 */
export function assertPositiveAmount(amount: bigint): void {
  if (amount <= 0n) {
    throw new InvariantViolationError("amount must be > 0");
  }
}

/**
 * Assert single settlement
 * 
 * RULE: Exactly one SETTLED event max per payment
 */
export function assertSingleSettlement(
  events: NPPPaymentEventUnion[]
): void {
  const settlements = events.filter((e) => e.type === "PaymentSettled");

  if (settlements.length > 1) {
    throw new InvariantViolationError("multiple settlements detected");
  }
}

/**
 * Assert funds consistency
 * 
 * RULE: Held funds == intent amount until terminal
 */
export function assertFundsConsistency(
  intentAmount: bigint,
  heldAmount: bigint
): void {
  if (intentAmount !== heldAmount) {
    throw new InvariantViolationError(
      `funds inconsistency: intent=${intentAmount}, held=${heldAmount}`
    );
  }
}

/**
 * Assert currency locked to AUD
 * 
 * RULE: Currency must be AUD
 */
export function assertAUDCurrency(currency: string): void {
  if (currency !== "AUD") {
    throw new InvariantViolationError(`currency must be AUD, got ${currency}`);
  }
}

// ============================================================================
// 3. IDEMPOTENCY INVARIANTS
// ============================================================================

/**
 * Assert idempotent intent creation
 * 
 * RULE: Duplicate idempotency key returns existing intent
 */
export function assertIdempotentIntent<T>(
  existing: T | null,
  incomingKey: string,
  existingKey?: string
): T | null {
  if (existing && existingKey === incomingKey) {
    return existing; // Return existing, don't create new
  }
  return null;
}

/**
 * Assert idempotent rail callback
 * 
 * RULE: Duplicate callback should not change state
 */
export function assertIdempotentCallback(
  currentState: NPPPaymentState,
  eventType: string,
  alreadyProcessed: boolean
): void {
  if (alreadyProcessed) {
    throw new InvariantViolationError(
      `duplicate callback: ${eventType} already processed in state ${currentState}`
    );
  }
}

// ============================================================================
// 4. NPP-SPECIFIC INVARIANTS
// ============================================================================

/**
 * Assert ACK does not imply settlement
 * 
 * NPP REALITY: ACKNOWLEDGED can only progress to SETTLED or FAILED
 * Late failure is allowed after ACK
 */
export function assertAckNotSettlement(
  currentState: NPPPaymentState,
  event: NPPPaymentEventUnion
): void {
  if (currentState !== NPPPaymentState.ACKNOWLEDGED) {
    return; // Only applies to ACKNOWLEDGED state
  }

  const allowedEvents = ["PaymentSettled", "PaymentFailed", "PaymentExpired"];

  if (!allowedEvents.includes(event.type)) {
    throw new InvariantViolationError(
      `ACKNOWLEDGED can only progress to SETTLED, FAILED, or EXPIRED, got ${event.type}`
    );
  }
}

/**
 * Assert late failure allowed
 * 
 * NPP REALITY: Failure can occur after ACK (scheme reality)
 */
export function assertLateFailureAllowed(
  currentState: NPPPaymentState,
  event: NPPPaymentEventUnion
): void {
  if (
    event.type === "PaymentFailed" &&
    currentState === NPPPaymentState.ACKNOWLEDGED
  ) {
    // Late failure is explicitly allowed - this is NPP reality
    return;
  }
}

/**
 * Assert time-boxed expiry
 * 
 * NPP REALITY: Payments must expire to prevent zombie payments
 */
export function assertExpiryReason(expiryReason: string): void {
  const validReasons = [
    "TIMEOUT",
    "SCHEME_WINDOW_ELAPSED",
    "MANUAL_EXPIRY",
    "POLICY_EXPIRY",
  ];

  if (!validReasons.includes(expiryReason)) {
    throw new InvariantViolationError(
      `invalid expiry reason: ${expiryReason}`
    );
  }
}

// ============================================================================
// COMPOSITE INVARIANT CHECKER
// ============================================================================

/**
 * Check all invariants for an event application
 * 
 * This is the main entry point for invariant enforcement
 */
export function checkInvariants(
  currentState: NPPPaymentState,
  event: NPPPaymentEventUnion,
  allEvents: NPPPaymentEventUnion[]
): void {
  // 1. State transition invariants
  const nextState = getNextState(event);
  if (nextState !== currentState) {
    assertNotTerminal(currentState);
    assertLegalTransition(currentState, nextState);
  }

  // 2. Economic invariants
  if (event.type === "PaymentIntentCreated") {
    assertPositiveAmount(event.amount);
    assertAUDCurrency(event.currency);
  }

  // 3. Settlement invariant
  assertSingleSettlement([...allEvents, event]);

  // 4. NPP-specific invariants
  assertAckNotSettlement(currentState, event);
  assertLateFailureAllowed(currentState, event);

  if (event.type === "PaymentExpired") {
    assertExpiryReason(event.expiryReason);
  }
}

/**
 * Helper: Get next state from event
 */
function getNextState(event: NPPPaymentEventUnion): NPPPaymentState {
  switch (event.type) {
    case "PaymentIntentCreated":
      return NPPPaymentState.CREATED;
    case "PaymentAuthorised":
      return NPPPaymentState.AUTHORISED;
    case "PaymentSentToRail":
      return NPPPaymentState.SENT;
    case "PaymentAcknowledged":
      return NPPPaymentState.ACKNOWLEDGED;
    case "PaymentSettled":
      return NPPPaymentState.SETTLED;
    case "PaymentFailed":
      return NPPPaymentState.FAILED;
    case "PaymentExpired":
      return NPPPaymentState.EXPIRED;
    case "PaymentAttemptCreated":
      return NPPPaymentState.CREATED; // No state change
    case "OpsOverrideApplied":
      return event.toState;
    default:
      throw new InvariantViolationError(`unknown event type: ${(event as any).type}`);
  }
}
