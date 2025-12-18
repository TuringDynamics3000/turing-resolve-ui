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
      reportType: z.enum(["ARF_720_0", "ARF_720_1", "ARF_720_2", "ARF_720_3", "ARF_720_4"]).optional(),
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
      reportType: z.enum(["ARF_720_0", "ARF_720_1", "ARF_720_2", "ARF_720_3", "ARF_720_4"]),
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
      reportType: z.enum(["ARF_720_0", "ARF_720_1", "ARF_720_2", "ARF_720_3", "ARF_720_4"]),
      reportingPeriod: z.string().regex(/^\d{4}-\d{2}$/),
    }))
    .mutation(async ({ input }) => {
      const { apraReportingService } = await import("./core/ledger/APRAReportingService");
      return apraReportingService.generateDemoReport(input.reportType, input.reportingPeriod);
    }),
  
  /**
   * List APRA reports.
   */
  listAPRAReports: publicProcedure
    .input(z.object({
      reportType: z.enum(["ARF_720_0", "ARF_720_1", "ARF_720_2", "ARF_720_3", "ARF_720_4"]).optional(),
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
});

export default ledgerRouter;
