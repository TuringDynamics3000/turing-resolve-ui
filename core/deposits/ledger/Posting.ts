/**
 * Posting.ts - Ledger Posting Types
 * 
 * Deposits Core v1 - The Immutable Banking Primitive
 * 
 * Design Principles:
 * - No deposit(), withdraw() methods - only facts
 * - Discriminated union for type safety
 * - All postings are immutable records
 * - occurredAt is ISO 8601 string (no Date objects in core)
 * 
 * Key Point:
 * There is no "do X then Y".
 * Only facts recorded in the ledger.
 */

import { Money } from "./Money";

/**
 * Base interface for all postings.
 * occurredAt is when the fact occurred (ISO 8601 string).
 */
interface BasePosting {
  readonly occurredAt: string;
}

/**
 * Credit posting - money added to the account.
 * Increases both ledger balance and available balance.
 */
export interface CreditPosting extends BasePosting {
  readonly type: "CREDIT";
  readonly amount: Money;
  readonly reference?: string;
}

/**
 * Debit posting - money removed from the account.
 * Decreases both ledger balance and available balance.
 * Will throw INSUFFICIENT_FUNDS if available < amount.
 */
export interface DebitPosting extends BasePosting {
  readonly type: "DEBIT";
  readonly amount: Money;
  readonly reference?: string;
}

/**
 * Hold placed posting - money reserved but not yet debited.
 * Decreases available balance but NOT ledger balance.
 * Hold must have unique holdId.
 */
export interface HoldPlacedPosting extends BasePosting {
  readonly type: "HOLD_PLACED";
  readonly amount: Money;
  readonly holdId: string;
  readonly reason?: string;
}

/**
 * Hold released posting - reserved money released back to available.
 * Increases available balance (ledger unchanged).
 * Hold must exist with matching holdId.
 */
export interface HoldReleasedPosting extends BasePosting {
  readonly type: "HOLD_RELEASED";
  readonly holdId: string;
}

/**
 * Interest accrued posting - interest added to the account.
 * Increases both ledger balance and available balance.
 * Functionally same as credit but semantically distinct.
 */
export interface InterestAccruedPosting extends BasePosting {
  readonly type: "INTEREST_ACCRUED";
  readonly amount: Money;
  readonly period?: string; // e.g., "2024-11" for monthly interest
}

/**
 * Discriminated union of all posting types.
 * This is the ONLY way to change account state.
 */
export type Posting =
  | CreditPosting
  | DebitPosting
  | HoldPlacedPosting
  | HoldReleasedPosting
  | InterestAccruedPosting;

/**
 * Type guard for CreditPosting.
 */
export function isCreditPosting(posting: Posting): posting is CreditPosting {
  return posting.type === "CREDIT";
}

/**
 * Type guard for DebitPosting.
 */
export function isDebitPosting(posting: Posting): posting is DebitPosting {
  return posting.type === "DEBIT";
}

/**
 * Type guard for HoldPlacedPosting.
 */
export function isHoldPlacedPosting(posting: Posting): posting is HoldPlacedPosting {
  return posting.type === "HOLD_PLACED";
}

/**
 * Type guard for HoldReleasedPosting.
 */
export function isHoldReleasedPosting(posting: Posting): posting is HoldReleasedPosting {
  return posting.type === "HOLD_RELEASED";
}

/**
 * Type guard for InterestAccruedPosting.
 */
export function isInterestAccruedPosting(posting: Posting): posting is InterestAccruedPosting {
  return posting.type === "INTEREST_ACCRUED";
}

/**
 * Factory functions for creating postings.
 * These ensure proper structure and timestamp format.
 */
export const Postings = {
  credit(amount: Money, reference?: string, occurredAt?: string): CreditPosting {
    return {
      type: "CREDIT",
      amount,
      reference,
      occurredAt: occurredAt ?? new Date().toISOString(),
    };
  },

  debit(amount: Money, reference?: string, occurredAt?: string): DebitPosting {
    return {
      type: "DEBIT",
      amount,
      reference,
      occurredAt: occurredAt ?? new Date().toISOString(),
    };
  },

  holdPlaced(amount: Money, holdId: string, reason?: string, occurredAt?: string): HoldPlacedPosting {
    return {
      type: "HOLD_PLACED",
      amount,
      holdId,
      reason,
      occurredAt: occurredAt ?? new Date().toISOString(),
    };
  },

  holdReleased(holdId: string, occurredAt?: string): HoldReleasedPosting {
    return {
      type: "HOLD_RELEASED",
      holdId,
      occurredAt: occurredAt ?? new Date().toISOString(),
    };
  },

  interestAccrued(amount: Money, period?: string, occurredAt?: string): InterestAccruedPosting {
    return {
      type: "INTEREST_ACCRUED",
      amount,
      period,
      occurredAt: occurredAt ?? new Date().toISOString(),
    };
  },
};
