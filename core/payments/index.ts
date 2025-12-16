/**
 * Payments Core v1 - Public Surface
 * 
 * This is the ONLY supported API for Payments Core.
 * 
 * CRITICAL DEPENDENCY RULE:
 * - core/payments → core/deposits (allowed)
 * - core/deposits ✕→ core/payments (forbidden)
 * 
 * Payments Core models a promise to move money, not money itself.
 * All money movement happens via Deposits Core postings.
 */

// Aggregate
export { Payment, rebuildPaymentFromFacts } from './aggregate/Payment';
export type { PaymentId, AccountId, ExternalParty, HoldReference, PaymentType } from './aggregate/Payment';

// State Machine
export type { PaymentState, DepositPostingIntent } from './aggregate/PaymentState';
export {
  TERMINAL_STATES,
  VALID_TRANSITIONS,
  isValidTransition,
  isTerminalState,
  getValidNextStates,
  STATE_DESCRIPTIONS,
  getDepositPostingIntent,
} from './aggregate/PaymentState';

// Facts (Event Sourcing)
export type {
  PaymentFact,
  PaymentInitiated,
  PaymentHoldPlaced,
  PaymentAuthorised,
  PaymentSent,
  PaymentSettled,
  PaymentFailed,
  PaymentReversed,
} from './events/PaymentFact';
export { PaymentFacts, validatePaymentFactSequence } from './events/PaymentFact';

// Commands
export type {
  PaymentCommand,
  InitiatePaymentCommand,
  PlaceHoldCommand,
  AuthorisePaymentCommand,
  SendPaymentCommand,
  SettlePaymentCommand,
  FailPaymentCommand,
  ReversePaymentCommand,
  CancelPaymentCommand,
} from './commands/PaymentCommand';
export { PaymentCommands } from './commands/PaymentCommand';

// Errors
export { PaymentError } from './errors/PaymentErrors';
export type { PaymentErrorCode } from './errors/PaymentErrors';
