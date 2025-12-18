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
});

export default ledgerRouter;
