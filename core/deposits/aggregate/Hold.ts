/**
 * Hold.ts - Immutable Hold Value Object
 * 
 * Deposits Core v1 - The Immutable Banking Primitive
 * 
 * Design Principles:
 * - Holds reduce available balance but not ledger balance
 * - Each hold has a unique ID
 * - Holds are immutable - release creates a new state
 * - Hold is a value object, not an entity
 */

import { Money } from "../ledger/Money";

/**
 * Immutable Hold value object.
 * 
 * Represents a hold on funds that reduces available balance.
 * Common uses: pending payments, card authorizations, legal holds.
 */
export class Hold {
  readonly id: string;
  readonly amount: Money;

  constructor(id: string, amount: Money) {
    if (!id || id.trim().length === 0) {
      throw new Error("INVALID_HOLD_ID");
    }
    if (amount.isZero()) {
      throw new Error("ZERO_HOLD_AMOUNT");
    }
    
    this.id = id;
    this.amount = amount;
  }

  /**
   * Equality check (by ID only - holds are unique by ID).
   */
  equals(other: Hold): boolean {
    return this.id === other.id;
  }

  /**
   * Full equality check (ID and amount).
   */
  deepEquals(other: Hold): boolean {
    return this.id === other.id && this.amount.equals(other.amount);
  }

  /**
   * Serialize to JSON-safe object.
   */
  toJSON(): { id: string; amount: { amount: string; currency: string } } {
    return {
      id: this.id,
      amount: this.amount.toJSON(),
    };
  }

  /**
   * Deserialize from JSON object.
   */
  static fromJSON(json: { id: string; amount: { amount: string; currency: string } }): Hold {
    return new Hold(json.id, Money.fromJSON(json.amount));
  }
}
