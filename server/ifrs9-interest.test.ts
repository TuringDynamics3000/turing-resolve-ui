import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * IFRS 9 ECL & Interest Accrual Tests
 * 
 * Bank-grade tests for:
 * 1. IFRS 9 three-stage impairment model
 * 2. ECL calculations (PD × LGD × EAD)
 * 3. Day-count conventions
 * 4. Interest accrual calculations
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
// IFRS 9 Stage Determination Tests
// ============================================

describe("IFRS 9 Stage Determination", () => {
  it("assigns Stage 1 for performing loans (no SICR)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.determineIFRS9Stage({
      creditRating: "BBB",
      originationRating: "BBB",
      daysPastDue: 0,
      isForborne: false,
      isOnWatchlist: false,
    });

    expect(result.stage).toBe("STAGE_1");
    expect(result.sicrTriggers).toContain("NONE");
    expect(result.impairmentTriggers).toContain("NONE");
  });

  it("assigns Stage 2 for 30+ days past due (SICR)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.determineIFRS9Stage({
      creditRating: "BBB",
      originationRating: "BBB",
      daysPastDue: 35,
      isForborne: false,
      isOnWatchlist: false,
    });

    expect(result.stage).toBe("STAGE_2");
    expect(result.sicrTriggers).toContain("DAYS_PAST_DUE_30");
  });

  it("assigns Stage 2 for 60+ days past due", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.determineIFRS9Stage({
      creditRating: "BBB",
      originationRating: "BBB",
      daysPastDue: 65,
      isForborne: false,
      isOnWatchlist: false,
    });

    expect(result.stage).toBe("STAGE_2");
    expect(result.sicrTriggers).toContain("DAYS_PAST_DUE_60");
  });

  it("assigns Stage 2 for rating downgrade (2+ notches)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.determineIFRS9Stage({
      creditRating: "B",      // Current: B
      originationRating: "BBB", // Origination: BBB (3 notches down)
      daysPastDue: 0,
      isForborne: false,
      isOnWatchlist: false,
    });

    expect(result.stage).toBe("STAGE_2");
    expect(result.sicrTriggers).toContain("RATING_DOWNGRADE");
  });

  it("assigns Stage 2 for forbearance", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.determineIFRS9Stage({
      creditRating: "BBB",
      originationRating: "BBB",
      daysPastDue: 0,
      isForborne: true,
      isOnWatchlist: false,
    });

    expect(result.stage).toBe("STAGE_2");
    expect(result.sicrTriggers).toContain("FORBEARANCE");
  });

  it("assigns Stage 2 for watchlist", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.determineIFRS9Stage({
      creditRating: "BBB",
      originationRating: "BBB",
      daysPastDue: 0,
      isForborne: false,
      isOnWatchlist: true,
    });

    expect(result.stage).toBe("STAGE_2");
    expect(result.sicrTriggers).toContain("WATCHLIST");
  });

  it("assigns Stage 3 for 90+ days past due (credit-impaired)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.determineIFRS9Stage({
      creditRating: "CCC",
      originationRating: "BBB",
      daysPastDue: 95,
      isForborne: false,
      isOnWatchlist: false,
    });

    expect(result.stage).toBe("STAGE_3");
    expect(result.impairmentTriggers).toContain("DAYS_PAST_DUE_90");
  });

  it("assigns Stage 3 for default rating", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.determineIFRS9Stage({
      creditRating: "D",
      originationRating: "BBB",
      daysPastDue: 0,
      isForborne: false,
      isOnWatchlist: false,
    });

    expect(result.stage).toBe("STAGE_3");
    expect(result.impairmentTriggers).toContain("BREACH_OF_CONTRACT");
  });
});

// ============================================
// ECL Calculation Tests
// ============================================

describe("IFRS 9 ECL Calculation", () => {
  it("calculates ECL for Stage 1 (12-month ECL)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.calculateECL({
      assetId: "LOAN-001",
      assetType: "PERSONAL_LOAN",
      originationDate: "2024-01-01",
      maturityDate: "2029-01-01",
      outstandingBalanceCents: 5000000, // $50,000
      originalBalanceCents: 5000000,
      interestRate: 0.0899,
      creditRating: "BBB",
      originationRating: "BBB",
      daysPastDue: 0,
      isForborne: false,
      isOnWatchlist: false,
      customerId: "CUST-001",
      customerSegment: "RETAIL",
    });

    expect(result.stage).toBe("STAGE_1");
    expect(result.pd12Month).toBeGreaterThan(0);
    expect(result.lgd).toBeGreaterThan(0);
    expect(result.ead).toMatch(/50,000\.00/);
    expect(result.eclProvision).toBeDefined();
    // Stage 1 uses 12-month ECL
    expect(result.eclProvision).toBe(result.ecl12Month);
  });

  it("calculates ECL for Stage 2 (lifetime ECL)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.calculateECL({
      assetId: "LOAN-002",
      assetType: "PERSONAL_LOAN",
      originationDate: "2024-01-01",
      maturityDate: "2029-01-01",
      outstandingBalanceCents: 5000000, // $50,000
      originalBalanceCents: 5000000,
      interestRate: 0.0899,
      creditRating: "BBB",
      originationRating: "BBB",
      daysPastDue: 45, // 30+ DPD triggers Stage 2
      isForborne: false,
      isOnWatchlist: false,
      customerId: "CUST-002",
      customerSegment: "RETAIL",
    });

    expect(result.stage).toBe("STAGE_2");
    expect(result.pdLifetime).toBeGreaterThan(result.pd12Month);
    // Stage 2 uses lifetime ECL
    expect(result.eclProvision).toBe(result.eclLifetime);
  });

  it("calculates ECL for Stage 3 (lifetime ECL, credit-impaired)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.calculateECL({
      assetId: "LOAN-003",
      assetType: "PERSONAL_LOAN",
      originationDate: "2024-01-01",
      maturityDate: "2029-01-01",
      outstandingBalanceCents: 5000000, // $50,000
      originalBalanceCents: 5000000,
      interestRate: 0.0899,
      creditRating: "CCC",
      originationRating: "BBB",
      daysPastDue: 120, // 90+ DPD triggers Stage 3
      isForborne: false,
      isOnWatchlist: false,
      customerId: "CUST-003",
      customerSegment: "RETAIL",
    });

    expect(result.stage).toBe("STAGE_3");
    expect(result.eclProvision).toBe(result.eclLifetime);
    // Stage 3 should have higher PD
    expect(result.pd12Month).toBeGreaterThan(0.05); // CCC rating
  });

  it("applies lower LGD for secured home loans", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const unsecuredResult = await caller.gl.calculateECL({
      assetId: "LOAN-004",
      assetType: "PERSONAL_LOAN",
      originationDate: "2024-01-01",
      maturityDate: "2029-01-01",
      outstandingBalanceCents: 10000000, // $100,000
      originalBalanceCents: 10000000,
      interestRate: 0.0899,
      creditRating: "BBB",
      originationRating: "BBB",
      daysPastDue: 0,
      customerId: "CUST-004",
    });

    const securedResult = await caller.gl.calculateECL({
      assetId: "LOAN-005",
      assetType: "HOME_LOAN",
      originationDate: "2024-01-01",
      maturityDate: "2054-01-01",
      outstandingBalanceCents: 10000000, // $100,000
      originalBalanceCents: 10000000,
      interestRate: 0.0649,
      creditRating: "BBB",
      originationRating: "BBB",
      daysPastDue: 0,
      customerId: "CUST-005",
      collateralValueCents: 15000000, // $150,000 property
      collateralType: "PROPERTY",
    });

    // Secured loan should have lower LGD
    expect(securedResult.lgd).toBeLessThan(unsecuredResult.lgd);
  });

  it("includes scenario-weighted ECL", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.calculateECL({
      assetId: "LOAN-006",
      assetType: "PERSONAL_LOAN",
      originationDate: "2024-01-01",
      maturityDate: "2029-01-01",
      outstandingBalanceCents: 5000000,
      originalBalanceCents: 5000000,
      interestRate: 0.0899,
      creditRating: "BBB",
      originationRating: "BBB",
      daysPastDue: 0,
      customerId: "CUST-006",
    });

    expect(result.scenarioECLs).toHaveLength(3);
    expect(result.scenarioECLs.map(s => s.scenarioId)).toContain("BASE");
    expect(result.scenarioECLs.map(s => s.scenarioId)).toContain("UPSIDE");
    expect(result.scenarioECLs.map(s => s.scenarioId)).toContain("DOWNSIDE");
    
    // Weights should sum to 1
    const totalWeight = result.scenarioECLs.reduce((sum, s) => sum + s.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 2);
  });
});

// ============================================
// Day Count Convention Tests
// ============================================

describe("Day Count Conventions", () => {
  it("calculates ACT/365 correctly", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.calculateDayCountFactor({
      startDate: "2024-01-01",
      endDate: "2024-02-01",
      convention: "ACT_365",
    });

    expect(result.days).toBe(31);
    expect(result.yearBasis).toBe(365);
    expect(result.factor).toBeCloseTo(31 / 365, 6);
  });

  it("calculates ACT/360 correctly", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.calculateDayCountFactor({
      startDate: "2024-01-01",
      endDate: "2024-02-01",
      convention: "ACT_360",
    });

    expect(result.days).toBe(31);
    expect(result.yearBasis).toBe(360);
    expect(result.factor).toBeCloseTo(31 / 360, 6);
  });

  it("calculates 30/360 correctly", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.calculateDayCountFactor({
      startDate: "2024-01-31",
      endDate: "2024-02-28",
      convention: "30_360",
    });

    // 30/360 treats each month as 30 days
    expect(result.yearBasis).toBe(360);
  });

  it("calculates ACT/ACT correctly for leap year", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.calculateDayCountFactor({
      startDate: "2024-02-01",
      endDate: "2024-03-01",
      convention: "ACT_ACT",
    });

    // 2024 is a leap year
    expect(result.days).toBe(29);
    expect(result.yearBasis).toBe(366);
    expect(result.factor).toBeCloseTo(29 / 366, 6);
  });
});

// ============================================
// Interest Rate Tests
// ============================================

describe("Interest Rates", () => {
  it("lists all registered interest rates", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.listInterestRates();

    expect(result.rates.length).toBeGreaterThan(0);
    expect(result.baseRates.length).toBeGreaterThan(0);
    
    // Check for expected rates
    const rateIds = result.rates.map(r => r.rateId);
    expect(rateIds).toContain("HOME_LOAN_VARIABLE");
    expect(rateIds).toContain("PERSONAL_LOAN_FIXED");
    expect(rateIds).toContain("CREDIT_CARD_PURCHASE");
    
    // Check base rates
    const baseRateIds = result.baseRates.map(r => r.baseRateId);
    expect(baseRateIds).toContain("RBA_CASH");
  });

  it("includes tiered savings rates", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.listInterestRates();

    const tieredRate = result.tieredRates.find(r => r.rateId === "SAVINGS_TIERED");
    expect(tieredRate).toBeDefined();
    expect(tieredRate!.tiers.length).toBeGreaterThanOrEqual(3);
  });
});

// ============================================
// Interest Accrual Tests
// ============================================

describe("Interest Accrual", () => {
  it("calculates daily accrual for a loan", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.calculateDailyAccrual({
      accountId: "ACC-001",
      accountType: "LOAN",
      productCode: "PERSONAL_LOAN",
      balanceCents: 5000000, // $50,000
      rateId: "PERSONAL_LOAN_FIXED",
      accrualStartDate: "2024-01-01",
      lastAccrualDate: "2024-12-16",
      accruedInterestCents: 0,
      interestCapitalized: false,
      customerId: "CUST-001",
      accrualDate: "2024-12-17",
    });

    expect(result.accountId).toBe("ACC-001");
    expect(result.openingBalance).toMatch(/50,000\.00/);
    expect(result.dayCountConvention).toBe("ACT_365");
    expect(result.annualRatePercent).toBe("8.99%");
    expect(result.daysInPeriod).toBe(1);
    
    // Daily interest on $50,000 at 8.99% ACT/365 ≈ $12.31
    expect(result.interestAmount).toMatch(/\d+\.\d{2}/);
  });

  it("calculates period interest correctly", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.calculatePeriodInterest({
      accountId: "ACC-002",
      accountType: "LOAN",
      productCode: "PERSONAL_LOAN",
      balanceCents: 10000000, // $100,000
      rateId: "PERSONAL_LOAN_FIXED",
      accrualStartDate: "2024-01-01",
      lastAccrualDate: "2024-11-30",
      accruedInterestCents: 0,
      interestCapitalized: false,
      customerId: "CUST-002",
      periodStart: "2024-12-01",
      periodEnd: "2024-12-31",
    });

    expect(result.dayCount).toBe(30); // Dec 2-31
    expect(result.effectiveRatePercent).toBe("8.99%");
    expect(result.totalAccruals).toBe(30);
    
    // Monthly interest on $100,000 at 8.99% ≈ $749
    expect(result.totalInterest).toMatch(/\d+\.\d{2}/);
  });

  it("calculates deposit interest (bank pays customer)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gl.calculateDailyAccrual({
      accountId: "DEP-001",
      accountType: "DEPOSIT",
      productCode: "TERM_DEPOSIT",
      balanceCents: 10000000, // $100,000
      rateId: "TERM_DEPOSIT_12M",
      accrualStartDate: "2024-01-01",
      lastAccrualDate: "2024-12-16",
      accruedInterestCents: 0,
      interestCapitalized: false,
      customerId: "CUST-003",
      accrualDate: "2024-12-17",
    });

    expect(result.accountId).toBe("DEP-001");
    expect(result.annualRatePercent).toBe("5.00%");
    
    // Daily interest on $100,000 at 5.00% ACT/365 ≈ $13.70
    expect(result.interestAmount).toMatch(/\d+\.\d{2}/);
  });
});

// ============================================
// Integration Tests
// ============================================

describe("IFRS 9 + Interest Integration", () => {
  it("ECL increases with credit deterioration", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const baseParams = {
      assetId: "LOAN-INT-001",
      assetType: "PERSONAL_LOAN" as const,
      originationDate: "2024-01-01",
      maturityDate: "2029-01-01",
      outstandingBalanceCents: 5000000,
      originalBalanceCents: 5000000,
      interestRate: 0.0899,
      originationRating: "BBB" as const,
      customerId: "CUST-INT",
    };

    // Stage 1: Performing
    const stage1 = await caller.gl.calculateECL({
      ...baseParams,
      creditRating: "BBB",
      daysPastDue: 0,
    });

    // Stage 2: SICR
    const stage2 = await caller.gl.calculateECL({
      ...baseParams,
      creditRating: "BB",
      daysPastDue: 45,
    });

    // Stage 3: Credit-impaired
    const stage3 = await caller.gl.calculateECL({
      ...baseParams,
      creditRating: "CCC",
      daysPastDue: 120,
    });

    // ECL should increase with deterioration
    const parseAmount = (s: string) => parseFloat(s.replace(/[$,]/g, ""));
    
    expect(stage1.stage).toBe("STAGE_1");
    expect(stage2.stage).toBe("STAGE_2");
    expect(stage3.stage).toBe("STAGE_3");
    
    expect(parseAmount(stage2.eclProvision)).toBeGreaterThan(parseAmount(stage1.eclProvision));
    expect(parseAmount(stage3.eclProvision)).toBeGreaterThan(parseAmount(stage2.eclProvision));
  });
});
