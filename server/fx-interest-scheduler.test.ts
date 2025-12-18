import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * FX Revaluation & Interest Posting Scheduler Tests
 * 
 * Bank-grade tests for:
 * 1. FX position tracking and revaluation
 * 2. Interest accrual automation
 * 3. EOD reconciliation
 */

function createTestContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ============================================
// FX REVALUATION TESTS
// ============================================

describe("FX Revaluation", () => {
  it("returns FX positions with sample data", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.getFXPositions();

    expect(result.positions.length).toBeGreaterThan(0);
    expect(result.totalPositions).toBeGreaterThan(0);
    
    // Check position structure
    const position = result.positions[0];
    expect(position.accountId).toBeDefined();
    expect(position.currency).toBeDefined();
    expect(position.balance).toBeDefined();
    expect(position.originalAudCost).toBeDefined();
    expect(position.currentAudValue).toBeDefined();
    expect(position.unrealizedGainLoss).toBeDefined();
  });

  it("includes multiple currencies in positions", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.getFXPositions();

    const currencies = new Set(result.positions.map(p => p.currency));
    expect(currencies.size).toBeGreaterThan(1);
    
    // Should have common currencies
    expect(currencies.has("USD")).toBe(true);
    expect(currencies.has("EUR")).toBe(true);
  });

  it("runs month-end FX revaluation", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.runFXRevaluation({
      periodEnd: "2024-12-31",
    });

    expect(result.runId).toBeDefined();
    expect(result.periodEnd).toBe("2024-12-31");
    expect(result.status).toBe("COMPLETED");
    expect(result.positionsProcessed).toBeGreaterThan(0);
    expect(result.totalUnrealizedGainLoss).toBeDefined();
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.completedAt).toBeDefined();
  });

  it("generates FX rate and movement for each position", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.runFXRevaluation({
      periodEnd: "2024-12-31",
    });

    for (const positionResult of result.results) {
      expect(positionResult.accountId).toBeDefined();
      expect(positionResult.currency).toBeDefined();
      expect(positionResult.movement).toBeDefined();
      expect(positionResult.fxRate).toBeDefined();
      expect(parseFloat(positionResult.fxRate)).toBeGreaterThan(0);
    }
  });

  it("tracks revaluation history", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Run a revaluation first
    await caller.gl.runFXRevaluation({ periodEnd: "2024-11-30" });

    const history = await caller.gl.getFXRevaluationHistory();

    expect(history.runs.length).toBeGreaterThan(0);
    
    const run = history.runs[0];
    expect(run.runId).toBeDefined();
    expect(run.periodEnd).toBeDefined();
    expect(run.status).toBe("COMPLETED");
  });
});

// ============================================
// INTEREST POSTING SCHEDULER TESTS
// ============================================

describe("Interest Posting Scheduler", () => {
  it("returns interest-bearing accounts", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.getInterestAccounts();

    expect(result.accounts.length).toBeGreaterThan(0);
    expect(result.totalAccounts).toBeGreaterThan(0);
    expect(result.activeAccounts).toBeGreaterThan(0);
    
    // Check account structure
    const account = result.accounts[0];
    expect(account.accountId).toBeDefined();
    expect(account.accountType).toBeDefined();
    expect(account.customerName).toBeDefined();
    expect(account.balance).toBeDefined();
    expect(account.annualRate).toBeDefined();
    expect(account.accruedInterest).toBeDefined();
  });

  it("includes different account types", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.getInterestAccounts();

    const accountTypes = new Set(result.accounts.map(a => a.accountType));
    
    // Should have both deposit and loan types
    expect(accountTypes.has("DEPOSIT")).toBe(true);
    expect(accountTypes.has("LOAN")).toBe(true);
  });

  it("runs daily interest accrual", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.runDailyAccrual({
      accrualDate: "2024-12-17",
    });

    expect(result.runId).toBeDefined();
    expect(result.runType).toBe("DAILY_ACCRUAL");
    expect(result.runDate).toBe("2024-12-17");
    expect(result.status).toBe("COMPLETED");
    expect(result.accountsProcessed).toBeGreaterThan(0);
    expect(result.totalInterest).toBeDefined();
    expect(result.glPostingsGenerated).toBeGreaterThan(0);
    expect(result.completedAt).toBeDefined();
  });

  it("runs interest capitalization", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Run on day 1 (common capitalization day)
    const result = await caller.gl.runCapitalization({
      capitalizationDate: "2024-12-01",
    });

    expect(result.runId).toBeDefined();
    expect(result.runType).toBe("CAPITALIZATION");
    expect(result.runDate).toBe("2024-12-01");
    expect(result.status).toBe("COMPLETED");
    expect(result.completedAt).toBeDefined();
  });

  it("runs EOD reconciliation", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // First run daily accrual
    await caller.gl.runDailyAccrual({ accrualDate: "2024-12-18" });

    // Then run reconciliation
    const result = await caller.gl.runEODReconciliation({
      reconciliationDate: "2024-12-18",
    });

    expect(result.reconciliationId).toBeDefined();
    expect(result.reconciliationDate).toBe("2024-12-18");
    expect(result.status).toBeDefined();
    expect(result.totalAccrued).toBeDefined();
    expect(result.totalPosted).toBeDefined();
    expect(result.variance).toBeDefined();
    expect(result.accountCount).toBeGreaterThan(0);
    expect(result.completedAt).toBeDefined();
  });

  it("tracks scheduler run history", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Run some operations
    await caller.gl.runDailyAccrual({ accrualDate: "2024-12-19" });
    await caller.gl.runEODReconciliation({ reconciliationDate: "2024-12-19" });

    const history = await caller.gl.getSchedulerHistory();

    expect(history.runs.length).toBeGreaterThan(0);
    expect(history.reconciliations.length).toBeGreaterThan(0);
    
    const run = history.runs[0];
    expect(run.runId).toBeDefined();
    expect(run.runType).toBeDefined();
    expect(run.status).toBe("COMPLETED");
  });
});

// ============================================
// INTEGRATION TESTS
// ============================================

describe("Scheduler Integration", () => {
  it("accrual updates account balances", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Get initial state
    const before = await caller.gl.getInterestAccounts();
    const initialAccrued = before.accounts[0].accruedInterestCents;

    // Run accrual
    await caller.gl.runDailyAccrual({ accrualDate: "2024-12-20" });

    // Check updated state
    const after = await caller.gl.getInterestAccounts();
    const finalAccrued = after.accounts[0].accruedInterestCents;

    // Accrued interest should increase
    expect(finalAccrued).toBeGreaterThan(initialAccrued);
  });

  it("FX revaluation updates position values", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Run revaluation
    const result = await caller.gl.runFXRevaluation({
      periodEnd: "2024-12-31",
    });

    // Check positions were updated
    const positions = await caller.gl.getFXPositions();
    
    for (const position of positions.positions) {
      expect(position.lastRevaluedAt).toBeDefined();
    }

    expect(result.positionsProcessed).toBe(positions.totalPositions);
  });
});
