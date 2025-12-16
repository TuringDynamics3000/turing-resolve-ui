/**
 * Payment Facts (Event Sourcing)
 * 
 * All facts that can occur in the payment lifecycle.
 * Facts are append-only, replayable, and explainable.
 * 
 * CRITICAL: No side effects. Ever.
 * Facts describe what happened, not what should happen.
 */

import type { ExternalParty } from '../aggregate/Payment';

/**
 * Base fact structure.
 */
interface PaymentFactBase {
  readonly factId: string;
  readonly paymentId: string;
  readonly occurredAt: string; // ISO timestamp
  readonly sequence: number;
}

/**
 * Payment initiated - first fact in every payment lifecycle.
 */
export interface PaymentInitiated extends PaymentFactBase {
  readonly type: 'PAYMENT_INITIATED';
  readonly data: {
    readonly fromAccount: string;
    readonly toAccount?: string;
    readonly toExternal?: ExternalParty;
    readonly amount: string;
    readonly currency: string;
    readonly reference?: string;
    readonly description?: string;
  };
}

/**
 * Hold placed on source account.
 * Emits HOLD_PLACED to Deposits Core.
 */
export interface PaymentHoldPlaced extends PaymentFactBase {
  readonly type: 'PAYMENT_HOLD_PLACED';
  readonly data: {
    readonly holdId: string;
    readonly amount: string;
    readonly currency: string;
  };
}

/**
 * Payment authorised (for card payments, etc.).
 */
export interface PaymentAuthorised extends PaymentFactBase {
  readonly type: 'PAYMENT_AUTHORISED';
  readonly data: {
    readonly authorisationCode?: string;
    readonly authorisedBy?: string;
  };
}

/**
 * Payment sent to external network.
 */
export interface PaymentSent extends PaymentFactBase {
  readonly type: 'PAYMENT_SENT';
  readonly data: {
    readonly networkReference?: string;
    readonly sentAt: string;
  };
}

/**
 * Payment settled successfully.
 * Emits DEBIT to Deposits Core (releases hold, debits account).
 */
export interface PaymentSettled extends PaymentFactBase {
  readonly type: 'PAYMENT_SETTLED';
  readonly data: {
    readonly settlementReference?: string;
    readonly settledAmount?: string;
    readonly settledCurrency?: string;
  };
}

/**
 * Payment failed.
 * Emits HOLD_RELEASED to Deposits Core (if hold exists).
 */
export interface PaymentFailed extends PaymentFactBase {
  readonly type: 'PAYMENT_FAILED';
  readonly data: {
    readonly reason: string;
    readonly errorCode?: string;
    readonly recoverable: boolean;
  };
}

/**
 * Payment reversed after settlement.
 * Emits CREDIT to Deposits Core (refund).
 */
export interface PaymentReversed extends PaymentFactBase {
  readonly type: 'PAYMENT_REVERSED';
  readonly data: {
    readonly reason: string;
    readonly reversalReference?: string;
  };
}

/**
 * Union of all payment facts.
 */
export type PaymentFact =
  | PaymentInitiated
  | PaymentHoldPlaced
  | PaymentAuthorised
  | PaymentSent
  | PaymentSettled
  | PaymentFailed
  | PaymentReversed;

/**
 * Factory functions for creating facts.
 */
export const PaymentFacts = {
  initiated(
    paymentId: string,
    data: PaymentInitiated['data'],
    sequence: number = 1
  ): PaymentInitiated {
    return {
      factId: `FACT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      paymentId,
      type: 'PAYMENT_INITIATED',
      occurredAt: new Date().toISOString(),
      sequence,
      data,
    };
  },

  holdPlaced(
    paymentId: string,
    holdId: string,
    amount: string,
    currency: string,
    sequence: number
  ): PaymentHoldPlaced {
    return {
      factId: `FACT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      paymentId,
      type: 'PAYMENT_HOLD_PLACED',
      occurredAt: new Date().toISOString(),
      sequence,
      data: { holdId, amount, currency },
    };
  },

  authorised(
    paymentId: string,
    sequence: number,
    authorisationCode?: string,
    authorisedBy?: string
  ): PaymentAuthorised {
    return {
      factId: `FACT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      paymentId,
      type: 'PAYMENT_AUTHORISED',
      occurredAt: new Date().toISOString(),
      sequence,
      data: { authorisationCode, authorisedBy },
    };
  },

  sent(
    paymentId: string,
    sequence: number,
    networkReference?: string
  ): PaymentSent {
    return {
      factId: `FACT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      paymentId,
      type: 'PAYMENT_SENT',
      occurredAt: new Date().toISOString(),
      sequence,
      data: { networkReference, sentAt: new Date().toISOString() },
    };
  },

  settled(
    paymentId: string,
    sequence: number,
    settlementReference?: string,
    settledAmount?: string,
    settledCurrency?: string
  ): PaymentSettled {
    return {
      factId: `FACT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      paymentId,
      type: 'PAYMENT_SETTLED',
      occurredAt: new Date().toISOString(),
      sequence,
      data: { settlementReference, settledAmount, settledCurrency },
    };
  },

  failed(
    paymentId: string,
    reason: string,
    sequence: number,
    errorCode?: string,
    recoverable: boolean = false
  ): PaymentFailed {
    return {
      factId: `FACT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      paymentId,
      type: 'PAYMENT_FAILED',
      occurredAt: new Date().toISOString(),
      sequence,
      data: { reason, errorCode, recoverable },
    };
  },

  reversed(
    paymentId: string,
    reason: string,
    sequence: number,
    reversalReference?: string
  ): PaymentReversed {
    return {
      factId: `FACT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      paymentId,
      type: 'PAYMENT_REVERSED',
      occurredAt: new Date().toISOString(),
      sequence,
      data: { reason, reversalReference },
    };
  },
};

/**
 * Validate a sequence of facts for consistency.
 */
export function validatePaymentFactSequence(facts: readonly PaymentFact[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (facts.length === 0) {
    return { valid: true, errors: [] };
  }

  // First fact must be PAYMENT_INITIATED
  if (facts[0].type !== 'PAYMENT_INITIATED') {
    errors.push('First fact must be PAYMENT_INITIATED');
  }

  // Check sequence numbers
  for (let i = 0; i < facts.length; i++) {
    if (facts[i].sequence !== i + 1) {
      errors.push(`Fact at index ${i} has sequence ${facts[i].sequence}, expected ${i + 1}`);
    }
  }

  // Check all facts have same paymentId
  const paymentId = facts[0].paymentId;
  for (const fact of facts) {
    if (fact.paymentId !== paymentId) {
      errors.push(`Fact ${fact.factId} has paymentId ${fact.paymentId}, expected ${paymentId}`);
    }
  }

  // Check timestamps are monotonically increasing
  for (let i = 1; i < facts.length; i++) {
    const prev = new Date(facts[i - 1].occurredAt).getTime();
    const curr = new Date(facts[i].occurredAt).getTime();
    if (curr < prev) {
      errors.push(`Fact at index ${i} has earlier timestamp than previous fact`);
    }
  }

  return { valid: errors.length === 0, errors };
}
