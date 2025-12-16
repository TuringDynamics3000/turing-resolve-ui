/**
 * Payment Commands
 * 
 * Commands represent intent to change payment state.
 * Commands are validated and translated to facts by handlers.
 * 
 * CRITICAL: Commands express intent, not truth.
 * Facts express truth.
 */

import type { ExternalParty } from '../aggregate/Payment';

/**
 * Base command structure.
 */
interface PaymentCommandBase {
  readonly commandId: string;
  readonly timestamp: string; // ISO timestamp
}

/**
 * Initiate a new payment.
 */
export interface InitiatePaymentCommand extends PaymentCommandBase {
  readonly type: 'INITIATE_PAYMENT';
  readonly paymentId: string;
  readonly fromAccount: string;
  readonly toAccount?: string;
  readonly toExternal?: ExternalParty;
  readonly amount: string;
  readonly currency: string;
  readonly reference?: string;
  readonly description?: string;
}

/**
 * Place hold on source account.
 */
export interface PlaceHoldCommand extends PaymentCommandBase {
  readonly type: 'PLACE_HOLD';
  readonly paymentId: string;
  readonly holdId: string;
}

/**
 * Authorise payment (for card payments, etc.).
 */
export interface AuthorisePaymentCommand extends PaymentCommandBase {
  readonly type: 'AUTHORISE_PAYMENT';
  readonly paymentId: string;
  readonly authorisationCode?: string;
  readonly authorisedBy?: string;
}

/**
 * Send payment to external network.
 */
export interface SendPaymentCommand extends PaymentCommandBase {
  readonly type: 'SEND_PAYMENT';
  readonly paymentId: string;
  readonly networkReference?: string;
}

/**
 * Settle payment (mark as completed).
 */
export interface SettlePaymentCommand extends PaymentCommandBase {
  readonly type: 'SETTLE_PAYMENT';
  readonly paymentId: string;
  readonly settlementReference?: string;
}

/**
 * Fail payment.
 */
export interface FailPaymentCommand extends PaymentCommandBase {
  readonly type: 'FAIL_PAYMENT';
  readonly paymentId: string;
  readonly reason: string;
  readonly errorCode?: string;
  readonly recoverable?: boolean;
}

/**
 * Reverse a settled payment.
 */
export interface ReversePaymentCommand extends PaymentCommandBase {
  readonly type: 'REVERSE_PAYMENT';
  readonly paymentId: string;
  readonly reason: string;
}

/**
 * Cancel a payment (release hold).
 */
export interface CancelPaymentCommand extends PaymentCommandBase {
  readonly type: 'CANCEL_PAYMENT';
  readonly paymentId: string;
  readonly reason: string;
}

/**
 * Union of all payment commands.
 */
export type PaymentCommand =
  | InitiatePaymentCommand
  | PlaceHoldCommand
  | AuthorisePaymentCommand
  | SendPaymentCommand
  | SettlePaymentCommand
  | FailPaymentCommand
  | ReversePaymentCommand
  | CancelPaymentCommand;

/**
 * Factory functions for creating commands.
 */
export const PaymentCommands = {
  initiate(
    paymentId: string,
    fromAccount: string,
    amount: string,
    currency: string,
    options?: {
      toAccount?: string;
      toExternal?: ExternalParty;
      reference?: string;
      description?: string;
    }
  ): InitiatePaymentCommand {
    return {
      commandId: `CMD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'INITIATE_PAYMENT',
      timestamp: new Date().toISOString(),
      paymentId,
      fromAccount,
      amount,
      currency,
      toAccount: options?.toAccount,
      toExternal: options?.toExternal,
      reference: options?.reference,
      description: options?.description,
    };
  },

  placeHold(paymentId: string, holdId: string): PlaceHoldCommand {
    return {
      commandId: `CMD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'PLACE_HOLD',
      timestamp: new Date().toISOString(),
      paymentId,
      holdId,
    };
  },

  authorise(
    paymentId: string,
    authorisationCode?: string,
    authorisedBy?: string
  ): AuthorisePaymentCommand {
    return {
      commandId: `CMD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'AUTHORISE_PAYMENT',
      timestamp: new Date().toISOString(),
      paymentId,
      authorisationCode,
      authorisedBy,
    };
  },

  send(paymentId: string, networkReference?: string): SendPaymentCommand {
    return {
      commandId: `CMD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'SEND_PAYMENT',
      timestamp: new Date().toISOString(),
      paymentId,
      networkReference,
    };
  },

  settle(paymentId: string, settlementReference?: string): SettlePaymentCommand {
    return {
      commandId: `CMD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'SETTLE_PAYMENT',
      timestamp: new Date().toISOString(),
      paymentId,
      settlementReference,
    };
  },

  fail(
    paymentId: string,
    reason: string,
    errorCode?: string,
    recoverable?: boolean
  ): FailPaymentCommand {
    return {
      commandId: `CMD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'FAIL_PAYMENT',
      timestamp: new Date().toISOString(),
      paymentId,
      reason,
      errorCode,
      recoverable,
    };
  },

  reverse(paymentId: string, reason: string): ReversePaymentCommand {
    return {
      commandId: `CMD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'REVERSE_PAYMENT',
      timestamp: new Date().toISOString(),
      paymentId,
      reason,
    };
  },

  cancel(paymentId: string, reason: string): CancelPaymentCommand {
    return {
      commandId: `CMD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'CANCEL_PAYMENT',
      timestamp: new Date().toISOString(),
      paymentId,
      reason,
    };
  },
};
