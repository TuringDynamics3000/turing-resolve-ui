/**
 * Deposits Core v1 - Comprehensive Tests
 * 
 * Test Categories:
 * 1. Money arithmetic tests
 * 2. Posting application tests (all 5 types)
 * 3. Invariant violation tests
 * 4. Replay determinism tests
 * 5. Event sourcing tests
 */

import { describe, it, expect } from "vitest";
import {
  Money,
  Balance,
  Hold,
  DepositAccount,
  Posting,
  Postings,
  Facts,
  rebuildFromFacts,
  validateFactSequence,
  applyPosting,
  applyPostings,
  validateAccountState,
  canApplyPosting,
} from "../index";

// =============================================================================
// 1. MONEY ARITHMETIC TESTS
// =============================================================================

describe("Money", () => {
  describe("construction", () => {
    it("should create money with valid amount and currency", () => {
      const money = new Money(10000n, "AUD");
      expect(money.amount).toBe(10000n);
      expect(money.currency).toBe("AUD");
    });

    it("should reject negative amounts", () => {
      expect(() => new Money(-100n, "AUD")).toThrow("NEGATIVE_MONEY");
    });

    it("should reject invalid currency codes", () => {
      expect(() => new Money(100n, "")).toThrow("INVALID_CURRENCY");
      expect(() => new Money(100n, "AU")).toThrow("INVALID_CURRENCY");
      expect(() => new Money(100n, "AUDD")).toThrow("INVALID_CURRENCY");
    });

    it("should uppercase currency codes", () => {
      const money = new Money(100n, "aud");
      expect(money.currency).toBe("AUD");
    });
  });

  describe("add", () => {
    it("should add two money amounts", () => {
      const a = new Money(10000n, "AUD");
      const b = new Money(5000n, "AUD");
      const result = a.add(b);
      expect(result.amount).toBe(15000n);
      expect(result.currency).toBe("AUD");
    });

    it("should reject adding different currencies", () => {
      const aud = new Money(10000n, "AUD");
      const usd = new Money(5000n, "USD");
      expect(() => aud.add(usd)).toThrow("CURRENCY_MISMATCH");
    });

    it("should be immutable", () => {
      const a = new Money(10000n, "AUD");
      const b = new Money(5000n, "AUD");
      a.add(b);
      expect(a.amount).toBe(10000n); // Original unchanged
    });
  });

  describe("subtract", () => {
    it("should subtract money amounts", () => {
      const a = new Money(10000n, "AUD");
      const b = new Money(3000n, "AUD");
      const result = a.subtract(b);
      expect(result.amount).toBe(7000n);
    });

    it("should reject insufficient funds", () => {
      const a = new Money(5000n, "AUD");
      const b = new Money(10000n, "AUD");
      expect(() => a.subtract(b)).toThrow("INSUFFICIENT_FUNDS");
    });

    it("should allow subtracting to zero", () => {
      const a = new Money(5000n, "AUD");
      const b = new Money(5000n, "AUD");
      const result = a.subtract(b);
      expect(result.amount).toBe(0n);
    });
  });

  describe("fromDecimal", () => {
    it("should convert decimal to cents", () => {
      const money = Money.fromDecimal(100.50, "AUD");
      expect(money.amount).toBe(10050n);
    });

    it("should handle whole numbers", () => {
      const money = Money.fromDecimal(100, "AUD");
      expect(money.amount).toBe(10000n);
    });
  });

  describe("serialization", () => {
    it("should serialize to JSON", () => {
      const money = new Money(10050n, "AUD");
      const json = money.toJSON();
      expect(json).toEqual({ amount: "10050", currency: "AUD" });
    });

    it("should deserialize from JSON", () => {
      const json = { amount: "10050", currency: "AUD" };
      const money = Money.fromJSON(json);
      expect(money.amount).toBe(10050n);
      expect(money.currency).toBe("AUD");
    });
  });
});

// =============================================================================
// 2. POSTING APPLICATION TESTS
// =============================================================================

describe("Posting Application", () => {
  const createAccount = () => DepositAccount.create("ACC-001", "AUD");
  const credit = (amount: number) => Postings.credit(Money.fromDecimal(amount, "AUD"));
  const debit = (amount: number) => Postings.debit(Money.fromDecimal(amount, "AUD"));
  const holdPlaced = (amount: number, holdId: string) => 
    Postings.holdPlaced(Money.fromDecimal(amount, "AUD"), holdId);
  const holdReleased = (holdId: string) => Postings.holdReleased(holdId);
  const interestAccrued = (amount: number) => 
    Postings.interestAccrued(Money.fromDecimal(amount, "AUD"));

  describe("CREDIT", () => {
    it("should increase both ledger and available balance", () => {
      const account = createAccount().apply(credit(100));
      expect(account.ledgerBalance.amount).toBe(10000n);
      expect(account.availableBalance.amount).toBe(10000n);
    });

    it("should accumulate multiple credits", () => {
      const account = createAccount()
        .apply(credit(100))
        .apply(credit(50));
      expect(account.ledgerBalance.amount).toBe(15000n);
    });
  });

  describe("DEBIT", () => {
    it("should decrease both ledger and available balance", () => {
      const account = createAccount()
        .apply(credit(100))
        .apply(debit(30));
      expect(account.ledgerBalance.amount).toBe(7000n);
      expect(account.availableBalance.amount).toBe(7000n);
    });

    it("should reject debit exceeding available", () => {
      const account = createAccount().apply(credit(100));
      expect(() => account.apply(debit(150))).toThrow("INSUFFICIENT_FUNDS");
    });

    it("should allow debit to zero", () => {
      const account = createAccount()
        .apply(credit(100))
        .apply(debit(100));
      expect(account.ledgerBalance.amount).toBe(0n);
    });
  });

  describe("HOLD_PLACED", () => {
    it("should decrease available but not ledger", () => {
      const account = createAccount()
        .apply(credit(100))
        .apply(holdPlaced(30, "HOLD-001"));
      expect(account.ledgerBalance.amount).toBe(10000n);
      expect(account.availableBalance.amount).toBe(7000n);
    });

    it("should add hold to holds list", () => {
      const account = createAccount()
        .apply(credit(100))
        .apply(holdPlaced(30, "HOLD-001"));
      expect(account.holds).toHaveLength(1);
      expect(account.holds[0].id).toBe("HOLD-001");
    });

    it("should reject duplicate hold IDs", () => {
      const account = createAccount()
        .apply(credit(100))
        .apply(holdPlaced(30, "HOLD-001"));
      expect(() => account.apply(holdPlaced(20, "HOLD-001"))).toThrow("HOLD_ALREADY_EXISTS");
    });

    it("should reject hold exceeding available", () => {
      const account = createAccount().apply(credit(100));
      expect(() => account.apply(holdPlaced(150, "HOLD-001"))).toThrow("INSUFFICIENT_FUNDS");
    });
  });

  describe("HOLD_RELEASED", () => {
    it("should increase available but not ledger", () => {
      const account = createAccount()
        .apply(credit(100))
        .apply(holdPlaced(30, "HOLD-001"))
        .apply(holdReleased("HOLD-001"));
      expect(account.ledgerBalance.amount).toBe(10000n);
      expect(account.availableBalance.amount).toBe(10000n);
    });

    it("should remove hold from holds list", () => {
      const account = createAccount()
        .apply(credit(100))
        .apply(holdPlaced(30, "HOLD-001"))
        .apply(holdReleased("HOLD-001"));
      expect(account.holds).toHaveLength(0);
    });

    it("should reject releasing non-existent hold", () => {
      const account = createAccount().apply(credit(100));
      expect(() => account.apply(holdReleased("HOLD-999"))).toThrow("HOLD_NOT_FOUND");
    });
  });

  describe("INTEREST_ACCRUED", () => {
    it("should increase both ledger and available", () => {
      const account = createAccount()
        .apply(credit(1000))
        .apply(interestAccrued(5));
      expect(account.ledgerBalance.amount).toBe(100500n);
      expect(account.availableBalance.amount).toBe(100500n);
    });
  });
});

// =============================================================================
// 3. INVARIANT VIOLATION TESTS
// =============================================================================

describe("Invariant Violations", () => {
  describe("Account Closed", () => {
    it("should reject all postings on closed account", () => {
      const account = DepositAccount.create("ACC-001", "AUD").close();
      const credit = Postings.credit(Money.fromDecimal(100, "AUD"));
      expect(() => account.apply(credit)).toThrow("ACCOUNT_CLOSED");
    });
  });

  describe("Cannot Close With Balance", () => {
    it("should reject closing account with balance", () => {
      const account = DepositAccount.create("ACC-001", "AUD")
        .apply(Postings.credit(Money.fromDecimal(100, "AUD")));
      expect(() => account.close()).toThrow("CANNOT_CLOSE_WITH_BALANCE");
    });
  });

  describe("Cannot Close With Holds", () => {
    it("should reject closing account with holds (holds checked first)", () => {
      const account = DepositAccount.create("ACC-001", "AUD")
        .apply(Postings.credit(Money.fromDecimal(100, "AUD")))
        .apply(Postings.holdPlaced(Money.fromDecimal(100, "AUD"), "HOLD-001"));
      // Ledger is 100, available is 0, hold is 100
      // Holds are checked first, so we get CANNOT_CLOSE_WITH_HOLDS
      expect(() => account.close()).toThrow("CANNOT_CLOSE_WITH_HOLDS");
    });
  });

  describe("validateAccountState", () => {
    it("should pass for valid account", () => {
      const account = DepositAccount.create("ACC-001", "AUD")
        .apply(Postings.credit(Money.fromDecimal(100, "AUD")))
        .apply(Postings.holdPlaced(Money.fromDecimal(30, "AUD"), "HOLD-001"));
      expect(() => validateAccountState(account)).not.toThrow();
    });
  });
});

// =============================================================================
// 4. REPLAY DETERMINISM TESTS
// =============================================================================

describe("Replay Determinism", () => {
  it("should produce identical state from same postings", () => {
    const postings: Posting[] = [
      Postings.credit(Money.fromDecimal(1000, "AUD"), "INIT", "2024-01-01T00:00:00Z"),
      Postings.holdPlaced(Money.fromDecimal(200, "AUD"), "HOLD-001", "Payment", "2024-01-02T00:00:00Z"),
      Postings.debit(Money.fromDecimal(300, "AUD"), "PURCHASE", "2024-01-03T00:00:00Z"),
      Postings.interestAccrued(Money.fromDecimal(5, "AUD"), "2024-01", "2024-01-31T00:00:00Z"),
      Postings.holdReleased("HOLD-001", "2024-02-01T00:00:00Z"),
    ];

    // Run 1
    const account1 = DepositAccount.create("ACC-001", "AUD").applyAll(postings);

    // Run 2 (same postings)
    const account2 = DepositAccount.create("ACC-001", "AUD").applyAll(postings);

    // Must be identical
    expect(account1.deepEquals(account2)).toBe(true);
    expect(account1.ledgerBalance.amount).toBe(account2.ledgerBalance.amount);
    expect(account1.availableBalance.amount).toBe(account2.availableBalance.amount);
    expect(account1.holds.length).toBe(account2.holds.length);
  });

  it("should produce different state from different posting order", () => {
    // Order matters for holds
    const account1 = DepositAccount.create("ACC-001", "AUD")
      .apply(Postings.credit(Money.fromDecimal(100, "AUD")))
      .apply(Postings.holdPlaced(Money.fromDecimal(50, "AUD"), "HOLD-001"));

    const account2 = DepositAccount.create("ACC-001", "AUD")
      .apply(Postings.credit(Money.fromDecimal(100, "AUD")))
      .apply(Postings.holdPlaced(Money.fromDecimal(30, "AUD"), "HOLD-001"));

    expect(account1.deepEquals(account2)).toBe(false);
  });
});

// =============================================================================
// 5. EVENT SOURCING TESTS
// =============================================================================

describe("Event Sourcing", () => {
  describe("rebuildFromFacts", () => {
    it("should rebuild account from facts", () => {
      const facts = [
        Facts.accountOpened("ACC-001", "AUD", "2024-01-01T00:00:00Z"),
        Facts.postingApplied(
          "ACC-001",
          Postings.credit(Money.fromDecimal(1000, "AUD")),
          1,
          "2024-01-01T00:00:00Z"
        ),
        Facts.postingApplied(
          "ACC-001",
          Postings.holdPlaced(Money.fromDecimal(200, "AUD"), "HOLD-001"),
          2,
          "2024-01-02T00:00:00Z"
        ),
      ];

      const account = rebuildFromFacts(facts);
      expect(account).not.toBeNull();
      expect(account!.id).toBe("ACC-001");
      expect(account!.ledgerBalance.amount).toBe(100000n);
      expect(account!.availableBalance.amount).toBe(80000n);
      expect(account!.holds).toHaveLength(1);
    });

    it("should return null for empty facts", () => {
      expect(rebuildFromFacts([])).toBeNull();
    });

    it("should throw for invalid first fact", () => {
      const facts = [
        Facts.postingApplied(
          "ACC-001",
          Postings.credit(Money.fromDecimal(100, "AUD")),
          1
        ),
      ];
      expect(() => rebuildFromFacts(facts)).toThrow("First fact must be ACCOUNT_OPENED");
    });

    it("should handle account closure", () => {
      const facts = [
        Facts.accountOpened("ACC-001", "AUD"),
        Facts.accountClosed("ACC-001"),
      ];

      const account = rebuildFromFacts(facts);
      expect(account!.isClosed()).toBe(true);
    });
  });

  describe("validateFactSequence", () => {
    it("should validate correct sequence", () => {
      const facts = [
        Facts.accountOpened("ACC-001", "AUD"),
        Facts.postingApplied("ACC-001", Postings.credit(Money.fromDecimal(100, "AUD")), 1),
        Facts.postingApplied("ACC-001", Postings.debit(Money.fromDecimal(50, "AUD")), 2),
      ];
      expect(validateFactSequence(facts)).toBe(true);
    });

    it("should reject facts after account closed", () => {
      const facts = [
        Facts.accountOpened("ACC-001", "AUD"),
        Facts.accountClosed("ACC-001"),
        Facts.postingApplied("ACC-001", Postings.credit(Money.fromDecimal(100, "AUD")), 1),
      ];
      expect(() => validateFactSequence(facts)).toThrow("No facts allowed after ACCOUNT_CLOSED");
    });

    it("should reject non-monotonic sequences", () => {
      const facts = [
        Facts.accountOpened("ACC-001", "AUD"),
        Facts.postingApplied("ACC-001", Postings.credit(Money.fromDecimal(100, "AUD")), 2),
        Facts.postingApplied("ACC-001", Postings.debit(Money.fromDecimal(50, "AUD")), 1),
      ];
      expect(() => validateFactSequence(facts)).toThrow("Posting sequence must be monotonic");
    });
  });
});

// =============================================================================
// 6. SERIALIZATION TESTS
// =============================================================================

describe("Serialization", () => {
  it("should round-trip account through JSON", () => {
    const original = DepositAccount.create("ACC-001", "AUD")
      .apply(Postings.credit(Money.fromDecimal(1000, "AUD")))
      .apply(Postings.holdPlaced(Money.fromDecimal(200, "AUD"), "HOLD-001"));

    const json = original.toJSON();
    const restored = DepositAccount.fromJSON(json);

    expect(restored.deepEquals(original)).toBe(true);
  });

  it("should serialize closed account", () => {
    const original = DepositAccount.create("ACC-001", "AUD").close();
    const json = original.toJSON();
    const restored = DepositAccount.fromJSON(json);

    expect(restored.isClosed()).toBe(true);
  });
});

// =============================================================================
// 7. canApplyPosting TESTS
// =============================================================================

describe("canApplyPosting", () => {
  it("should return true for valid posting", () => {
    const account = DepositAccount.create("ACC-001", "AUD")
      .apply(Postings.credit(Money.fromDecimal(100, "AUD")));
    const posting = Postings.debit(Money.fromDecimal(50, "AUD"));
    expect(canApplyPosting(account, posting)).toBe(true);
  });

  it("should return false for invalid posting", () => {
    const account = DepositAccount.create("ACC-001", "AUD")
      .apply(Postings.credit(Money.fromDecimal(100, "AUD")));
    const posting = Postings.debit(Money.fromDecimal(150, "AUD"));
    expect(canApplyPosting(account, posting)).toBe(false);
  });
});
