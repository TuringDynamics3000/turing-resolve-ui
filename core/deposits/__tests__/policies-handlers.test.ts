/**
 * Policies and Handlers - Comprehensive Tests
 * 
 * Test Categories:
 * 1. Policy purity tests (no side effects)
 * 2. Policy recommendation tests
 * 3. Handler orchestration tests
 * 4. End-to-end flow tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  Money,
  DepositAccount,
  Postings,
  Facts,
  rebuildFromFacts,
} from "../index";
import {
  FeePolicyV1,
  InterestPolicyV1,
  HoldPolicyV1,
  PolicyContext,
  evaluatePolicies,
  aggregatePostings,
} from "../../../policies/deposits";
import {
  OpenAccountHandler,
  ApplyPostingHandler,
  CloseAccountHandler,
  InMemoryFactStore,
  HandlerContext,
} from "../../../application/deposits";

// =============================================================================
// 1. POLICY PURITY TESTS
// =============================================================================

describe("Policy Purity", () => {
  const feePolicy = new FeePolicyV1();
  const interestPolicy = new InterestPolicyV1();
  const holdPolicy = new HoldPolicyV1();
  
  const baseContext: PolicyContext = {
    asOf: "2024-12-16T10:00:00Z",
    accountId: "ACC-001",
    productType: "savings",
    currency: "AUD",
    customerSegment: "standard",
  };
  
  it("FeePolicy should be deterministic", () => {
    const facts = [
      Facts.accountOpened("ACC-001", "AUD", "2024-01-01T00:00:00Z"),
      Facts.postingApplied(
        "ACC-001",
        Postings.credit(Money.fromDecimal(1000, "AUD")),
        1,
        "2024-01-01T00:00:00Z"
      ),
    ];
    
    // Run twice with same inputs
    const result1 = feePolicy.evaluate(facts, baseContext);
    const result2 = feePolicy.evaluate(facts, baseContext);
    
    // Must be identical
    expect(result1.postings.length).toBe(result2.postings.length);
    expect(result1.explanation).toBe(result2.explanation);
  });
  
  it("InterestPolicy should be deterministic", () => {
    const facts = [
      Facts.accountOpened("ACC-001", "AUD", "2024-01-01T00:00:00Z"),
      Facts.postingApplied(
        "ACC-001",
        Postings.credit(Money.fromDecimal(10000, "AUD")),
        1,
        "2024-01-01T00:00:00Z"
      ),
    ];
    
    const result1 = interestPolicy.evaluate(facts, baseContext);
    const result2 = interestPolicy.evaluate(facts, baseContext);
    
    expect(result1.postings.length).toBe(result2.postings.length);
    if (result1.postings.length > 0 && result2.postings.length > 0) {
      expect(result1.postings[0].type).toBe(result2.postings[0].type);
    }
  });
  
  it("Policies should not mutate input facts", () => {
    const facts = [
      Facts.accountOpened("ACC-001", "AUD", "2024-01-01T00:00:00Z"),
    ];
    const factsCopy = JSON.stringify(facts);
    
    feePolicy.evaluate(facts, baseContext);
    interestPolicy.evaluate(facts, baseContext);
    holdPolicy.evaluate(facts, baseContext);
    
    // Facts should be unchanged
    expect(JSON.stringify(facts)).toBe(factsCopy);
  });
});

// =============================================================================
// 2. POLICY RECOMMENDATION TESTS
// =============================================================================

describe("FeePolicy Recommendations", () => {
  const feePolicy = new FeePolicyV1();
  
  it("should waive fees for premium customers", () => {
    const facts = [
      Facts.accountOpened("ACC-001", "AUD", "2024-01-01T00:00:00Z"),
      Facts.postingApplied(
        "ACC-001",
        Postings.credit(Money.fromDecimal(100, "AUD")),
        1,
        "2024-01-01T00:00:00Z"
      ),
    ];
    
    const context: PolicyContext = {
      asOf: "2024-12-16T10:00:00Z",
      accountId: "ACC-001",
      productType: "checking",
      currency: "AUD",
      customerSegment: "premium",
    };
    
    const result = feePolicy.evaluate(facts, context);
    
    expect(result.postings).toHaveLength(0);
    expect(result.explanation).toContain("waived");
  });
  
  it("should recommend maintenance fee for low balance checking", () => {
    const facts = [
      Facts.accountOpened("ACC-001", "AUD", "2024-01-01T00:00:00Z"),
      Facts.postingApplied(
        "ACC-001",
        Postings.credit(Money.fromDecimal(100, "AUD")),
        1,
        "2024-01-01T00:00:00Z"
      ),
    ];
    
    const context: PolicyContext = {
      asOf: "2024-12-16T10:00:00Z",
      accountId: "ACC-001",
      productType: "checking",
      currency: "AUD",
      customerSegment: "standard",
    };
    
    const result = feePolicy.evaluate(facts, context);
    
    // Should have maintenance fee and low balance fee
    expect(result.postings.length).toBeGreaterThan(0);
    expect(result.mandatory).toBe(true);
  });
});

describe("InterestPolicy Recommendations", () => {
  const interestPolicy = new InterestPolicyV1();
  
  it("should recommend interest for savings account", () => {
    const facts = [
      Facts.accountOpened("ACC-001", "AUD", "2024-01-01T00:00:00Z"),
      Facts.postingApplied(
        "ACC-001",
        Postings.credit(Money.fromDecimal(10000, "AUD")),
        1,
        "2024-01-01T00:00:00Z"
      ),
    ];
    
    const context: PolicyContext = {
      asOf: "2024-12-16T10:00:00Z",
      accountId: "ACC-001",
      productType: "savings",
      currency: "AUD",
    };
    
    const result = interestPolicy.evaluate(facts, context);
    
    expect(result.postings).toHaveLength(1);
    expect(result.postings[0].type).toBe("INTEREST_ACCRUED");
    expect(result.explanation).toContain("3.75%"); // Base 3.50% + 0.25% tier bonus for $10k+
  });
  
  it("should skip interest for balance below minimum", () => {
    const facts = [
      Facts.accountOpened("ACC-001", "AUD", "2024-01-01T00:00:00Z"),
      Facts.postingApplied(
        "ACC-001",
        Postings.credit(Money.fromDecimal(0.50, "AUD")),
        1,
        "2024-01-01T00:00:00Z"
      ),
    ];
    
    const context: PolicyContext = {
      asOf: "2024-12-16T10:00:00Z",
      accountId: "ACC-001",
      productType: "savings",
      currency: "AUD",
    };
    
    const result = interestPolicy.evaluate(facts, context);
    
    expect(result.postings).toHaveLength(0);
    expect(result.explanation).toContain("below minimum");
  });
});

// =============================================================================
// 3. HANDLER ORCHESTRATION TESTS
// =============================================================================

describe("OpenAccountHandler", () => {
  let handler: OpenAccountHandler;
  let factStore: InMemoryFactStore;
  let context: HandlerContext;
  
  beforeEach(() => {
    handler = new OpenAccountHandler();
    factStore = new InMemoryFactStore();
    context = {
      factStore,
      asOf: "2024-12-16T10:00:00Z",
      correlationId: "test-123",
    };
  });
  
  it("should open a new account", async () => {
    const command = {
      commandId: "CMD-001",
      issuedAt: "2024-12-16T10:00:00Z",
      issuedBy: "system",
      accountId: "ACC-001",
      currency: "AUD",
      productType: "savings",
      customerId: "CUST-001",
    };
    
    const result = await handler.execute(command, context);
    
    expect(result.success).toBe(true);
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0].type).toBe("ACCOUNT_OPENED");
    expect(result.result?.accountId).toBe("ACC-001");
  });
  
  it("should reject duplicate account", async () => {
    const command = {
      commandId: "CMD-001",
      issuedAt: "2024-12-16T10:00:00Z",
      issuedBy: "system",
      accountId: "ACC-001",
      currency: "AUD",
      productType: "savings",
      customerId: "CUST-001",
    };
    
    // Open first time
    await handler.execute(command, context);
    
    // Try to open again
    const result = await handler.execute(
      { ...command, commandId: "CMD-002" },
      context
    );
    
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("ACCOUNT_EXISTS");
  });
  
  it("should validate command shape", async () => {
    const command = {
      commandId: "",
      issuedAt: "",
      issuedBy: "",
      accountId: "",
      currency: "",
      productType: "",
      customerId: "",
    };
    
    const result = await handler.execute(command, context);
    
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("VALIDATION_ERROR");
  });
});

describe("ApplyPostingHandler", () => {
  let openHandler: OpenAccountHandler;
  let applyHandler: ApplyPostingHandler;
  let factStore: InMemoryFactStore;
  let context: HandlerContext;
  
  beforeEach(async () => {
    openHandler = new OpenAccountHandler();
    applyHandler = new ApplyPostingHandler();
    factStore = new InMemoryFactStore();
    context = {
      factStore,
      asOf: "2024-12-16T10:00:00Z",
      correlationId: "test-123",
    };
    
    // Open an account first
    await openHandler.execute({
      commandId: "CMD-OPEN",
      issuedAt: "2024-12-16T09:00:00Z",
      issuedBy: "system",
      accountId: "ACC-001",
      currency: "AUD",
      productType: "savings",
      customerId: "CUST-001",
    }, context);
  });
  
  it("should apply credit posting", async () => {
    const command = {
      commandId: "CMD-001",
      issuedAt: "2024-12-16T10:00:00Z",
      issuedBy: "system",
      accountId: "ACC-001",
      posting: Postings.credit(Money.fromDecimal(1000, "AUD")),
      productType: "savings",
    };
    
    const result = await applyHandler.execute(command, context);
    
    expect(result.success).toBe(true);
    expect(result.appliedPostings).toHaveLength(1);
    expect(result.result?.account.ledgerBalance.amount).toBe(100000n);
  });
  
  it("should reject debit exceeding balance", async () => {
    const command = {
      commandId: "CMD-001",
      issuedAt: "2024-12-16T10:00:00Z",
      issuedBy: "system",
      accountId: "ACC-001",
      posting: Postings.debit(Money.fromDecimal(1000, "AUD")),
      productType: "savings",
    };
    
    const result = await applyHandler.execute(command, context);
    
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("POSTING_REJECTED");
  });
  
  it("should reject posting to non-existent account", async () => {
    const command = {
      commandId: "CMD-001",
      issuedAt: "2024-12-16T10:00:00Z",
      issuedBy: "system",
      accountId: "ACC-999",
      posting: Postings.credit(Money.fromDecimal(1000, "AUD")),
      productType: "savings",
    };
    
    const result = await applyHandler.execute(command, context);
    
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("ACCOUNT_NOT_FOUND");
  });
});

describe("CloseAccountHandler", () => {
  let openHandler: OpenAccountHandler;
  let applyHandler: ApplyPostingHandler;
  let closeHandler: CloseAccountHandler;
  let factStore: InMemoryFactStore;
  let context: HandlerContext;
  
  beforeEach(async () => {
    openHandler = new OpenAccountHandler();
    applyHandler = new ApplyPostingHandler();
    closeHandler = new CloseAccountHandler();
    factStore = new InMemoryFactStore();
    context = {
      factStore,
      asOf: "2024-12-16T10:00:00Z",
      correlationId: "test-123",
    };
    
    // Open an account
    await openHandler.execute({
      commandId: "CMD-OPEN",
      issuedAt: "2024-12-16T09:00:00Z",
      issuedBy: "system",
      accountId: "ACC-001",
      currency: "AUD",
      productType: "savings",
      customerId: "CUST-001",
    }, context);
  });
  
  it("should close account with zero balance", async () => {
    const command = {
      commandId: "CMD-001",
      issuedAt: "2024-12-16T10:00:00Z",
      issuedBy: "system",
      accountId: "ACC-001",
      reason: "Customer requested",
      customerInitiated: true,
    };
    
    const result = await closeHandler.execute(command, context);
    
    expect(result.success).toBe(true);
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0].type).toBe("ACCOUNT_CLOSED");
    expect(result.result?.account.isClosed()).toBe(true);
  });
  
  it("should reject closing account with balance", async () => {
    // Add balance first
    await applyHandler.execute({
      commandId: "CMD-CREDIT",
      issuedAt: "2024-12-16T09:30:00Z",
      issuedBy: "system",
      accountId: "ACC-001",
      posting: Postings.credit(Money.fromDecimal(100, "AUD")),
      productType: "savings",
    }, context);
    
    const command = {
      commandId: "CMD-001",
      issuedAt: "2024-12-16T10:00:00Z",
      issuedBy: "system",
      accountId: "ACC-001",
      reason: "Customer requested",
      customerInitiated: true,
    };
    
    const result = await closeHandler.execute(command, context);
    
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("CLOSURE_REJECTED");
  });
});

// =============================================================================
// 4. END-TO-END FLOW TESTS
// =============================================================================

describe("End-to-End Flows", () => {
  let openHandler: OpenAccountHandler;
  let applyHandler: ApplyPostingHandler;
  let closeHandler: CloseAccountHandler;
  let factStore: InMemoryFactStore;
  let context: HandlerContext;
  
  beforeEach(() => {
    openHandler = new OpenAccountHandler();
    applyHandler = new ApplyPostingHandler();
    closeHandler = new CloseAccountHandler();
    factStore = new InMemoryFactStore();
    context = {
      factStore,
      asOf: "2024-12-16T10:00:00Z",
      correlationId: "test-123",
    };
  });
  
  it("should handle complete account lifecycle", async () => {
    // 1. Open account
    const openResult = await openHandler.execute({
      commandId: "CMD-OPEN",
      issuedAt: "2024-12-16T09:00:00Z",
      issuedBy: "system",
      accountId: "ACC-001",
      currency: "AUD",
      productType: "savings",
      customerId: "CUST-001",
    }, context);
    expect(openResult.success).toBe(true);
    
    // 2. Credit account
    const creditResult = await applyHandler.execute({
      commandId: "CMD-CREDIT",
      issuedAt: "2024-12-16T09:30:00Z",
      issuedBy: "system",
      accountId: "ACC-001",
      posting: Postings.credit(Money.fromDecimal(1000, "AUD")),
      productType: "savings",
    }, context);
    expect(creditResult.success).toBe(true);
    expect(creditResult.result?.account.ledgerBalance.amount).toBe(100000n);
    
    // 3. Place hold
    const holdResult = await applyHandler.execute({
      commandId: "CMD-HOLD",
      issuedAt: "2024-12-16T10:00:00Z",
      issuedBy: "system",
      accountId: "ACC-001",
      posting: Postings.holdPlaced(Money.fromDecimal(200, "AUD"), "HOLD-001"),
      productType: "savings",
    }, context);
    expect(holdResult.success).toBe(true);
    expect(holdResult.result?.account.availableBalance.amount).toBe(80000n);
    
    // 4. Release hold
    const releaseResult = await applyHandler.execute({
      commandId: "CMD-RELEASE",
      issuedAt: "2024-12-16T11:00:00Z",
      issuedBy: "system",
      accountId: "ACC-001",
      posting: Postings.holdReleased("HOLD-001"),
      productType: "savings",
    }, context);
    expect(releaseResult.success).toBe(true);
    expect(releaseResult.result?.account.availableBalance.amount).toBe(100000n);
    
    // 5. Debit full balance
    const debitResult = await applyHandler.execute({
      commandId: "CMD-DEBIT",
      issuedAt: "2024-12-16T12:00:00Z",
      issuedBy: "system",
      accountId: "ACC-001",
      posting: Postings.debit(Money.fromDecimal(1000, "AUD")),
      productType: "savings",
    }, context);
    expect(debitResult.success).toBe(true);
    expect(debitResult.result?.account.ledgerBalance.amount).toBe(0n);
    
    // 6. Close account
    const closeResult = await closeHandler.execute({
      commandId: "CMD-CLOSE",
      issuedAt: "2024-12-16T13:00:00Z",
      issuedBy: "system",
      accountId: "ACC-001",
      reason: "Customer requested",
      customerInitiated: true,
    }, context);
    expect(closeResult.success).toBe(true);
    expect(closeResult.result?.account.isClosed()).toBe(true);
    
    // 7. Verify facts
    const allFacts = factStore.getAllFacts();
    expect(allFacts).toHaveLength(6);
    expect(allFacts[0].type).toBe("ACCOUNT_OPENED");
    expect(allFacts[5].type).toBe("ACCOUNT_CLOSED");
  });
  
  it("should rebuild identical state from facts", async () => {
    // Create some state
    await openHandler.execute({
      commandId: "CMD-OPEN",
      issuedAt: "2024-12-16T09:00:00Z",
      issuedBy: "system",
      accountId: "ACC-001",
      currency: "AUD",
      productType: "savings",
      customerId: "CUST-001",
    }, context);
    
    await applyHandler.execute({
      commandId: "CMD-CREDIT",
      issuedAt: "2024-12-16T09:30:00Z",
      issuedBy: "system",
      accountId: "ACC-001",
      posting: Postings.credit(Money.fromDecimal(5000, "AUD")),
      productType: "savings",
    }, context);
    
    await applyHandler.execute({
      commandId: "CMD-HOLD",
      issuedAt: "2024-12-16T10:00:00Z",
      issuedBy: "system",
      accountId: "ACC-001",
      posting: Postings.holdPlaced(Money.fromDecimal(1000, "AUD"), "HOLD-001"),
      productType: "savings",
    }, context);
    
    // Get facts
    const facts = await factStore.loadFacts("ACC-001");
    
    // Rebuild state
    const account = rebuildFromFacts(facts);
    
    // Verify
    expect(account).not.toBeNull();
    expect(account!.ledgerBalance.amount).toBe(500000n);
    expect(account!.availableBalance.amount).toBe(400000n);
    expect(account!.holds).toHaveLength(1);
    expect(account!.holds[0].id).toBe("HOLD-001");
  });
});
