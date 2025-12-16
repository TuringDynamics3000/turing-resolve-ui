/**
 * DepositFact.ts - Event Sourcing Facts
 * 
 * Deposits Core v1 - The Immutable Banking Primitive
 * 
 * Design Principles:
 * - No commands - only facts
 * - No intentions - only what happened
 * - Append-only - facts are never modified
 * - Immutable - facts are readonly
 * - Auditable - every fact has a timestamp
 * - Replayable - facts can rebuild state
 * 
 * Facts are the source of truth.
 * Everything else is derived.
 */

import { Posting } from "../ledger/Posting";

/**
 * Account opened fact.
 * Emitted when a new account is created.
 */
export interface AccountOpened {
  readonly type: "ACCOUNT_OPENED";
  readonly accountId: string;
  readonly currency: string;
  readonly occurredAt: string;
}

/**
 * Posting applied fact.
 * Emitted when a posting changes account state.
 */
export interface PostingApplied {
  readonly type: "POSTING_APPLIED";
  readonly accountId: string;
  readonly posting: Posting;
  readonly occurredAt: string;
  readonly sequence: number; // Monotonic sequence for ordering
}

/**
 * Account closed fact.
 * Emitted when an account is permanently closed.
 */
export interface AccountClosed {
  readonly type: "ACCOUNT_CLOSED";
  readonly accountId: string;
  readonly occurredAt: string;
}

/**
 * Discriminated union of all deposit facts.
 * These are the ONLY events that matter for deposits.
 */
export type DepositFact =
  | AccountOpened
  | PostingApplied
  | AccountClosed;

/**
 * Type guards for fact types.
 */
export function isAccountOpened(fact: DepositFact): fact is AccountOpened {
  return fact.type === "ACCOUNT_OPENED";
}

export function isPostingApplied(fact: DepositFact): fact is PostingApplied {
  return fact.type === "POSTING_APPLIED";
}

export function isAccountClosed(fact: DepositFact): fact is AccountClosed {
  return fact.type === "ACCOUNT_CLOSED";
}

/**
 * Factory functions for creating facts.
 */
export const Facts = {
  accountOpened(
    accountId: string,
    currency: string,
    occurredAt?: string
  ): AccountOpened {
    return {
      type: "ACCOUNT_OPENED",
      accountId,
      currency,
      occurredAt: occurredAt ?? new Date().toISOString(),
    };
  },

  postingApplied(
    accountId: string,
    posting: Posting,
    sequence: number,
    occurredAt?: string
  ): PostingApplied {
    return {
      type: "POSTING_APPLIED",
      accountId,
      posting,
      sequence,
      occurredAt: occurredAt ?? new Date().toISOString(),
    };
  },

  accountClosed(
    accountId: string,
    occurredAt?: string
  ): AccountClosed {
    return {
      type: "ACCOUNT_CLOSED",
      accountId,
      occurredAt: occurredAt ?? new Date().toISOString(),
    };
  },
};

/**
 * Rebuild account state from facts.
 * 
 * This is the core of event sourcing - state is derived from facts.
 * Given the same facts in the same order, you get the same state.
 */
import { DepositAccount } from "../aggregate/DepositAccount";

export function rebuildFromFacts(facts: DepositFact[]): DepositAccount | null {
  if (facts.length === 0) {
    return null;
  }

  // First fact must be AccountOpened
  const firstFact = facts[0];
  if (!isAccountOpened(firstFact)) {
    throw new Error("INVALID_FACT_SEQUENCE: First fact must be ACCOUNT_OPENED");
  }

  // Create initial account
  let account = DepositAccount.create(firstFact.accountId, firstFact.currency);

  // Apply remaining facts
  for (let i = 1; i < facts.length; i++) {
    const fact = facts[i];

    if (isPostingApplied(fact)) {
      account = account.apply(fact.posting);
    } else if (isAccountClosed(fact)) {
      account = account.close();
    } else if (isAccountOpened(fact)) {
      throw new Error("INVALID_FACT_SEQUENCE: ACCOUNT_OPENED can only be first");
    }
  }

  return account;
}

/**
 * Validate a sequence of facts.
 * 
 * @param facts - The facts to validate
 * @returns true if valid, throws otherwise
 */
export function validateFactSequence(facts: DepositFact[]): boolean {
  if (facts.length === 0) {
    return true;
  }

  // First fact must be AccountOpened
  if (!isAccountOpened(facts[0])) {
    throw new Error("INVALID_FACT_SEQUENCE: First fact must be ACCOUNT_OPENED");
  }

  const accountId = facts[0].accountId;
  let isClosed = false;
  let lastSequence = -1;

  for (let i = 1; i < facts.length; i++) {
    const fact = facts[i];

    // All facts must be for the same account
    if (fact.accountId !== accountId) {
      throw new Error("INVALID_FACT_SEQUENCE: All facts must be for same account");
    }

    // No facts after account closed
    if (isClosed) {
      throw new Error("INVALID_FACT_SEQUENCE: No facts allowed after ACCOUNT_CLOSED");
    }

    // Check for duplicate AccountOpened
    if (isAccountOpened(fact)) {
      throw new Error("INVALID_FACT_SEQUENCE: ACCOUNT_OPENED can only be first");
    }

    // Check posting sequence is monotonic
    if (isPostingApplied(fact)) {
      if (fact.sequence <= lastSequence) {
        throw new Error("INVALID_FACT_SEQUENCE: Posting sequence must be monotonic");
      }
      lastSequence = fact.sequence;
    }

    // Track closed state
    if (isAccountClosed(fact)) {
      isClosed = true;
    }
  }

  return true;
}
