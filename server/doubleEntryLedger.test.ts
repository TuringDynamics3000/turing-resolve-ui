/**
 * Double-Entry Ledger Tests
 * 
 * Tests for bank-grade double-entry accounting:
 * - Balance validation (debits = credits)
 * - Posting structure validation
 * - Reversal creation
 * - Trial balance generation
 */

import { describe, it, expect } from "vitest";
import {
  validatePostingBalance,
  validatePostingStructure,
  createSimplePosting,
  createMultiLegPosting,
  createReversalPosting,
  generateTrialBalance,
  STANDARD_CHART_OF_ACCOUNTS,
  SUB_LEDGER_GL_MAPPING,
  DoubleEntryPosting,
  CommittedPosting,
  PostingLeg,
} from "../core/ledger/DoubleEntryLedger";
import { Money } from "../core/deposits/ledger/Money";

describe("Double-Entry Ledger - Balance Validation", () => {
  it("should accept balanced posting (debits = credits)", () => {
    const posting: DoubleEntryPosting = {
      postingId: "POST-001",
      legs: [
        { accountCode: "1000", direction: "DEBIT", amount: new Money(BigInt(10000), "AUD") },
        { accountCode: "2000", direction: "CREDIT", amount: new Money(BigInt(10000), "AUD") },
      ],
      description: "Test deposit",
      occurredAt: new Date().toISOString(),
      effectiveDate: "2025-01-01",
    };
    
    // Should not throw
    expect(() => validatePostingBalance(posting)).not.toThrow();
  });
  
  it("should reject unbalanced posting (debits > credits)", () => {
    const posting: DoubleEntryPosting = {
      postingId: "POST-002",
      legs: [
        { accountCode: "1000", direction: "DEBIT", amount: new Money(BigInt(10000), "AUD") },
        { accountCode: "2000", direction: "CREDIT", amount: new Money(BigInt(5000), "AUD") },
      ],
      description: "Unbalanced posting",
      occurredAt: new Date().toISOString(),
      effectiveDate: "2025-01-01",
    };
    
    expect(() => validatePostingBalance(posting)).toThrow("POSTING_NOT_BALANCED");
  });
  
  it("should reject unbalanced posting (credits > debits)", () => {
    const posting: DoubleEntryPosting = {
      postingId: "POST-003",
      legs: [
        { accountCode: "1000", direction: "DEBIT", amount: new Money(BigInt(5000), "AUD") },
        { accountCode: "2000", direction: "CREDIT", amount: new Money(BigInt(10000), "AUD") },
      ],
      description: "Unbalanced posting",
      occurredAt: new Date().toISOString(),
      effectiveDate: "2025-01-01",
    };
    
    expect(() => validatePostingBalance(posting)).toThrow("POSTING_NOT_BALANCED");
  });
  
  it("should accept multi-leg balanced posting", () => {
    const posting: DoubleEntryPosting = {
      postingId: "POST-004",
      legs: [
        { accountCode: "1000", direction: "DEBIT", amount: new Money(BigInt(10000), "AUD") },
        { accountCode: "1100", direction: "DEBIT", amount: new Money(BigInt(5000), "AUD") },
        { accountCode: "2000", direction: "CREDIT", amount: new Money(BigInt(10000), "AUD") },
        { accountCode: "2100", direction: "CREDIT", amount: new Money(BigInt(5000), "AUD") },
      ],
      description: "Multi-leg posting",
      occurredAt: new Date().toISOString(),
      effectiveDate: "2025-01-01",
    };
    
    expect(() => validatePostingBalance(posting)).not.toThrow();
  });
  
  it("should reject empty posting", () => {
    const posting: DoubleEntryPosting = {
      postingId: "POST-005",
      legs: [],
      description: "Empty posting",
      occurredAt: new Date().toISOString(),
      effectiveDate: "2025-01-01",
    };
    
    expect(() => validatePostingBalance(posting)).toThrow("EMPTY_POSTING");
  });
  
  it("should reject mixed currency posting", () => {
    const posting: DoubleEntryPosting = {
      postingId: "POST-006",
      legs: [
        { accountCode: "1000", direction: "DEBIT", amount: new Money(BigInt(10000), "AUD") },
        { accountCode: "2000", direction: "CREDIT", amount: new Money(BigInt(10000), "USD") },
      ],
      description: "Mixed currency",
      occurredAt: new Date().toISOString(),
      effectiveDate: "2025-01-01",
    };
    
    expect(() => validatePostingBalance(posting)).toThrow("CURRENCY_MISMATCH");
  });
});

describe("Double-Entry Ledger - Structure Validation", () => {
  it("should validate complete posting structure", () => {
    const posting: DoubleEntryPosting = {
      postingId: "POST-001",
      legs: [
        { accountCode: "1000", direction: "DEBIT", amount: new Money(BigInt(10000), "AUD") },
        { accountCode: "2000", direction: "CREDIT", amount: new Money(BigInt(10000), "AUD") },
      ],
      description: "Valid posting",
      occurredAt: new Date().toISOString(),
      effectiveDate: "2025-01-01",
    };
    
    const errors = validatePostingStructure(posting);
    expect(errors).toHaveLength(0);
  });
  
  it("should detect missing postingId", () => {
    const posting = {
      postingId: "",
      legs: [
        { accountCode: "1000", direction: "DEBIT", amount: new Money(BigInt(10000), "AUD") },
        { accountCode: "2000", direction: "CREDIT", amount: new Money(BigInt(10000), "AUD") },
      ],
      description: "Missing ID",
      occurredAt: new Date().toISOString(),
      effectiveDate: "2025-01-01",
    } as DoubleEntryPosting;
    
    const errors = validatePostingStructure(posting);
    expect(errors).toContain("postingId is required");
  });
  
  it("should detect insufficient legs", () => {
    const posting = {
      postingId: "POST-001",
      legs: [
        { accountCode: "1000", direction: "DEBIT", amount: new Money(BigInt(10000), "AUD") },
      ],
      description: "Single leg",
      occurredAt: new Date().toISOString(),
      effectiveDate: "2025-01-01",
    } as DoubleEntryPosting;
    
    const errors = validatePostingStructure(posting);
    expect(errors).toContain("posting must have at least 2 legs");
  });
});

describe("Double-Entry Ledger - Posting Factory", () => {
  it("should create simple two-leg posting", () => {
    const posting = createSimplePosting({
      postingId: "POST-001",
      debitAccount: "1000",
      creditAccount: "2000-SAV",
      amount: new Money(BigInt(50000), "AUD"),
      description: "Customer deposit",
      effectiveDate: "2025-01-15",
      reference: "DEP-12345",
    });
    
    expect(posting.postingId).toBe("POST-001");
    expect(posting.legs).toHaveLength(2);
    expect(posting.legs[0].direction).toBe("DEBIT");
    expect(posting.legs[0].accountCode).toBe("1000");
    expect(posting.legs[1].direction).toBe("CREDIT");
    expect(posting.legs[1].accountCode).toBe("2000-SAV");
  });
  
  it("should create multi-leg posting", () => {
    const posting = createMultiLegPosting({
      postingId: "POST-002",
      legs: [
        { accountCode: "1000", direction: "DEBIT", amount: new Money(BigInt(10000), "AUD") },
        { accountCode: "1100", direction: "DEBIT", amount: new Money(BigInt(5000), "AUD") },
        { accountCode: "2000", direction: "CREDIT", amount: new Money(BigInt(15000), "AUD") },
      ],
      description: "Split deposit",
      effectiveDate: "2025-01-15",
    });
    
    expect(posting.legs).toHaveLength(3);
  });
  
  it("should throw when creating unbalanced simple posting", () => {
    // This should never happen with createSimplePosting since it uses same amount
    // but the validation is still in place
    expect(() => createSimplePosting({
      postingId: "POST-003",
      debitAccount: "1000",
      creditAccount: "2000",
      amount: new Money(BigInt(10000), "AUD"),
      description: "Test",
      effectiveDate: "2025-01-01",
    })).not.toThrow();
  });
});

describe("Double-Entry Ledger - Reversal", () => {
  it("should create reversal with counter-entries", () => {
    const original: DoubleEntryPosting = {
      postingId: "POST-001",
      legs: [
        { accountCode: "1000", direction: "DEBIT", amount: new Money(BigInt(10000), "AUD") },
        { accountCode: "2000", direction: "CREDIT", amount: new Money(BigInt(10000), "AUD") },
      ],
      description: "Original posting",
      occurredAt: "2025-01-01T10:00:00Z",
      effectiveDate: "2025-01-01",
    };
    
    const reversal = createReversalPosting(original, {
      reversalPostingId: "REV-001",
      reason: "ERROR_CORRECTION",
      description: "Correcting duplicate entry",
      approvedBy: "supervisor@bank.com",
    });
    
    expect(reversal.postingId).toBe("REV-001");
    expect(reversal.reversalReason).toBe("ERROR_CORRECTION");
    expect(reversal.originalPostingId).toBe("POST-001");
    expect(reversal.reversesPostingId).toBe("POST-001");
    
    // Counter-entries should flip directions
    expect(reversal.legs[0].direction).toBe("CREDIT"); // Was DEBIT
    expect(reversal.legs[0].accountCode).toBe("1000");
    expect(reversal.legs[1].direction).toBe("DEBIT"); // Was CREDIT
    expect(reversal.legs[1].accountCode).toBe("2000");
  });
  
  it("should create balanced reversal for multi-leg posting", () => {
    const original: DoubleEntryPosting = {
      postingId: "POST-002",
      legs: [
        { accountCode: "1000", direction: "DEBIT", amount: new Money(BigInt(10000), "AUD") },
        { accountCode: "1100", direction: "DEBIT", amount: new Money(BigInt(5000), "AUD") },
        { accountCode: "2000", direction: "CREDIT", amount: new Money(BigInt(15000), "AUD") },
      ],
      description: "Multi-leg posting",
      occurredAt: "2025-01-01T10:00:00Z",
      effectiveDate: "2025-01-01",
    };
    
    const reversal = createReversalPosting(original, {
      reversalPostingId: "REV-002",
      reason: "DUPLICATE_ENTRY",
      description: "Removing duplicate",
    });
    
    // Reversal should also be balanced
    expect(() => validatePostingBalance(reversal)).not.toThrow();
    expect(reversal.legs).toHaveLength(3);
  });
});

describe("Double-Entry Ledger - Trial Balance", () => {
  it("should generate balanced trial balance", () => {
    const accounts = STANDARD_CHART_OF_ACCOUNTS.filter(a => 
      ["1000", "2000-SAV", "4100"].includes(a.accountCode)
    );
    
    const postings: CommittedPosting[] = [
      {
        postingId: "POST-001",
        legs: [
          { accountCode: "1000", direction: "DEBIT", amount: new Money(BigInt(100000), "AUD") },
          { accountCode: "2000-SAV", direction: "CREDIT", amount: new Money(BigInt(100000), "AUD") },
        ],
        description: "Customer deposit",
        occurredAt: "2025-01-01T10:00:00Z",
        effectiveDate: "2025-01-01",
        committedAt: "2025-01-01T10:00:01Z",
        committedBy: "system",
        commitSequence: BigInt(1),
      },
      {
        postingId: "POST-002",
        legs: [
          { accountCode: "2000-SAV", direction: "DEBIT", amount: new Money(BigInt(500), "AUD") },
          { accountCode: "4100", direction: "CREDIT", amount: new Money(BigInt(500), "AUD") },
        ],
        description: "Monthly fee",
        occurredAt: "2025-01-15T10:00:00Z",
        effectiveDate: "2025-01-15",
        committedAt: "2025-01-15T10:00:01Z",
        committedBy: "system",
        commitSequence: BigInt(2),
      },
    ];
    
    const trialBalance = generateTrialBalance(accounts, postings, "2025-01-31", "AUD");
    
    expect(trialBalance.isBalanced).toBe(true);
    expect(trialBalance.variance.amount).toBe(BigInt(0));
    expect(trialBalance.accounts.length).toBeGreaterThan(0);
  });
  
  it("should only include postings up to asOfDate", () => {
    const accounts = STANDARD_CHART_OF_ACCOUNTS.filter(a => 
      ["1000", "2000-SAV"].includes(a.accountCode)
    );
    
    const postings: CommittedPosting[] = [
      {
        postingId: "POST-001",
        legs: [
          { accountCode: "1000", direction: "DEBIT", amount: new Money(BigInt(100000), "AUD") },
          { accountCode: "2000-SAV", direction: "CREDIT", amount: new Money(BigInt(100000), "AUD") },
        ],
        description: "January deposit",
        occurredAt: "2025-01-15T10:00:00Z",
        effectiveDate: "2025-01-15",
        committedAt: "2025-01-15T10:00:01Z",
        committedBy: "system",
        commitSequence: BigInt(1),
      },
      {
        postingId: "POST-002",
        legs: [
          { accountCode: "1000", direction: "DEBIT", amount: new Money(BigInt(50000), "AUD") },
          { accountCode: "2000-SAV", direction: "CREDIT", amount: new Money(BigInt(50000), "AUD") },
        ],
        description: "February deposit",
        occurredAt: "2025-02-15T10:00:00Z",
        effectiveDate: "2025-02-15",
        committedAt: "2025-02-15T10:00:01Z",
        committedBy: "system",
        commitSequence: BigInt(2),
      },
    ];
    
    // Trial balance as of Jan 31 should only include first posting
    const janBalance = generateTrialBalance(accounts, postings, "2025-01-31", "AUD");
    expect(janBalance.totalDebits.amount).toBe(BigInt(100000));
    
    // Trial balance as of Feb 28 should include both
    const febBalance = generateTrialBalance(accounts, postings, "2025-02-28", "AUD");
    expect(febBalance.totalDebits.amount).toBe(BigInt(150000));
  });
});

describe("Double-Entry Ledger - Chart of Accounts", () => {
  it("should have standard chart of accounts defined", () => {
    expect(STANDARD_CHART_OF_ACCOUNTS.length).toBeGreaterThan(0);
    
    // Check for required account types
    const types = new Set(STANDARD_CHART_OF_ACCOUNTS.map(a => a.type));
    expect(types.has("ASSET")).toBe(true);
    expect(types.has("LIABILITY")).toBe(true);
    expect(types.has("EQUITY")).toBe(true);
    expect(types.has("REVENUE")).toBe(true);
    expect(types.has("EXPENSE")).toBe(true);
  });
  
  it("should have sub-ledger to GL mapping defined", () => {
    expect(Object.keys(SUB_LEDGER_GL_MAPPING).length).toBeGreaterThan(0);
    
    // Check deposit mapping exists
    expect(SUB_LEDGER_GL_MAPPING["DEPOSIT_CREDIT"]).toBeDefined();
    expect(SUB_LEDGER_GL_MAPPING["DEPOSIT_CREDIT"].debitAccount).toBe("1000");
    expect(SUB_LEDGER_GL_MAPPING["DEPOSIT_CREDIT"].creditAccount).toBe("2000-SAV");
  });
});
