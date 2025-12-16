/**
 * Deposits Core v1 - Public Surface
 * 
 * The Immutable Banking Primitive
 * 
 * This is the ONLY supported API.
 * Everything exported here is stable.
 * Everything not exported is internal.
 * 
 * Design Principles:
 * - Small surface area
 * - Immutable logic
 * - No orchestration
 * - No IO
 * - No policies
 * - Facts before decisions
 * - Ledger postings are the only state change
 * - Zero framework leakage
 * - Replayability guaranteed by construction
 * 
 * Hard Line:
 * "If it changes balances, it must go through Deposits Core v1."
 * No exceptions. No shortcuts. No demos bypassing it.
 */

// =============================================================================
// AGGREGATE - The Heart
// =============================================================================

export { DepositAccount, AccountStatus } from "./aggregate/DepositAccount";
export { Balance } from "./aggregate/Balance";
export { Hold } from "./aggregate/Hold";

// =============================================================================
// LEDGER - The Only State Transition
// =============================================================================

export { Money } from "./ledger/Money";
export {
  Posting,
  CreditPosting,
  DebitPosting,
  HoldPlacedPosting,
  HoldReleasedPosting,
  InterestAccruedPosting,
  Postings,
  isCreditPosting,
  isDebitPosting,
  isHoldPlacedPosting,
  isHoldReleasedPosting,
  isInterestAccruedPosting,
} from "./ledger/Posting";

// =============================================================================
// EVENTS - Facts (Not Commands, Not Intentions)
// =============================================================================

export {
  DepositFact,
  AccountOpened,
  PostingApplied,
  AccountClosed,
  Facts,
  isAccountOpened,
  isPostingApplied,
  isAccountClosed,
  rebuildFromFacts,
  validateFactSequence,
} from "./events/DepositFact";

// =============================================================================
// INVARIANTS - Frozen Logic
// =============================================================================

export {
  applyPosting,
  applyPostings,
  validateAccountState,
  canApplyPosting,
} from "./invariants/DepositInvariants";

// =============================================================================
// ERRORS - Typed and Predictable
// =============================================================================

export {
  DepositError,
  NegativeMoneyError,
  CurrencyMismatchError,
  InvalidCurrencyError,
  InsufficientFundsError,
  AvailableExceedsLedgerError,
  HoldAlreadyExistsError,
  HoldNotFoundError,
  InvalidHoldIdError,
  ZeroHoldAmountError,
  AccountClosedError,
  InvalidAccountIdError,
  InvariantViolationError,
  ErrorCodes,
  ErrorCode,
} from "./errors/DepositErrors";
