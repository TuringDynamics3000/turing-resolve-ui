/**
 * Money.ts - Immutable Money Primitive
 * 
 * Deposits Core v1 - The Immutable Banking Primitive
 * 
 * Design Principles:
 * - No floats - bigint only for precision
 * - No silent rounding - explicit operations only
 * - Currency discipline enforced at construction
 * - Immutable - all operations return new instances
 * 
 * This is bank-grade money handling. No shortcuts.
 */

export class Money {
  readonly amount: bigint;
  readonly currency: string;

  constructor(amount: bigint, currency: string) {
    if (amount < BigInt(0)) {
      throw new Error("NEGATIVE_MONEY");
    }
    if (!currency || currency.length !== 3) {
      throw new Error("INVALID_CURRENCY");
    }
    this.amount = amount;
    this.currency = currency.toUpperCase();
  }

  /**
   * Add money - returns new Money instance.
   * Currency must match.
   */
  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  /**
   * Subtract money - returns new Money instance.
   * Currency must match.
   * Throws INSUFFICIENT_FUNDS if result would be negative.
   */
  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    if (this.amount < other.amount) {
      throw new Error("INSUFFICIENT_FUNDS");
    }
    return new Money(this.amount - other.amount, this.currency);
  }

  /**
   * Check if this money is greater than or equal to other.
   */
  isGreaterThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount >= other.amount;
  }

  /**
   * Check if this money is greater than other.
   */
  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount > other.amount;
  }

  /**
   * Check if this money equals zero.
   */
  isZero(): boolean {
    return this.amount === BigInt(0);
  }

  /**
   * Create zero money in the same currency.
   */
  zero(): Money {
    return new Money(BigInt(0), this.currency);
  }

  /**
   * Assert currencies match - throws CURRENCY_MISMATCH if not.
   */
  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error("CURRENCY_MISMATCH");
    }
  }

  /**
   * Format for display (not for calculations).
   * Returns string like "1,234.56 AUD"
   */
  toDisplayString(): string {
    // Convert bigint cents to decimal string
    const cents = this.amount.toString().padStart(3, "0");
    const dollars = cents.slice(0, -2);
    const centsPart = cents.slice(-2);
    
    // Add thousand separators
    const formattedDollars = dollars.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    
    return `${formattedDollars || "0"}.${centsPart} ${this.currency}`;
  }

  /**
   * Create Money from a decimal number (for convenience in tests).
   * Amount is in major units (e.g., dollars), converted to minor units (cents).
   * 
   * WARNING: Only use for test data. Production should use bigint directly.
   */
  static fromDecimal(amount: number, currency: string): Money {
    // Convert to cents (minor units) - round to avoid floating point issues
    const cents = BigInt(Math.round(amount * 100));
    return new Money(cents, currency);
  }

  /**
   * Create zero Money in specified currency.
   */
  static zero(currency: string): Money {
    return new Money(BigInt(0), currency);
  }

  /**
   * Equality check.
   */
  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  /**
   * Serialize to JSON-safe object.
   */
  toJSON(): { amount: string; currency: string } {
    return {
      amount: this.amount.toString(),
      currency: this.currency,
    };
  }

  /**
   * Deserialize from JSON object.
   */
  static fromJSON(json: { amount: string; currency: string }): Money {
    return new Money(BigInt(json.amount), json.currency);
  }
}
