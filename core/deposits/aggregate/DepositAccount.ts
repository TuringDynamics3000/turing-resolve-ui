/**
 * DepositAccount.ts - Immutable Aggregate Root
 * 
 * Deposits Core v1 - The Immutable Banking Primitive
 * 
 * Design Principles:
 * - No setters - all fields readonly
 * - No mutation - apply() returns new instance
 * - No "do X then Y" - only apply(posting)
 * - The aggregate does NOT decide anything
 * - It only applies postings
 * 
 * This guarantees:
 * - Deterministic replay
 * - Easy reasoning
 * - Easy testing
 */

import { Balance } from "./Balance";
import { Hold } from "./Hold";
import { Posting } from "../ledger/Posting";
import { Money } from "../ledger/Money";
import { applyPosting } from "../invariants/DepositInvariants";

/**
 * Account status - only two states at the core level.
 * 
 * Note: Higher-level states (FROZEN, LEGAL_HOLD, DORMANT) are
 * policy concerns, not core concerns. The core only knows
 * if an account can accept postings (OPEN) or not (CLOSED).
 */
export type AccountStatus = "OPEN" | "CLOSED";

/**
 * Immutable Deposit Account aggregate.
 * 
 * This is the heart of Deposits Core v1.
 * All balance changes flow through this aggregate via postings.
 */
export class DepositAccount {
  readonly id: string;
  readonly balance: Balance;
  readonly holds: Hold[];
  readonly status: AccountStatus;

  constructor(
    id: string,
    balance: Balance,
    holds: Hold[],
    status: AccountStatus
  ) {
    if (!id || id.trim().length === 0) {
      throw new Error("INVALID_ACCOUNT_ID");
    }
    
    this.id = id;
    this.balance = balance;
    this.holds = Object.freeze([...holds]) as Hold[];
    this.status = status;
  }

  /**
   * Apply a posting to this account, returning a new account.
   * 
   * This is the ONLY way to change account state.
   * All invariants are enforced in applyPosting.
   * 
   * @param posting - The posting to apply
   * @returns A new DepositAccount with the posting applied
   */
  apply(posting: Posting): DepositAccount {
    return applyPosting(this, posting);
  }

  /**
   * Apply multiple postings in sequence.
   * 
   * @param postings - The postings to apply in order
   * @returns A new DepositAccount with all postings applied
   */
  applyAll(postings: Posting[]): DepositAccount {
    return postings.reduce(
      (account, posting) => account.apply(posting),
      this as DepositAccount
    );
  }

  /**
   * Close the account, returning a new closed account.
   * 
   * INVARIANT: Account must have zero balance and no holds.
   */
  close(): DepositAccount {
    // Check holds first - more specific error
    if (this.holds.length > 0) {
      throw new Error("CANNOT_CLOSE_WITH_HOLDS");
    }
    if (!this.balance.ledger.isZero()) {
      throw new Error("CANNOT_CLOSE_WITH_BALANCE");
    }
    
    return new DepositAccount(
      this.id,
      this.balance,
      this.holds,
      "CLOSED"
    );
  }

  /**
   * Get the ledger balance (settled balance).
   */
  get ledgerBalance(): Money {
    return this.balance.ledger;
  }

  /**
   * Get the available balance (what can be used).
   */
  get availableBalance(): Money {
    return this.balance.available;
  }

  /**
   * Get total amount held.
   */
  get totalHeld(): Money {
    if (this.holds.length === 0) {
      return this.balance.ledger.zero();
    }
    return this.holds.reduce(
      (sum, hold) => sum.add(hold.amount),
      this.holds[0].amount.zero()
    );
  }

  /**
   * Check if account is open.
   */
  isOpen(): boolean {
    return this.status === "OPEN";
  }

  /**
   * Check if account is closed.
   */
  isClosed(): boolean {
    return this.status === "CLOSED";
  }

  /**
   * Check if account has any holds.
   */
  hasHolds(): boolean {
    return this.holds.length > 0;
  }

  /**
   * Get a specific hold by ID.
   */
  getHold(holdId: string): Hold | undefined {
    return this.holds.find(h => h.id === holdId);
  }

  /**
   * Create a new open account with zero balance.
   * 
   * @param id - Account ID
   * @param currency - Currency code (e.g., "AUD")
   */
  static create(id: string, currency: string): DepositAccount {
    return new DepositAccount(
      id,
      Balance.zero(currency),
      [],
      "OPEN"
    );
  }

  /**
   * Serialize to JSON-safe object.
   */
  toJSON(): {
    id: string;
    balance: ReturnType<Balance["toJSON"]>;
    holds: ReturnType<Hold["toJSON"]>[];
    status: AccountStatus;
  } {
    return {
      id: this.id,
      balance: this.balance.toJSON(),
      holds: this.holds.map(h => h.toJSON()),
      status: this.status,
    };
  }

  /**
   * Deserialize from JSON object.
   */
  static fromJSON(json: {
    id: string;
    balance: { ledger: { amount: string; currency: string }; available: { amount: string; currency: string } };
    holds: { id: string; amount: { amount: string; currency: string } }[];
    status: AccountStatus;
  }): DepositAccount {
    return new DepositAccount(
      json.id,
      Balance.fromJSON(json.balance),
      json.holds.map(h => Hold.fromJSON(h)),
      json.status
    );
  }

  /**
   * Equality check (by ID only - accounts are entities).
   */
  equals(other: DepositAccount): boolean {
    return this.id === other.id;
  }

  /**
   * Deep equality check (all fields).
   */
  deepEquals(other: DepositAccount): boolean {
    return (
      this.id === other.id &&
      this.status === other.status &&
      this.balance.equals(other.balance) &&
      this.holds.length === other.holds.length &&
      this.holds.every((h, i) => h.deepEquals(other.holds[i]))
    );
  }
}
