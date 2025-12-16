/**
 * Payment Errors
 * 
 * All error types for Payments Core v1.
 * These are domain errors, not infrastructure errors.
 * 
 * CRITICAL: Payments Core errors are about payment state,
 * NOT about balances. Balance errors come from Deposits Core.
 */

export type PaymentErrorCode =
  | 'PAYMENT_NOT_FOUND'
  | 'INVALID_STATE_TRANSITION'
  | 'PAYMENT_ALREADY_EXISTS'
  | 'INVALID_AMOUNT'
  | 'SAME_ACCOUNT_TRANSFER'
  | 'PAYMENT_ALREADY_SETTLED'
  | 'PAYMENT_ALREADY_FAILED'
  | 'PAYMENT_ALREADY_REVERSED'
  | 'CANNOT_REVERSE_UNSETTLED'
  | 'HOLD_NOT_FOUND'
  | 'HOLD_ALREADY_EXISTS'
  | 'EXTERNAL_PARTY_REQUIRED'
  | 'DEPOSITS_CORE_REJECTED';

export class PaymentError extends Error {
  readonly code: PaymentErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: PaymentErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, PaymentError.prototype);
  }

  static paymentNotFound(paymentId: string): PaymentError {
    return new PaymentError(
      'PAYMENT_NOT_FOUND',
      `Payment ${paymentId} not found`,
      { paymentId }
    );
  }

  static invalidStateTransition(
    paymentId: string,
    currentState: string,
    targetState: string
  ): PaymentError {
    return new PaymentError(
      'INVALID_STATE_TRANSITION',
      `Cannot transition payment ${paymentId} from ${currentState} to ${targetState}`,
      { paymentId, currentState, targetState }
    );
  }

  static paymentAlreadyExists(paymentId: string): PaymentError {
    return new PaymentError(
      'PAYMENT_ALREADY_EXISTS',
      `Payment ${paymentId} already exists`,
      { paymentId }
    );
  }

  static invalidAmount(amount: string, reason: string): PaymentError {
    return new PaymentError(
      'INVALID_AMOUNT',
      `Invalid amount ${amount}: ${reason}`,
      { amount, reason }
    );
  }

  static sameAccountTransfer(accountId: string): PaymentError {
    return new PaymentError(
      'SAME_ACCOUNT_TRANSFER',
      `Cannot transfer to the same account: ${accountId}`,
      { accountId }
    );
  }

  static paymentAlreadySettled(paymentId: string): PaymentError {
    return new PaymentError(
      'PAYMENT_ALREADY_SETTLED',
      `Payment ${paymentId} is already settled`,
      { paymentId }
    );
  }

  static paymentAlreadyFailed(paymentId: string): PaymentError {
    return new PaymentError(
      'PAYMENT_ALREADY_FAILED',
      `Payment ${paymentId} has already failed`,
      { paymentId }
    );
  }

  static paymentAlreadyReversed(paymentId: string): PaymentError {
    return new PaymentError(
      'PAYMENT_ALREADY_REVERSED',
      `Payment ${paymentId} is already reversed`,
      { paymentId }
    );
  }

  static cannotReverseUnsettled(paymentId: string, state: string): PaymentError {
    return new PaymentError(
      'CANNOT_REVERSE_UNSETTLED',
      `Cannot reverse payment ${paymentId} in state ${state} - must be SETTLED`,
      { paymentId, state }
    );
  }

  static holdNotFound(holdId: string): PaymentError {
    return new PaymentError(
      'HOLD_NOT_FOUND',
      `Hold ${holdId} not found`,
      { holdId }
    );
  }

  static holdAlreadyExists(holdId: string): PaymentError {
    return new PaymentError(
      'HOLD_ALREADY_EXISTS',
      `Hold ${holdId} already exists`,
      { holdId }
    );
  }

  static externalPartyRequired(): PaymentError {
    return new PaymentError(
      'EXTERNAL_PARTY_REQUIRED',
      'External party details required for outbound payment'
    );
  }

  static depositsCoreRejected(reason: string, depositError?: string): PaymentError {
    return new PaymentError(
      'DEPOSITS_CORE_REJECTED',
      `Deposits Core rejected the posting: ${reason}`,
      { reason, depositError }
    );
  }
}
