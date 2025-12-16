/**
 * lendingRouter.ts - Lending Core v1 tRPC Routes
 * 
 * Exposes the Lending Core v1 functionality via tRPC.
 * Uses JSON facts stored in database - the core types are used
 * for business logic validation, not for storage.
 */
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { nanoid } from "nanoid";
import { eq, asc, desc } from "drizzle-orm";
import { loanFacts, loans } from "../drizzle/schema";
import { rebuildFromFacts } from "../core/lending";
import type { LoanFact } from "../core/lending";

/**
 * Get next sequence number for a loan.
 */
async function getNextSequence(db: any, loanId: string): Promise<number> {
  const result = await db
    .select({ sequence: loanFacts.sequence })
    .from(loanFacts)
    .where(eq(loanFacts.loanId, loanId))
    .orderBy(desc(loanFacts.sequence))
    .limit(1);
  
  return result.length > 0 ? result[0].sequence + 1 : 1;
}

/**
 * Append a fact to the database.
 */
async function appendFact(db: any, fact: LoanFact): Promise<void> {
  const factId = `LOANFACT-${nanoid(12)}`;
  const sequence = await getNextSequence(db, fact.loanId);
  
  await db.insert(loanFacts).values({
    loanId: fact.loanId,
    sequence,
    factType: fact.type,
    factData: fact, // The full fact object as JSON
    occurredAt: new Date(fact.occurredAt),
    createdAt: new Date(),
  });
}

/**
 * Load all facts for a loan.
 */
async function loadFacts(db: any, loanId: string): Promise<LoanFact[]> {
  const rows = await db
    .select()
    .from(loanFacts)
    .where(eq(loanFacts.loanId, loanId))
    .orderBy(asc(loanFacts.sequence));
  
  return rows.map((row: any) => row.factData as LoanFact);
}

/**
 * Update loan projection (derived state).
 */
async function updateLoanProjection(dbPromise: any, loanId: string): Promise<void> {
  const db = await dbPromise;
  const facts = await loadFacts(db, loanId);
  if (facts.length === 0) return;

  const loan = rebuildFromFacts(facts);

  // Calculate derived balances
  let totalPaid = BigInt(0);
  let principalPaid = BigInt(0);
  let interestPaid = BigInt(0);
  let feesPaid = BigInt(0);

  for (const fact of facts) {
    if (fact.type === "LOAN_PAYMENT_APPLIED") {
      totalPaid += fact.amount;
      principalPaid += fact.principalPortion;
      interestPaid += fact.interestPortion;
    } else if (fact.type === "FEE_APPLIED") {
      feesPaid += fact.amount;
    }
  }

  // Get arrears info from latest LOAN_IN_ARREARS fact
  let daysPastDue = 0;
  let amountOverdue = BigInt(0);
  const arrearsFactsReversed = [...facts].reverse();
  const latestArrearsFact = arrearsFactsReversed.find(f => f.type === "LOAN_IN_ARREARS");
  if (latestArrearsFact && latestArrearsFact.type === "LOAN_IN_ARREARS") {
    daysPastDue = latestArrearsFact.daysPastDue;
    amountOverdue = latestArrearsFact.amountOverdue;
  }

  // Get first fact (LOAN_OFFERED) for offeredAt timestamp
  const offeredFact = facts[0];
  const offeredAt = offeredFact.type === "LOAN_OFFERED" ? new Date(offeredFact.occurredAt) : new Date();

  // Upsert loan projection
  const existing = await db
    .select()
    .from(loans)
    .where(eq(loans.loanId, loanId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(loans)
      .set({
        state: loan.state,
        disbursementAccountId: loan.disbursementAccountId,
        activatedAt: loan.activatedAt ? new Date(loan.activatedAt) : null,
        closedAt: loan.closedAt ? new Date(loan.closedAt) : null,
        totalPaid: totalPaid.toString(),
        principalPaid: principalPaid.toString(),
        interestPaid: interestPaid.toString(),
        feesPaid: feesPaid.toString(),
        daysPastDue,
        amountOverdue: amountOverdue.toString(),
        updatedAt: new Date(),
      })
      .where(eq(loans.loanId, loanId));
  } else {
    await db.insert(loans).values({
      loanId: loan.loanId,
      borrowerAccountId: loan.borrowerAccountId,
      principal: loan.principal.toString(),
      interestRate: loan.interestRate.toString(),
      termMonths: loan.termMonths,
      state: loan.state,
      disbursementAccountId: loan.disbursementAccountId,
      activatedAt: loan.activatedAt ? new Date(loan.activatedAt) : null,
      closedAt: loan.closedAt ? new Date(loan.closedAt) : null,
      totalPaid: totalPaid.toString(),
      principalPaid: principalPaid.toString(),
      interestPaid: interestPaid.toString(),
      feesPaid: feesPaid.toString(),
      daysPastDue,
      amountOverdue: amountOverdue.toString(),
      offeredAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

export const lendingRouter = router({
  /**
   * Offer a new loan
   */
  offerLoan: publicProcedure
    .input(
      z.object({
        borrowerAccountId: z.string(),
        principal: z.string(), // BigInt as string
        interestRate: z.number(), // 0.05 for 5%
        termMonths: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const loanId = `LOAN-${nanoid(12)}`;

      const fact: LoanFact = {
        type: "LOAN_OFFERED",
        loanId,
        borrowerAccountId: input.borrowerAccountId,
        principal: BigInt(input.principal),
        interestRate: input.interestRate,
        termMonths: input.termMonths,
        occurredAt: Date.now(),
      };

      await appendFact(db, fact);
      await updateLoanProjection(db, loanId);

      return { loanId, fact };
    }),

  /**
   * Accept a loan offer
   */
  acceptLoan: publicProcedure
    .input(z.object({ loanId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      const fact: LoanFact = {
        type: "LOAN_ACCEPTED",
        loanId: input.loanId,
        occurredAt: Date.now(),
      };

      await appendFact(db, fact);
      await updateLoanProjection(db, input.loanId);

      return { loanId: input.loanId, fact };
    }),

  /**
   * Activate a loan (disburse funds)
   */
  activateLoan: publicProcedure
    .input(
      z.object({
        loanId: z.string(),
        disbursementAccountId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      const fact: LoanFact = {
        type: "LOAN_ACTIVATED",
        loanId: input.loanId,
        disbursementAccountId: input.disbursementAccountId,
        occurredAt: Date.now(),
      };

      await appendFact(db, fact);
      await updateLoanProjection(db, input.loanId);

      return { loanId: input.loanId, fact };
    }),

  /**
   * Apply a repayment to a loan
   */
  applyRepayment: publicProcedure
    .input(
      z.object({
        loanId: z.string(),
        amount: z.string(), // BigInt as string
        principalPortion: z.string(),
        interestPortion: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      const fact: LoanFact = {
        type: "LOAN_PAYMENT_APPLIED",
        loanId: input.loanId,
        amount: BigInt(input.amount),
        principalPortion: BigInt(input.principalPortion),
        interestPortion: BigInt(input.interestPortion),
        occurredAt: Date.now(),
      };

      await appendFact(db, fact);
      await updateLoanProjection(db, input.loanId);

      return { loanId: input.loanId, fact };
    }),

  /**
   * Enter hardship arrangement
   */
  enterHardship: publicProcedure
    .input(
      z.object({
        loanId: z.string(),
        reason: z.string(),
        approvedBy: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      const fact: LoanFact = {
        type: "HARDSHIP_ENTERED",
        loanId: input.loanId,
        reason: input.reason,
        approvedBy: input.approvedBy,
        occurredAt: Date.now(),
      };

      await appendFact(db, fact);
      await updateLoanProjection(db, input.loanId);

      return { loanId: input.loanId, fact };
    }),

  /**
   * Close a loan (fully repaid)
   */
  closeLoan: publicProcedure
    .input(
      z.object({
        loanId: z.string(),
        finalPaymentAmount: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      const fact: LoanFact = {
        type: "LOAN_CLOSED",
        loanId: input.loanId,
        finalPaymentAmount: BigInt(input.finalPaymentAmount),
        occurredAt: Date.now(),
      };

      await appendFact(db, fact);
      await updateLoanProjection(db, input.loanId);

      return { loanId: input.loanId, fact };
    }),

  /**
   * List all loans
   */
  listLoans: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const allLoans = await db.select().from(loans).orderBy(desc(loans.createdAt));
    return allLoans;
  }),

  /**
   * Get a specific loan
   */
  getLoan: publicProcedure
    .input(z.object({ loanId: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const loan = await db
        .select()
        .from(loans)
        .where(eq(loans.loanId, input.loanId))
        .limit(1);

      return loan[0] || null;
    }),

  /**
   * Get loan facts (for timeline/audit)
   */
  getLoanFacts: publicProcedure
    .input(z.object({ loanId: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const facts = await loadFacts(db, input.loanId);
      return facts;
    }),

  /**
   * Rebuild loan from facts (replay proof)
   */
  rebuildLoan: publicProcedure
    .input(z.object({ loanId: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const facts = await loadFacts(db, input.loanId);
      
      if (facts.length === 0) {
        throw new Error(`No facts found for loan ${input.loanId}`);
      }

      const loan = rebuildFromFacts(facts);
      return {
        loanId: loan.loanId,
        state: loan.state,
        principal: loan.principal.toString(),
        borrowerAccountId: loan.borrowerAccountId,
        interestRate: loan.interestRate,
        termMonths: loan.termMonths,
        factCount: facts.length,
      };
    }),
});
