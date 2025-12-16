/**
 * Payments Application Layer - Public Surface
 * 
 * Handlers orchestrate. They do not decide.
 * 
 * Allowed:
 * - Load facts
 * - Validate command shape
 * - Call policies
 * - Emit facts
 * - Apply postings via Deposits Core
 * 
 * Not Allowed:
 * - Decide business rules
 * - Mutate balances
 * - Encode product logic
 */

// Handlers
export { initiatePayment } from './InitiatePaymentHandler';
export type { PaymentFactStore, InitiatePaymentResult } from './InitiatePaymentHandler';

export { placeHold } from './PlaceHoldHandler';
export type { DepositsHoldService, PlaceHoldResult } from './PlaceHoldHandler';

export { settlePayment } from './SettlePaymentHandler';
export type { DepositsPostingService, SettlePaymentResult } from './SettlePaymentHandler';

export { reversePayment } from './ReversePaymentHandler';
export type { ReversePaymentResult } from './ReversePaymentHandler';
