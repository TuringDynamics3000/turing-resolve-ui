/**
 * Payment Aggregate
 * 
 * Immutable payment entity that models a promise to move money.
 * NOT money itself.
 * 
 * CRITICAL RULES:
 * - References Money (value object only) - does not hold balances
 * - References accounts by ID only
 * - Cannot import DB, Kafka, HTTP
 * - Cannot touch Balance or Hold internals
 * - All state changes via apply(fact) returning new Payment
 */

import { Money } from '../../deposits/ledger/Money';
import type { PaymentState } from './PaymentState';
import { isValidTransition, isTerminalState } from './PaymentState';
import type { PaymentFact } from '../events/PaymentFact';
import { PaymentError } from '../errors/PaymentErrors';

/**
 * Unique payment identifier.
 */
export type PaymentId = string;

/**
 * Account identifier (reference only, no balance access).
 */
export type AccountId = string;

/**
 * External party for outbound payments.
 */
export interface ExternalParty {
  readonly type: 'BANK_ACCOUNT' | 'CARD' | 'NPP' | 'ACH' | 'SEPA' | 'SWIFT';
  readonly identifier: string;
  readonly name?: string;
  readonly bankCode?: string;
  readonly countryCode?: string;
}

/**
 * Hold reference (ID only, no balance access).
 */
export interface HoldReference {
  readonly holdId: string;
  readonly amount: Money;
  readonly placedAt: Date;
}

/**
 * Payment type.
 */
export type PaymentType = 
  | 'INTERNAL'      // Between internal accounts
  | 'OUTBOUND'      // To external party
  | 'INBOUND';      // From external party

/**
 * Immutable Payment aggregate.
 */
export class Payment {
  readonly id: PaymentId;
  readonly type: PaymentType;
  readonly fromAccount: AccountId;
  readonly toAccount: AccountId | null;
  readonly toExternal: ExternalParty | null;
  readonly amount: Money;
  readonly state: PaymentState;
  readonly holds: readonly HoldReference[];
  readonly reference?: string;
  readonly description?: string;
  readonly initiatedAt: Date;
  readonly updatedAt: Date;
  readonly settledAt?: Date;
  readonly failedAt?: Date;
  readonly reversedAt?: Date;
  readonly failureReason?: string;
  readonly reversalReason?: string;

  private constructor(props: {
    id: PaymentId;
    type: PaymentType;
    fromAccount: AccountId;
    toAccount: AccountId | null;
    toExternal: ExternalParty | null;
    amount: Money;
    state: PaymentState;
    holds: readonly HoldReference[];
    reference?: string;
    description?: string;
    initiatedAt: Date;
    updatedAt: Date;
    settledAt?: Date;
    failedAt?: Date;
    reversedAt?: Date;
    failureReason?: string;
    reversalReason?: string;
  }) {
    this.id = props.id;
    this.type = props.type;
    this.fromAccount = props.fromAccount;
    this.toAccount = props.toAccount;
    this.toExternal = props.toExternal;
    this.amount = props.amount;
    this.state = props.state;
    this.holds = props.holds;
    this.reference = props.reference;
    this.description = props.description;
    this.initiatedAt = props.initiatedAt;
    this.updatedAt = props.updatedAt;
    this.settledAt = props.settledAt;
    this.failedAt = props.failedAt;
    this.reversedAt = props.reversedAt;
    this.failureReason = props.failureReason;
    this.reversalReason = props.reversalReason;
    Object.freeze(this);
    Object.freeze(this.holds);
  }

  /**
   * Create a new payment from an initiation fact.
   */
  static create(fact: Extract<PaymentFact, { type: 'PAYMENT_INITIATED' }>): Payment {
    const amount = Money.fromDecimal(parseFloat(fact.data.amount), fact.data.currency);
    
    // Validate amount (Money constructor already rejects negative)
    if (amount.isZero()) {
      throw PaymentError.invalidAmount(fact.data.amount, 'Amount cannot be zero');
    }

    // Validate accounts
    if (fact.data.toAccount && fact.data.fromAccount === fact.data.toAccount) {
      throw PaymentError.sameAccountTransfer(fact.data.fromAccount);
    }

    // Determine payment type
    let type: PaymentType = 'INTERNAL';
    if (fact.data.toExternal) {
      type = 'OUTBOUND';
    } else if (!fact.data.toAccount) {
      throw PaymentError.externalPartyRequired();
    }

    return new Payment({
      id: fact.paymentId,
      type,
      fromAccount: fact.data.fromAccount,
      toAccount: fact.data.toAccount || null,
      toExternal: fact.data.toExternal || null,
      amount,
      state: 'INITIATED',
      holds: [],
      reference: fact.data.reference,
      description: fact.data.description,
      initiatedAt: new Date(fact.occurredAt),
      updatedAt: new Date(fact.occurredAt),
    });
  }

  /**
   * Apply a fact to produce a new payment state.
   * This is the ONLY way to change payment state.
   */
  apply(fact: PaymentFact): Payment {
    switch (fact.type) {
      case 'PAYMENT_INITIATED':
        // Should use Payment.create() instead
        throw new Error('Use Payment.create() for PAYMENT_INITIATED');

      case 'PAYMENT_HOLD_PLACED':
        return this.applyHoldPlaced(fact);

      case 'PAYMENT_AUTHORISED':
        return this.applyAuthorised(fact);

      case 'PAYMENT_SENT':
        return this.applySent(fact);

      case 'PAYMENT_SETTLED':
        return this.applySettled(fact);

      case 'PAYMENT_FAILED':
        return this.applyFailed(fact);

      case 'PAYMENT_REVERSED':
        return this.applyReversed(fact);

      default:
        throw new Error(`Unknown fact type: ${(fact as PaymentFact).type}`);
    }
  }

  private applyHoldPlaced(fact: Extract<PaymentFact, { type: 'PAYMENT_HOLD_PLACED' }>): Payment {
    this.validateTransition('HELD');

    const holdAmount = Money.fromDecimal(parseFloat(fact.data.amount), fact.data.currency);
    const newHold: HoldReference = {
      holdId: fact.data.holdId,
      amount: holdAmount,
      placedAt: new Date(fact.occurredAt),
    };

    return new Payment({
      ...this.toProps(),
      state: 'HELD',
      holds: [...this.holds, newHold],
      updatedAt: new Date(fact.occurredAt),
    });
  }

  private applyAuthorised(fact: Extract<PaymentFact, { type: 'PAYMENT_AUTHORISED' }>): Payment {
    this.validateTransition('AUTHORISED');

    return new Payment({
      ...this.toProps(),
      state: 'AUTHORISED',
      updatedAt: new Date(fact.occurredAt),
    });
  }

  private applySent(fact: Extract<PaymentFact, { type: 'PAYMENT_SENT' }>): Payment {
    this.validateTransition('SENT');

    return new Payment({
      ...this.toProps(),
      state: 'SENT',
      updatedAt: new Date(fact.occurredAt),
    });
  }

  private applySettled(fact: Extract<PaymentFact, { type: 'PAYMENT_SETTLED' }>): Payment {
    this.validateTransition('SETTLED');

    return new Payment({
      ...this.toProps(),
      state: 'SETTLED',
      settledAt: new Date(fact.occurredAt),
      updatedAt: new Date(fact.occurredAt),
    });
  }

  private applyFailed(fact: Extract<PaymentFact, { type: 'PAYMENT_FAILED' }>): Payment {
    this.validateTransition('FAILED');

    return new Payment({
      ...this.toProps(),
      state: 'FAILED',
      failedAt: new Date(fact.occurredAt),
      failureReason: fact.data.reason,
      updatedAt: new Date(fact.occurredAt),
    });
  }

  private applyReversed(fact: Extract<PaymentFact, { type: 'PAYMENT_REVERSED' }>): Payment {
    this.validateTransition('REVERSED');

    return new Payment({
      ...this.toProps(),
      state: 'REVERSED',
      reversedAt: new Date(fact.occurredAt),
      reversalReason: fact.data.reason,
      updatedAt: new Date(fact.occurredAt),
    });
  }

  private validateTransition(targetState: PaymentState): void {
    // Special case: SETTLED can transition to REVERSED (reversal is allowed)
    if (this.state === 'SETTLED' && targetState === 'REVERSED') {
      return; // Valid reversal
    }

    if (isTerminalState(this.state)) {
      throw PaymentError.invalidStateTransition(this.id, this.state, targetState);
    }

    if (!isValidTransition(this.state, targetState)) {
      throw PaymentError.invalidStateTransition(this.id, this.state, targetState);
    }
  }

  private toProps() {
    return {
      id: this.id,
      type: this.type,
      fromAccount: this.fromAccount,
      toAccount: this.toAccount,
      toExternal: this.toExternal,
      amount: this.amount,
      state: this.state,
      holds: this.holds,
      reference: this.reference,
      description: this.description,
      initiatedAt: this.initiatedAt,
      updatedAt: this.updatedAt,
      settledAt: this.settledAt,
      failedAt: this.failedAt,
      reversedAt: this.reversedAt,
      failureReason: this.failureReason,
      reversalReason: this.reversalReason,
    };
  }

  /**
   * Check if payment is in a terminal state.
   */
  isTerminal(): boolean {
    return isTerminalState(this.state);
  }

  /**
   * Check if payment can be cancelled (hold released).
   */
  canCancel(): boolean {
    return this.state === 'HELD' || this.state === 'AUTHORISED';
  }

  /**
   * Check if payment can be reversed.
   */
  canReverse(): boolean {
    return this.state === 'SETTLED';
  }

  /**
   * Get the active hold (if any).
   */
  getActiveHold(): HoldReference | undefined {
    return this.holds[this.holds.length - 1];
  }
}

/**
 * Rebuild a Payment from a sequence of facts.
 */
export function rebuildPaymentFromFacts(facts: readonly PaymentFact[]): Payment {
  if (facts.length === 0) {
    throw new Error('Cannot rebuild payment from empty facts');
  }

  const firstFact = facts[0];
  if (firstFact.type !== 'PAYMENT_INITIATED') {
    throw new Error('First fact must be PAYMENT_INITIATED');
  }

  let payment = Payment.create(firstFact);

  for (let i = 1; i < facts.length; i++) {
    payment = payment.apply(facts[i]);
  }

  return payment;
}
