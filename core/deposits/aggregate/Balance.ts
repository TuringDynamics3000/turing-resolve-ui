/**
 * Balance.ts - Immutable Balance Value Object
 * 
 * Deposits Core v1 - The Immutable Banking Primitive
 * 
 * Design Principles:
 * - Ledger balance = truth from ledger postings
 * - Available balance = ledger - holds
 * - Both are readonly - no mutation
 * - Balance is a value object, not an entity
 */

import { Money } from "../ledger/Money";

/**
 * Immutable Balance value object.
 * 
 * Represents the two key balances for a deposit account:
 * - ledger: The true balance from all settled postings
 * - available: What the customer can actually use (ledger - holds)
 */
export class Balance {
  readonly ledger: Money;
  readonly available: Money;

  constructor(ledger: Money, available: Money) {
    // Validate currencies match
    if (ledger.currency !== available.currency) {
      throw new Error("BALANCE_CURRENCY_MISMATCH");
    }
    
    // Available cannot exceed ledger
    if (available.isGreaterThan(ledger)) {
      throw new Error("AVAILABLE_EXCEEDS_LEDGER");
    }
    
    this.ledger = ledger;
    this.available = available;
  }

  /**
   * Get the currency of this balance.
   */
  get currency(): string {
    return this.ledger.currency;
  }

  /**
   * Get the amount currently held (ledger - available).
   */
  get heldAmount(): Money {
    return this.ledger.subtract(this.available);
  }

  /**
   * Check if any amount is held.
   */
  hasHolds(): boolean {
    return !this.heldAmount.isZero();
  }

  /**
   * Create a zero balance in the specified currency.
   */
  static zero(currency: string): Balance {
    const zero = Money.zero(currency);
    return new Balance(zero, zero);
  }

  /**
   * Equality check.
   */
  equals(other: Balance): boolean {
    return this.ledger.equals(other.ledger) && this.available.equals(other.available);
  }

  /**
   * Serialize to JSON-safe object.
   */
  toJSON(): { ledger: { amount: string; currency: string }; available: { amount: string; currency: string } } {
    return {
      ledger: this.ledger.toJSON(),
      available: this.available.toJSON(),
    };
  }

  /**
   * Deserialize from JSON object.
   */
  static fromJSON(json: { ledger: { amount: string; currency: string }; available: { amount: string; currency: string } }): Balance {
    return new Balance(
      Money.fromJSON(json.ledger),
      Money.fromJSON(json.available)
    );
  }
}
