/**
 * DepositErrors.ts - Core Error Types
 * 
 * Deposits Core v1 - The Immutable Banking Primitive
 * 
 * Design Principles:
 * - All errors are typed and predictable
 * - Error codes are stable (never change meaning)
 * - Errors carry enough context for debugging
 * - No generic "Error" throws in core
 */

/**
 * Base error for all Deposits Core errors.
 */
export class DepositError extends Error {
  readonly code: string;
  readonly context?: Record<string, unknown>;

  constructor(code: string, message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = "DepositError";
    this.code = code;
    this.context = context;
  }
}

/**
 * Money-related errors.
 */
export class NegativeMoneyError extends DepositError {
  constructor(amount: bigint) {
    super("NEGATIVE_MONEY", "Money amount cannot be negative", { amount: amount.toString() });
  }
}

export class CurrencyMismatchError extends DepositError {
  constructor(expected: string, actual: string) {
    super("CURRENCY_MISMATCH", `Currency mismatch: expected ${expected}, got ${actual}`, { expected, actual });
  }
}

export class InvalidCurrencyError extends DepositError {
  constructor(currency: string) {
    super("INVALID_CURRENCY", `Invalid currency code: ${currency}`, { currency });
  }
}

/**
 * Balance-related errors.
 */
export class InsufficientFundsError extends DepositError {
  constructor(available: string, requested: string, currency: string) {
    super(
      "INSUFFICIENT_FUNDS",
      `Insufficient funds: available ${available} ${currency}, requested ${requested} ${currency}`,
      { available, requested, currency }
    );
  }
}

export class AvailableExceedsLedgerError extends DepositError {
  constructor(ledger: string, available: string, currency: string) {
    super(
      "AVAILABLE_EXCEEDS_LEDGER",
      `Available balance (${available}) cannot exceed ledger balance (${ledger})`,
      { ledger, available, currency }
    );
  }
}

/**
 * Hold-related errors.
 */
export class HoldAlreadyExistsError extends DepositError {
  constructor(holdId: string) {
    super("HOLD_ALREADY_EXISTS", `Hold with ID ${holdId} already exists`, { holdId });
  }
}

export class HoldNotFoundError extends DepositError {
  constructor(holdId: string) {
    super("HOLD_NOT_FOUND", `Hold with ID ${holdId} not found`, { holdId });
  }
}

export class InvalidHoldIdError extends DepositError {
  constructor() {
    super("INVALID_HOLD_ID", "Hold ID cannot be empty");
  }
}

export class ZeroHoldAmountError extends DepositError {
  constructor() {
    super("ZERO_HOLD_AMOUNT", "Hold amount cannot be zero");
  }
}

/**
 * Account-related errors.
 */
export class AccountClosedError extends DepositError {
  constructor(accountId: string) {
    super("ACCOUNT_CLOSED", `Account ${accountId} is closed`, { accountId });
  }
}

export class InvalidAccountIdError extends DepositError {
  constructor() {
    super("INVALID_ACCOUNT_ID", "Account ID cannot be empty");
  }
}

/**
 * Invariant violation errors.
 */
export class InvariantViolationError extends DepositError {
  constructor(invariant: string, details?: string) {
    super(
      "INVARIANT_VIOLATION",
      `Invariant violated: ${invariant}${details ? ` - ${details}` : ""}`,
      { invariant, details }
    );
  }
}

/**
 * Error codes as constants for external use.
 */
export const ErrorCodes = {
  // Money errors
  NEGATIVE_MONEY: "NEGATIVE_MONEY",
  CURRENCY_MISMATCH: "CURRENCY_MISMATCH",
  INVALID_CURRENCY: "INVALID_CURRENCY",
  
  // Balance errors
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
  AVAILABLE_EXCEEDS_LEDGER: "AVAILABLE_EXCEEDS_LEDGER",
  
  // Hold errors
  HOLD_ALREADY_EXISTS: "HOLD_ALREADY_EXISTS",
  HOLD_NOT_FOUND: "HOLD_NOT_FOUND",
  INVALID_HOLD_ID: "INVALID_HOLD_ID",
  ZERO_HOLD_AMOUNT: "ZERO_HOLD_AMOUNT",
  
  // Account errors
  ACCOUNT_CLOSED: "ACCOUNT_CLOSED",
  INVALID_ACCOUNT_ID: "INVALID_ACCOUNT_ID",
  
  // Invariant errors
  INVARIANT_VIOLATION: "INVARIANT_VIOLATION",
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
