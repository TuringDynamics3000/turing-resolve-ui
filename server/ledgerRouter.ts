/**
 * TuringDynamics Ledger Router
 * 
 * tRPC router for bank-grade double-entry ledger operations:
 * - Posting commits with balance validation
 * - Reversals with counter-entries
 * - Trial balance generation
 * - GL account management
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { ledgerService } from "./core/ledger/LedgerService";
import { 
  createSimplePosting, 
  createMultiLegPosting,
  ReversalReason,
} from "../core/ledger/DoubleEntryLedger";
import { Money } from "../core/deposits/ledger/Money";
import { nanoid } from "nanoid";

// ============================================
// Input Schemas
// ============================================

const postingLegSchema = z.object({
  accountCode: z.string(),
  direction: z.enum(["DEBIT", "CREDIT"]),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3).default("AUD"),
  description: z.string().optional(),
  subLedgerRef: z.string().optional(),
});

const simplePostingSchema = z.object({
  debitAccount: z.string(),
  creditAccount: z.string(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3).default("AUD"),
  description: z.string(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().optional(),
  subLedgerRef: z.string().optional(),
});

const multiLegPostingSchema = z.object({
  legs: z.array(postingLegSchema).min(2),
  description: z.string(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().optional(),
});

const reversalReasonSchema = z.enum([
  "ERROR_CORRECTION",
  "DUPLICATE_ENTRY",
  "CUSTOMER_DISPUTE",
  "FRAUD_DETECTED",
  "REGULATORY_REQUIREMENT",
  "SYSTEM_RECONCILIATION",
  "OTHER",
]);

// ============================================
// Ledger Router
// ============================================

export const ledgerRouter = router({
  // ============================================
  // Chart of Accounts
  // ============================================
  
  /**
   * Initialize chart of accounts with standard accounts.
   */
  initializeChartOfAccounts: protectedProcedure.mutation(async () => {
    return ledgerService.initializeChartOfAccounts();
  }),
  
  /**
   * List all GL accounts.
   */
  listAccounts: publicProcedure.query(async () => {
    return ledgerService.listAccounts();
  }),
  
  /**
   * Get account balance.
   */
  getAccountBalance: publicProcedure
    .input(z.object({ accountCode: z.string() }))
    .query(async ({ input }) => {
      return ledgerService.getAccountBalance(input.accountCode);
    }),
  
  // ============================================
  // Posting Operations
  // ============================================
  
  /**
   * Commit a simple two-leg posting (most common case).
   * Validates that debit = credit before committing.
   */
  commitSimplePosting: protectedProcedure
    .input(simplePostingSchema)
    .mutation(async ({ ctx, input }) => {
      const postingId = `POST-${nanoid(12)}`;
      const amount = new Money(BigInt(input.amountCents), input.currency);
      
      const posting = createSimplePosting({
        postingId,
        debitAccount: input.debitAccount,
        creditAccount: input.creditAccount,
        amount,
        description: input.description,
        effectiveDate: input.effectiveDate,
        reference: input.reference,
        subLedgerRef: input.subLedgerRef,
      });
      
      const committedBy = ctx.user?.openId || "system";
      return ledgerService.commitPosting(posting, committedBy);
    }),
  
  /**
   * Commit a multi-leg posting (for complex transactions).
   * Validates that sum of debits = sum of credits before committing.
   */
  commitMultiLegPosting: protectedProcedure
    .input(multiLegPostingSchema)
    .mutation(async ({ ctx, input }) => {
      const postingId = `POST-${nanoid(12)}`;
      
      const legs = input.legs.map(leg => ({
        accountCode: leg.accountCode,
        direction: leg.direction as "DEBIT" | "CREDIT",
        amount: new Money(BigInt(leg.amountCents), leg.currency),
        description: leg.description,
        subLedgerRef: leg.subLedgerRef,
      }));
      
      const posting = createMultiLegPosting({
        postingId,
        legs,
        description: input.description,
        effectiveDate: input.effectiveDate,
        reference: input.reference,
      });
      
      const committedBy = ctx.user?.openId || "system";
      return ledgerService.commitPosting(posting, committedBy);
    }),
  
  /**
   * List recent postings.
   */
  listRecentPostings: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ input }) => {
      return ledgerService.listRecentPostings(input.limit);
    }),
  
  /**
   * Get posting with all entries.
   */
  getPostingWithEntries: publicProcedure
    .input(z.object({ postingId: z.string() }))
    .query(async ({ input }) => {
      return ledgerService.getPostingWithEntries(input.postingId);
    }),
  
  // ============================================
  // Reversal Operations
  // ============================================
  
  /**
   * Reverse a committed posting.
   * Creates counter-entries that cancel out the original posting.
   */
  reversePosting: protectedProcedure
    .input(z.object({
      originalPostingId: z.string(),
      reason: reversalReasonSchema,
      description: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const approvedBy = ctx.user?.openId || "system";
      return ledgerService.reversePosting(
        input.originalPostingId,
        input.reason as ReversalReason,
        input.description,
        approvedBy
      );
    }),
  
  // ============================================
  // Trial Balance
  // ============================================
  
  /**
   * Generate trial balance as of a specific date.
   */
  generateTrialBalance: publicProcedure
    .input(z.object({
      asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      currency: z.string().length(3).default("AUD"),
    }))
    .query(async ({ input }) => {
      const result = await ledgerService.generateTrialBalance(input.asOfDate, input.currency);
      
      if (!result.success || !result.trialBalance) {
        return result;
      }
      
      // Convert Money objects to serializable format
      return {
        success: true,
        trialBalance: {
          ...result.trialBalance,
          accounts: result.trialBalance.accounts.map(acc => ({
            accountCode: acc.accountCode,
            accountName: acc.accountName,
            accountType: acc.accountType,
            debitBalance: acc.debitBalance.toDisplayString(),
            creditBalance: acc.creditBalance.toDisplayString(),
            netBalance: acc.netBalance.toDisplayString(),
          })),
          totalDebits: result.trialBalance.totalDebits.toDisplayString(),
          totalCredits: result.trialBalance.totalCredits.toDisplayString(),
          variance: result.trialBalance.variance.toDisplayString(),
        },
      };
    }),
  
  // ============================================
  // Ledger Health Check
  // ============================================
  
  /**
   * Check ledger integrity.
   * Verifies that all committed postings are balanced.
   */
  checkLedgerIntegrity: publicProcedure.query(async () => {
    const postings = await ledgerService.listRecentPostings(1000);
    const issues: string[] = [];
    
    for (const posting of postings) {
      if (posting.status === "COMMITTED") {
        const { entries } = await ledgerService.getPostingWithEntries(posting.postingId);
        
        let totalDebits = 0;
        let totalCredits = 0;
        
        for (const entry of entries) {
          const amount = parseFloat(entry.amount);
          if (entry.direction === "DEBIT") {
            totalDebits += amount;
          } else {
            totalCredits += amount;
          }
        }
        
        // Check balance with tolerance for floating point
        if (Math.abs(totalDebits - totalCredits) > 0.01) {
          issues.push(
            `Posting ${posting.postingId}: Debits=${totalDebits.toFixed(2)}, Credits=${totalCredits.toFixed(2)}`
          );
        }
      }
    }
    
    return {
      isHealthy: issues.length === 0,
      postingsChecked: postings.length,
      issues,
      checkedAt: new Date().toISOString(),
    };
  }),

  // ============================================
  // Reconciliation Operations
  // ============================================
  
  /**
   * Run reconciliation for a specific sub-ledger.
   */
  reconcileSubLedger: publicProcedure
    .input(z.object({
      subLedgerType: z.enum(["DEPOSITS", "LOANS", "PAYMENTS", "CARDS"]),
      asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      currency: z.string().length(3).default("AUD"),
    }))
    .query(async ({ input }) => {
      const { reconciliationService } = await import("./core/ledger/ReconciliationService");
      const result = await reconciliationService.reconcileSubLedger(
        input.subLedgerType,
        input.asOfDate,
        input.currency
      );
      return {
        ...result,
        subLedgerTotal: result.subLedgerTotal.toDisplayString(),
        glControlTotal: result.glControlTotal.toDisplayString(),
        variance: result.variance.toDisplayString(),
      };
    }),
  
  /**
   * Run full reconciliation across all sub-ledgers.
   */
  runFullReconciliation: publicProcedure
    .input(z.object({
      asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      currency: z.string().length(3).default("AUD"),
    }))
    .query(async ({ input }) => {
      const { reconciliationService } = await import("./core/ledger/ReconciliationService");
      const report = await reconciliationService.runFullReconciliation(
        input.asOfDate,
        input.currency
      );
      return {
        ...report,
        reconciliations: report.reconciliations.map(r => ({
          ...r,
          subLedgerTotal: r.subLedgerTotal.toDisplayString(),
          glControlTotal: r.glControlTotal.toDisplayString(),
          variance: r.variance.toDisplayString(),
        })),
        totalVariance: report.totalVariance.toDisplayString(),
      };
    }),
  
  // ============================================
  // FX Operations
  // ============================================
  
  /**
   * Get supported currencies.
   */
  getSupportedCurrencies: publicProcedure.query(async () => {
    const { CURRENCY_INFO } = await import("../core/ledger/MultiCurrencyLedger");
    return Object.values(CURRENCY_INFO);
  }),
  
  /**
   * Get current FX rate.
   */
  getFXRate: publicProcedure
    .input(z.object({
      baseCurrency: z.string().length(3),
      quoteCurrency: z.string().length(3),
    }))
    .query(async ({ input }) => {
      const { fxRateService } = await import("../core/ledger/MultiCurrencyLedger");
      fxRateService.loadDefaultRates();
      const rate = fxRateService.getRate(input.baseCurrency, input.quoteCurrency);
      return rate;
    }),
  
  /**
   * Convert currency amount.
   */
  convertCurrency: publicProcedure
    .input(z.object({
      amountCents: z.number().int().positive(),
      fromCurrency: z.string().length(3),
      toCurrency: z.string().length(3),
      rateType: z.enum(["BID", "ASK", "MID"]).default("MID"),
    }))
    .query(async ({ input }) => {
      const { fxRateService } = await import("../core/ledger/MultiCurrencyLedger");
      const { Money } = await import("../core/deposits/ledger/Money");
      fxRateService.loadDefaultRates();
      const amount = new Money(BigInt(input.amountCents), input.fromCurrency);
      const conversion = fxRateService.convert(amount, input.toCurrency, input.rateType);
      if (!conversion) {
        return { success: false, error: "No FX rate available" };
      }
      return {
        success: true,
        fromAmount: conversion.fromAmount.toDisplayString(),
        toAmount: conversion.toAmount.toDisplayString(),
        rateUsed: conversion.rateUsed.midRate,
        rateType: conversion.rateType,
      };
    }),
  
  // ============================================
  // Period Close Operations
  // ============================================
  
  /**
   * List all accounting periods.
   */
  listPeriods: publicProcedure
    .input(z.object({
      fiscalYear: z.number().int().optional(),
    }).optional())
    .query(async ({ input }) => {
      const { periodCloseService } = await import("./core/ledger/PeriodCloseService");
      return periodCloseService.listPeriods(input?.fiscalYear);
    }),
  
  /**
   * Get current open period.
   */
  getCurrentPeriod: publicProcedure.query(async () => {
    const { periodCloseService } = await import("./core/ledger/PeriodCloseService");
    return periodCloseService.getCurrentPeriod();
  }),
  
  /**
   * Validate period for close.
   */
  validatePeriodForClose: publicProcedure
    .input(z.object({
      periodId: z.string().regex(/^\d{4}-\d{2}$/),
    }))
    .query(async ({ input }) => {
      const { periodCloseService } = await import("./core/ledger/PeriodCloseService");
      return periodCloseService.validatePeriodForClose(input.periodId);
    }),
  
  /**
   * Soft close a period.
   */
  softClosePeriod: protectedProcedure
    .input(z.object({
      periodId: z.string().regex(/^\d{4}-\d{2}$/),
    }))
    .mutation(async ({ input, ctx }) => {
      const { periodCloseService } = await import("./core/ledger/PeriodCloseService");
      return periodCloseService.softClosePeriod(input.periodId, ctx.user?.openId || "system");
    }),
  
  /**
   * Hard close a period with P&L rollup.
   */
  hardClosePeriod: protectedProcedure
    .input(z.object({
      periodId: z.string().regex(/^\d{4}-\d{2}$/),
    }))
    .mutation(async ({ input, ctx }) => {
      const { periodCloseService } = await import("./core/ledger/PeriodCloseService");
      return periodCloseService.hardClosePeriod(input.periodId, ctx.user?.openId || "system");
    }),
  
  /**
   * Lock a period permanently.
   */
  lockPeriod: protectedProcedure
    .input(z.object({
      periodId: z.string().regex(/^\d{4}-\d{2}$/),
    }))
    .mutation(async ({ input, ctx }) => {
      const { periodCloseService } = await import("./core/ledger/PeriodCloseService");
      return periodCloseService.lockPeriod(input.periodId, ctx.user?.openId || "system");
    }),
  
  /**
   * Reopen a closed period.
   */
  reopenPeriod: protectedProcedure
    .input(z.object({
      periodId: z.string().regex(/^\d{4}-\d{2}$/),
      reason: z.string().min(10),
    }))
    .mutation(async ({ input, ctx }) => {
      const { periodCloseService } = await import("./core/ledger/PeriodCloseService");
      return periodCloseService.reopenPeriod(input.periodId, ctx.user?.openId || "system", input.reason);
    }),
  
  /**
   * Calculate P&L rollup preview.
   */
  previewPLRollup: publicProcedure
    .input(z.object({
      periodId: z.string().regex(/^\d{4}-\d{2}$/),
    }))
    .query(async ({ input }) => {
      const { periodCloseService } = await import("./core/ledger/PeriodCloseService");
      const rollup = periodCloseService.calculatePLRollup(input.periodId);
      return {
        revenueAccounts: rollup.revenueAccounts.map(a => ({
          ...a,
          balance: `$${(Number(a.balance) / 100).toFixed(2)}`,
        })),
        expenseAccounts: rollup.expenseAccounts.map(a => ({
          ...a,
          balance: `$${(Number(a.balance) / 100).toFixed(2)}`,
        })),
        totalRevenue: `$${(Number(rollup.totalRevenue) / 100).toFixed(2)}`,
        totalExpenses: `$${(Number(rollup.totalExpenses) / 100).toFixed(2)}`,
        netIncome: `$${(Number(rollup.netIncome) / 100).toFixed(2)}`,
      };
    }),
  
  /**
   * Get period close summary for a fiscal year.
   */
  getPeriodCloseSummary: publicProcedure
    .input(z.object({
      fiscalYear: z.number().int(),
    }))
    .query(async ({ input }) => {
      const { periodCloseService } = await import("./core/ledger/PeriodCloseService");
      return periodCloseService.getPeriodCloseSummary(input.fiscalYear);
    }),
  
  /**
   * Check if posting is allowed for a date.
   */
  canPostToDate: publicProcedure
    .input(z.object({
      effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }))
    .query(async ({ input }) => {
      const { periodCloseService } = await import("./core/ledger/PeriodCloseService");
      return periodCloseService.canPostToDate(input.effectiveDate);
    }),
  
  // ============================================
  // APRA Regulatory Reporting
  // ============================================
  
  /**
   * Get GL to APRA mappings.
   */
  getAPRAMappings: publicProcedure
    .input(z.object({
      reportType: z.enum(["ARF_720_0", "ARF_720_1", "ARF_720_2", "ARF_720_3", "ARF_720_4", "ARF_220_0"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const { apraReportingService } = await import("./core/ledger/APRAReportingService");
      return apraReportingService.getMappings(input?.reportType);
    }),
  
  /**
   * Get APRA report template.
   */
  getAPRAReportTemplate: publicProcedure
    .input(z.object({
      reportType: z.enum(["ARF_720_0", "ARF_720_1", "ARF_720_2", "ARF_720_3", "ARF_720_4", "ARF_220_0"]),
    }))
    .query(async ({ input }) => {
      const { apraReportingService } = await import("./core/ledger/APRAReportingService");
      return apraReportingService.getReportTemplate(input.reportType);
    }),
  
  /**
   * Generate demo APRA report.
   */
  generateAPRADemoReport: publicProcedure
    .input(z.object({
      reportType: z.enum(["ARF_720_0", "ARF_720_1", "ARF_720_2", "ARF_720_3", "ARF_720_4", "ARF_220_0"]),
      reportingPeriod: z.string().regex(/^\d{4}-\d{2}$/),
    }))
    .mutation(async ({ input }) => {
      const { apraReportingService } = await import("./core/ledger/APRAReportingService");
      if (input.reportType === "ARF_220_0") {
        return apraReportingService.generateDemoARF220Report(input.reportingPeriod);
      }
      return apraReportingService.generateDemoReport(input.reportType, input.reportingPeriod);
    }),
  
  /**
   * List APRA reports.
   */
  listAPRAReports: publicProcedure
    .input(z.object({
      reportType: z.enum(["ARF_720_0", "ARF_720_1", "ARF_720_2", "ARF_720_3", "ARF_720_4", "ARF_220_0"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const { apraReportingService } = await import("./core/ledger/APRAReportingService");
      return apraReportingService.listReports(input?.reportType);
    }),
  
  /**
   * Get APRA report by ID.
   */
  getAPRAReport: publicProcedure
    .input(z.object({
      reportId: z.string(),
    }))
    .query(async ({ input }) => {
      const { apraReportingService } = await import("./core/ledger/APRAReportingService");
      return apraReportingService.getReport(input.reportId);
    }),
  
  /**
   * Submit APRA report (simulated).
   */
  submitAPRAReport: protectedProcedure
    .input(z.object({
      reportId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { apraReportingService } = await import("./core/ledger/APRAReportingService");
      return apraReportingService.submitReport(input.reportId);
    }),
  
  /**
   * Seed GL data with sample postings.
   */
  seedGLData: protectedProcedure.mutation(async () => {
    return ledgerService.seedGLData();
  }),

  // ============================================
  // IFRS 9 ECL Operations
  // ============================================
  
  /**
   * Calculate ECL for a single asset.
   */
  calculateECL: publicProcedure
    .input(z.object({
      assetId: z.string(),
      assetType: z.enum(["PERSONAL_LOAN", "HOME_LOAN", "CREDIT_CARD", "OVERDRAFT", "BUSINESS_LOAN"]),
      originationDate: z.string(),
      maturityDate: z.string(),
      outstandingBalanceCents: z.number().int(),
      originalBalanceCents: z.number().int(),
      interestRate: z.number(),
      creditRating: z.enum(["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C", "D"]),
      originationRating: z.enum(["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C", "D"]),
      daysPastDue: z.number().int().default(0),
      isForborne: z.boolean().default(false),
      isOnWatchlist: z.boolean().default(false),
      customerId: z.string(),
      customerSegment: z.enum(["RETAIL", "SME", "CORPORATE"]).default("RETAIL"),
      currency: z.string().length(3).default("AUD"),
      collateralValueCents: z.number().int().optional(),
      collateralType: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const { ifrs9ECLService } = await import("./core/ledger/IFRS9ECLService");
      const { Money } = await import("../core/deposits/ledger/Money");
      
      const asset = {
        assetId: input.assetId,
        assetType: input.assetType,
        originationDate: input.originationDate,
        maturityDate: input.maturityDate,
        outstandingBalance: new Money(BigInt(input.outstandingBalanceCents), input.currency),
        originalBalance: new Money(BigInt(input.originalBalanceCents), input.currency),
        interestRate: input.interestRate,
        creditRating: input.creditRating,
        originationRating: input.originationRating,
        daysPastDue: input.daysPastDue,
        isForborne: input.isForborne,
        isOnWatchlist: input.isOnWatchlist,
        customerId: input.customerId,
        customerSegment: input.customerSegment,
        collateralValue: input.collateralValueCents 
          ? new Money(BigInt(input.collateralValueCents), input.currency) 
          : undefined,
        collateralType: input.collateralType,
      };
      
      const result = ifrs9ECLService.calculateECL(asset);
      
      return {
        ...result,
        ead: result.ead.toDisplayString(),
        ecl12Month: result.ecl12Month.toDisplayString(),
        eclLifetime: result.eclLifetime.toDisplayString(),
        eclProvision: result.eclProvision.toDisplayString(),
        scenarioECLs: result.scenarioECLs.map(s => ({
          ...s,
          ecl: s.ecl.toDisplayString(),
        })),
      };
    }),
  
  /**
   * Determine IFRS 9 stage for an asset.
   */
  determineIFRS9Stage: publicProcedure
    .input(z.object({
      creditRating: z.enum(["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C", "D"]),
      originationRating: z.enum(["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C", "D"]),
      daysPastDue: z.number().int().default(0),
      isForborne: z.boolean().default(false),
      isOnWatchlist: z.boolean().default(false),
    }))
    .query(async ({ input }) => {
      const { ifrs9ECLService } = await import("./core/ledger/IFRS9ECLService");
      const { Money } = await import("../core/deposits/ledger/Money");
      
      // Create minimal asset for stage determination
      const asset = {
        assetId: "TEMP",
        assetType: "PERSONAL_LOAN" as const,
        originationDate: "2024-01-01",
        maturityDate: "2029-01-01",
        outstandingBalance: new Money(BigInt(100000), "AUD"),
        originalBalance: new Money(BigInt(100000), "AUD"),
        interestRate: 0.05,
        creditRating: input.creditRating,
        originationRating: input.originationRating,
        daysPastDue: input.daysPastDue,
        isForborne: input.isForborne,
        isOnWatchlist: input.isOnWatchlist,
        customerId: "TEMP",
        customerSegment: "RETAIL" as const,
      };
      
      return ifrs9ECLService.determineStage(asset);
    }),

  // ============================================
  // Interest Accrual Operations
  // ============================================
  
  /**
   * List all interest rates.
   */
  listInterestRates: publicProcedure.query(async () => {
    const { interestAccrualService } = await import("./core/ledger/InterestAccrualService");
    const { rates, tieredRates, baseRates } = interestAccrualService.getAllRates();
    
    return {
      rates: rates.map(r => ({
        ...r,
        annualRatePercent: (r.annualRate * 100).toFixed(2) + "%",
      })),
      tieredRates: tieredRates.map(tr => ({
        ...tr,
        tiers: tr.tiers.map(t => ({
          ...t,
          minBalance: t.minBalance.toDisplayString(),
          maxBalance: t.maxBalance?.toDisplayString() || "Unlimited",
          annualRatePercent: (t.annualRate * 100).toFixed(2) + "%",
        })),
      })),
      baseRates: baseRates.map(br => ({
        ...br,
        currentRatePercent: (br.currentRate * 100).toFixed(2) + "%",
      })),
    };
  }),
  
  /**
   * Calculate daily interest accrual.
   */
  calculateDailyAccrual: publicProcedure
    .input(z.object({
      accountId: z.string(),
      accountType: z.enum(["DEPOSIT", "LOAN", "CREDIT_CARD", "OVERDRAFT"]),
      productCode: z.string(),
      balanceCents: z.number().int(),
      rateId: z.string(),
      accrualStartDate: z.string(),
      lastAccrualDate: z.string(),
      accruedInterestCents: z.number().int().default(0),
      interestCapitalized: z.boolean().default(false),
      customerId: z.string(),
      currency: z.string().length(3).default("AUD"),
      accrualDate: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const { interestAccrualService } = await import("./core/ledger/InterestAccrualService");
      const { Money } = await import("../core/deposits/ledger/Money");
      
      const account = {
        accountId: input.accountId,
        accountType: input.accountType,
        productCode: input.productCode,
        balance: new Money(BigInt(input.balanceCents), input.currency),
        rateId: input.rateId,
        accrualStartDate: input.accrualStartDate,
        lastAccrualDate: input.lastAccrualDate,
        accruedInterest: new Money(BigInt(input.accruedInterestCents), input.currency),
        interestCapitalized: input.interestCapitalized,
        customerId: input.customerId,
      };
      
      const accrualDate = input.accrualDate 
        ? new Date(input.accrualDate) 
        : new Date();
      
      const result = interestAccrualService.calculateDailyAccrual(account, accrualDate);
      
      return {
        ...result,
        openingBalance: result.openingBalance.toDisplayString(),
        interestAmount: result.interestAmount.toDisplayString(),
        closingAccruedInterest: result.closingAccruedInterest.toDisplayString(),
        dailyRatePercent: (result.dailyRate * 100).toFixed(6) + "%",
        annualRatePercent: (result.annualRate * 100).toFixed(2) + "%",
      };
    }),
  
  /**
   * Calculate period interest.
   */
  calculatePeriodInterest: publicProcedure
    .input(z.object({
      accountId: z.string(),
      accountType: z.enum(["DEPOSIT", "LOAN", "CREDIT_CARD", "OVERDRAFT"]),
      productCode: z.string(),
      balanceCents: z.number().int(),
      rateId: z.string(),
      accrualStartDate: z.string(),
      lastAccrualDate: z.string(),
      accruedInterestCents: z.number().int().default(0),
      interestCapitalized: z.boolean().default(false),
      customerId: z.string(),
      currency: z.string().length(3).default("AUD"),
      periodStart: z.string(),
      periodEnd: z.string(),
    }))
    .query(async ({ input }) => {
      const { interestAccrualService } = await import("./core/ledger/InterestAccrualService");
      const { Money } = await import("../core/deposits/ledger/Money");
      
      const account = {
        accountId: input.accountId,
        accountType: input.accountType,
        productCode: input.productCode,
        balance: new Money(BigInt(input.balanceCents), input.currency),
        rateId: input.rateId,
        accrualStartDate: input.accrualStartDate,
        lastAccrualDate: input.lastAccrualDate,
        accruedInterest: new Money(BigInt(input.accruedInterestCents), input.currency),
        interestCapitalized: input.interestCapitalized,
        customerId: input.customerId,
      };
      
      const result = interestAccrualService.calculatePeriodInterest(
        account,
        new Date(input.periodStart),
        new Date(input.periodEnd)
      );
      
      return {
        totalInterest: result.totalInterest.toDisplayString(),
        effectiveRatePercent: (result.effectiveRate * 100).toFixed(2) + "%",
        dayCount: result.dayCount,
        dailyAccruals: result.dailyAccruals.slice(0, 10).map(a => ({
          accrualDate: a.accrualDate,
          interestAmount: a.interestAmount.toDisplayString(),
        })),
        hasMoreAccruals: result.dailyAccruals.length > 10,
        totalAccruals: result.dailyAccruals.length,
      };
    }),
  
  /**
   * Calculate day count factor.
   */
  calculateDayCountFactor: publicProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
      convention: z.enum(["ACT_365", "ACT_360", "30_360", "ACT_ACT"]),
    }))
    .query(async ({ input }) => {
      const { calculateDayCountFactor } = await import("./core/ledger/InterestAccrualService");
      
      const result = calculateDayCountFactor(
        new Date(input.startDate),
        new Date(input.endDate),
        input.convention
      );
      
      return {
        ...result,
        factorPercent: (result.factor * 100).toFixed(6) + "%",
        convention: input.convention,
      };
    }),

  // ============================================
  // FX REVALUATION ENDPOINTS
  // ============================================

  /**
   * Get FX positions for revaluation.
   */
  getFXPositions: publicProcedure
    .query(async () => {
      const { fxRevaluationService } = await import("./core/ledger/FXRevaluationService");
      const positions = fxRevaluationService.getPositions();
      
      return {
        positions: positions.map(p => ({
          accountId: p.accountId,
          accountName: p.accountName,
          currency: p.currency,
          balance: `${(Number(p.balanceCents) / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 })} ${p.currency}`,
          originalAudCost: `${(Number(p.originalAudCostCents) / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}`,
          currentAudValue: `${(Number(p.currentAudValueCents) / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}`,
          unrealizedGainLoss: `${(Number(p.unrealizedGainLossCents) / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}`,
          unrealizedGainLossCents: Number(p.unrealizedGainLossCents),
          lastRevaluedAt: p.lastRevaluedAt,
        })),
        totalPositions: positions.length,
      };
    }),

  /**
   * Run month-end FX revaluation.
   */
  runFXRevaluation: publicProcedure
    .input(z.object({
      periodEnd: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { fxRevaluationService } = await import("./core/ledger/FXRevaluationService");
      const run = fxRevaluationService.runMonthEndRevaluation(input.periodEnd);
      
      return {
        runId: run.runId,
        periodEnd: run.periodEnd,
        status: run.status,
        positionsProcessed: run.positionsProcessed,
        totalUnrealizedGainLoss: `${(Number(run.totalUnrealizedGainLossCents) / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}`,
        results: run.results.map(r => ({
          accountId: r.accountId,
          currency: r.currency,
          movement: `${(Number(r.movementCents) / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}`,
          fxRate: r.fxRateMid.toFixed(4),
          glPostings: r.glPostings.length,
        })),
        completedAt: run.completedAt,
      };
    }),

  /**
   * Get FX revaluation history.
   */
  getFXRevaluationHistory: publicProcedure
    .query(async () => {
      const { fxRevaluationService } = await import("./core/ledger/FXRevaluationService");
      const runs = fxRevaluationService.getRevaluationRuns();
      
      return {
        runs: runs.map(r => ({
          runId: r.runId,
          periodEnd: r.periodEnd,
          status: r.status,
          positionsProcessed: r.positionsProcessed,
          totalUnrealizedGainLoss: `${(Number(r.totalUnrealizedGainLossCents) / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}`,
          completedAt: r.completedAt,
        })),
      };
    }),

  // ============================================
  // INTEREST POSTING SCHEDULER ENDPOINTS
  // ============================================

  /**
   * Get interest-bearing accounts.
   */
  getInterestAccounts: publicProcedure
    .query(async () => {
      const { interestPostingScheduler } = await import("./core/ledger/InterestPostingScheduler");
      const accounts = interestPostingScheduler.getAccounts();
      
      return {
        accounts: accounts.map(a => ({
          accountId: a.accountId,
          accountType: a.accountType,
          customerId: a.customerId,
          customerName: a.customerName,
          productCode: a.productCode,
          balance: `${(Number(a.balanceCents) / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}`,
          annualRate: `${(a.annualRate * 100).toFixed(2)}%`,
          accruedInterest: `${(Number(a.accruedInterestCents) / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}`,
          accruedInterestCents: Number(a.accruedInterestCents),
          lastAccrualDate: a.lastAccrualDate,
          capitalizationDay: a.capitalizationDay,
          isActive: a.isActive,
        })),
        totalAccounts: accounts.length,
        activeAccounts: accounts.filter(a => a.isActive).length,
      };
    }),

  /**
   * Run daily interest accrual.
   */
  runDailyAccrual: publicProcedure
    .input(z.object({
      accrualDate: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { interestPostingScheduler } = await import("./core/ledger/InterestPostingScheduler");
      const run = interestPostingScheduler.runDailyAccrual(input.accrualDate);
      
      return {
        runId: run.runId,
        runType: run.runType,
        runDate: run.runDate,
        status: run.status,
        accountsProcessed: run.accountsProcessed,
        totalInterest: `${(Number(run.totalInterestCents) / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}`,
        glPostingsGenerated: run.glPostings.length,
        errors: run.errors.length,
        completedAt: run.completedAt,
      };
    }),

  /**
   * Run interest capitalization.
   */
  runCapitalization: publicProcedure
    .input(z.object({
      capitalizationDate: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { interestPostingScheduler } = await import("./core/ledger/InterestPostingScheduler");
      const run = interestPostingScheduler.runCapitalization(input.capitalizationDate);
      
      return {
        runId: run.runId,
        runType: run.runType,
        runDate: run.runDate,
        status: run.status,
        accountsProcessed: run.accountsProcessed,
        totalCapitalized: `${(Number(run.totalInterestCents) / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}`,
        glPostingsGenerated: run.glPostings.length,
        completedAt: run.completedAt,
      };
    }),

  /**
   * Run EOD reconciliation.
   */
  runEODReconciliation: publicProcedure
    .input(z.object({
      reconciliationDate: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { interestPostingScheduler } = await import("./core/ledger/InterestPostingScheduler");
      const recon = interestPostingScheduler.runEODReconciliation(input.reconciliationDate);
      
      return {
        reconciliationId: recon.reconciliationId,
        reconciliationDate: recon.reconciliationDate,
        status: recon.status,
        totalAccrued: `${(Number(recon.totalAccruedCents) / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}`,
        totalPosted: `${(Number(recon.totalPostedCents) / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}`,
        variance: `${(Number(recon.varianceCents) / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}`,
        isBalanced: recon.status === "BALANCED",
        accountCount: recon.accountCount,
        completedAt: recon.completedAt,
      };
    }),

  /**
   * Get scheduler run history.
   */
  getSchedulerHistory: publicProcedure
    .query(async () => {
      const { interestPostingScheduler } = await import("./core/ledger/InterestPostingScheduler");
      const runs = interestPostingScheduler.getRuns();
      const recons = interestPostingScheduler.getReconciliations();
      
      return {
        runs: runs.map(r => ({
          runId: r.runId,
          runType: r.runType,
          runDate: r.runDate,
          status: r.status,
          accountsProcessed: r.accountsProcessed,
          totalInterest: `${(Number(r.totalInterestCents) / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}`,
          completedAt: r.completedAt,
        })),
        reconciliations: recons.map(r => ({
          reconciliationId: r.reconciliationId,
          reconciliationDate: r.reconciliationDate,
          status: r.status,
          isBalanced: r.status === "BALANCED",
          completedAt: r.completedAt,
        })),
      };
    }),

  // ============================================
  // MULTI-CURRENCY WALLET ENDPOINTS
  // ============================================

  /**
   * Get all FX rates.
   */
  getFXRates: publicProcedure
    .query(async () => {
      const { multiCurrencyWalletService } = await import("./core/ledger/MultiCurrencyWalletService");
      const rates = multiCurrencyWalletService.getAllRates();
      
      return {
        rates: rates.map(r => ({
          baseCurrency: r.baseCurrency,
          quoteCurrency: r.quoteCurrency,
          bidRate: r.bidRate.toFixed(4),
          askRate: r.askRate.toFixed(4),
          midRate: r.midRate.toFixed(4),
          source: r.source,
          timestamp: r.timestamp,
        })),
        lastUpdated: new Date().toISOString(),
      };
    }),

  /**
   * Get customer wallet with all currency balances.
   */
  getCustomerWallet: publicProcedure
    .input(z.object({
      customerId: z.string(),
    }))
    .query(async ({ input }) => {
      const { multiCurrencyWalletService } = await import("./core/ledger/MultiCurrencyWalletService");
      const wallet = multiCurrencyWalletService.getWallet(input.customerId);
      
      if (!wallet) {
        return null;
      }
      
      return {
        customerId: wallet.customerId,
        customerName: wallet.customerName,
        balances: wallet.balances.map(b => ({
          currency: b.currency,
          balance: b.balance.toDisplayString(),
          availableBalance: b.availableBalance.toDisplayString(),
          holdAmount: b.holdAmount.toDisplayString(),
          balanceValue: Number(b.balance.amount) / 100,
          isActive: b.isActive,
        })),
        totalValueAUD: wallet.totalValueAUD.toDisplayString(),
        totalValueAUDNum: Number(wallet.totalValueAUD.amount) / 100,
        lastUpdated: wallet.lastUpdated,
      };
    }),

  /**
   * Get all customer wallets.
   */
  getAllCustomerWallets: publicProcedure
    .query(async () => {
      const { multiCurrencyWalletService } = await import("./core/ledger/MultiCurrencyWalletService");
      const wallets = multiCurrencyWalletService.getAllWallets();
      
      return {
        wallets: wallets.map(w => ({
          customerId: w.customerId,
          customerName: w.customerName,
          currencyCount: w.balances.length,
          currencies: w.balances.map(b => b.currency),
          totalValueAUD: w.totalValueAUD.toDisplayString(),
          totalValueAUDNum: Number(w.totalValueAUD.amount) / 100,
        })),
        totalWallets: wallets.length,
      };
    }),

  /**
   * Get FX quote for conversion.
   */
  getFXQuote: publicProcedure
    .input(z.object({
      customerId: z.string(),
      fromCurrency: z.string(),
      toCurrency: z.string(),
      fromAmountCents: z.number().int().positive(),
    }))
    .query(async ({ input }) => {
      const { multiCurrencyWalletService } = await import("./core/ledger/MultiCurrencyWalletService");
      const { Money } = await import("../core/deposits/ledger/Money");
      
      const fromAmount = new Money(BigInt(input.fromAmountCents), input.fromCurrency);
      const quote = multiCurrencyWalletService.getQuote(
        input.customerId,
        input.fromCurrency as any,
        input.toCurrency as any,
        fromAmount
      );
      
      if (!quote) {
        return null;
      }
      
      return {
        quoteId: quote.quoteId,
        customerId: quote.customerId,
        fromCurrency: quote.fromCurrency,
        toCurrency: quote.toCurrency,
        fromAmount: quote.fromAmount.toDisplayString(),
        toAmount: quote.toAmount.toDisplayString(),
        spotRate: quote.spotRate.toFixed(6),
        customerRate: quote.customerRate.toFixed(6),
        spreadPercent: quote.spreadPercent.toFixed(2) + "%",
        spreadAmount: quote.spreadAmount.toDisplayString(),
        expiresAt: quote.expiresAt,
        disclosures: quote.disclosures,
      };
    }),

  /**
   * Execute currency conversion.
   */
  executeFXConversion: publicProcedure
    .input(z.object({
      customerId: z.string(),
      fromCurrency: z.string(),
      toCurrency: z.string(),
      fromAmountCents: z.number().int().positive(),
      quoteId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { multiCurrencyWalletService } = await import("./core/ledger/MultiCurrencyWalletService");
      const { Money } = await import("../core/deposits/ledger/Money");
      
      const fromAmount = new Money(BigInt(input.fromAmountCents), input.fromCurrency);
      const result = multiCurrencyWalletService.executeConversion(
        input.customerId,
        input.fromCurrency as any,
        input.toCurrency as any,
        fromAmount,
        input.quoteId
      );
      
      if (!result) {
        return { success: false, error: "Conversion failed - insufficient balance or invalid parameters" };
      }
      
      return {
        success: true,
        transactionId: result.transactionId,
        fromCurrency: result.fromCurrency,
        toCurrency: result.toCurrency,
        fromAmount: result.fromAmount.toDisplayString(),
        toAmount: result.toAmount.toDisplayString(),
        spotRate: result.spotRate.toFixed(6),
        customerRate: result.customerRate.toFixed(6),
        spreadPercent: result.spreadPercent.toFixed(2) + "%",
        postingId: result.postingId,
        executedAt: result.executedAt,
        glPostings: result.glPostings,
      };
    }),

  /**
   * Get FX transaction history for customer.
   */
  getFXTransactionHistory: publicProcedure
    .input(z.object({
      customerId: z.string(),
    }))
    .query(async ({ input }) => {
      const { multiCurrencyWalletService } = await import("./core/ledger/MultiCurrencyWalletService");
      const transactions = multiCurrencyWalletService.getTransactionHistory(input.customerId);
      
      return {
        transactions: transactions.map(t => ({
          transactionId: t.transactionId,
          fromCurrency: t.fromCurrency,
          toCurrency: t.toCurrency,
          fromAmount: t.fromAmount.toDisplayString(),
          toAmount: t.toAmount.toDisplayString(),
          customerRate: t.customerRate.toFixed(6),
          spreadPercent: t.spreadPercent.toFixed(2) + "%",
          status: t.status,
          executedAt: t.executedAt,
        })),
        totalTransactions: transactions.length,
      };
    }),

  /**
   * Add currency to customer wallet.
   */
  addCurrencyToWallet: publicProcedure
    .input(z.object({
      customerId: z.string(),
      currency: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { multiCurrencyWalletService } = await import("./core/ledger/MultiCurrencyWalletService");
      const success = multiCurrencyWalletService.addCurrencyToWallet(
        input.customerId,
        input.currency as any
      );
      
      return { success };
    }),
});

export default ledgerRouter;
