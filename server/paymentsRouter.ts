/**
 * Payments Core v1 tRPC Router
 * 
 * CRITICAL ARCHITECTURE:
 * - Payments emits intent, Deposits emits truth
 * - Every endpoint: emits payment facts, invokes Deposits Core postings, returns both outcomes
 * - Payments CANNOT bypass Deposits
 * 
 * This router proves the architecture to buyers, regulators, and boards.
 */

import { z } from "zod";
import { router, publicProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { paymentFacts, payments, depositFacts, depositAccounts, depositHolds } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

// ============================================
// HELPER: Rebuild state from facts (same as depositsRouter)
// ============================================

type JsonMoney = { amount: string; currency: string };
type JsonPosting = 
  | { type: "CREDIT"; amount: JsonMoney }
  | { type: "DEBIT"; amount: JsonMoney }
  | { type: "HOLD_PLACED"; amount: JsonMoney; holdId: string }
  | { type: "HOLD_RELEASED"; holdId: string }
  | { type: "INTEREST_ACCRUED"; amount: JsonMoney };

type JsonFact =
  | { type: "ACCOUNT_OPENED"; currency: string }
  | { type: "POSTING_APPLIED"; posting: JsonPosting }
  | { type: "ACCOUNT_CLOSED" };

async function loadDepositFacts(db: Awaited<ReturnType<typeof getDb>>, accountId: string): Promise<JsonFact[]> {
  if (!db) return [];
  const rows = await db
    .select()
    .from(depositFacts)
    .where(eq(depositFacts.accountId, accountId));
  
  return rows.map((row: any) => row.factData as JsonFact);
}

function rebuildDepositState(facts: JsonFact[]): {
  ledgerBalance: bigint;
  availableBalance: bigint;
  holds: { id: string; amount: JsonMoney }[];
} {
  let ledgerBalance = BigInt(0);
  let availableBalance = BigInt(0);
  const holds: { id: string; amount: JsonMoney }[] = [];
  
  for (const fact of facts) {
    if (fact.type === "POSTING_APPLIED") {
      const posting = fact.posting;
      if (posting.type === "CREDIT") {
        const amt = BigInt(posting.amount.amount);
        ledgerBalance += amt;
        availableBalance += amt;
      } else if (posting.type === "DEBIT") {
        const amt = BigInt(posting.amount.amount);
        ledgerBalance -= amt;
        availableBalance -= amt;
      } else if (posting.type === "HOLD_PLACED") {
        const amt = BigInt(posting.amount.amount);
        availableBalance -= amt;
        holds.push({
          id: posting.holdId,
          amount: posting.amount,
        });
      } else if (posting.type === "HOLD_RELEASED") {
        const holdIndex = holds.findIndex(h => h.id === posting.holdId);
        if (holdIndex >= 0) {
          const hold = holds[holdIndex];
          availableBalance += BigInt(hold.amount.amount);
          holds.splice(holdIndex, 1);
        }
      } else if (posting.type === "INTEREST_ACCRUED") {
        const amt = BigInt(posting.amount.amount);
        ledgerBalance += amt;
        availableBalance += amt;
      }
    }
  }
  
  return { ledgerBalance, availableBalance, holds };
}

function formatMoney(cents: bigint): string {
  const isNegative = cents < BigInt(0);
  const absCents = isNegative ? -cents : cents;
  const dollars = absCents / BigInt(100);
  const remainder = absCents % BigInt(100);
  const sign = isNegative ? "-" : "";
  return `${sign}${dollars}.${remainder.toString().padStart(2, "0")}`;
}

// ============================================
// TRPC ROUTER
// ============================================

export const paymentsRouter = router({
  /**
   * Get all payments.
   */
  getAll: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const allPayments = await db.select().from(payments).orderBy(desc(payments.createdAt));
    return allPayments;
  }),

  /**
   * Get payment by ID with full fact history.
   */
  getById: publicProcedure
    .input(z.object({ paymentId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const payment = await db.select()
        .from(payments)
        .where(eq(payments.paymentId, input.paymentId))
        .limit(1);

      if (payment.length === 0) {
        return { payment: null, facts: [] };
      }

      const facts = await db.select()
        .from(paymentFacts)
        .where(eq(paymentFacts.paymentId, input.paymentId))
        .orderBy(paymentFacts.sequence);

      return {
        payment: payment[0],
        facts,
      };
    }),

  /**
   * INITIATE PAYMENT
   * 
   * Emits: PAYMENT_INITIATED fact
   * Deposits: None (no balance impact yet)
   * Returns: Payment state
   */
  initiatePayment: publicProcedure
    .input(z.object({
      fromAccount: z.string(),
      toAccount: z.string().optional(),
      toExternal: z.object({
        type: z.string(),
        identifier: z.string(),
        name: z.string(),
        bankCode: z.string().optional(),
      }).optional(),
      amount: z.string(),
      currency: z.string().default("AUD"),
      reference: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const paymentId = `PAY-${nanoid(12)}`;
      const now = new Date();

      // Validate: must have either toAccount or toExternal
      if (!input.toAccount && !input.toExternal) {
        return {
          success: false,
          error: "Must specify either toAccount or toExternal",
          payment: null,
          depositOutcome: null,
        };
      }

      // Validate: cannot have both toAccount and toExternal
      if (input.toAccount && input.toExternal) {
        return {
          success: false,
          error: "Cannot specify both toAccount and toExternal",
          payment: null,
          depositOutcome: null,
        };
      }

      // Validate: fromAccount must exist
      const fromAccount = await db.select()
        .from(depositAccounts)
        .where(eq(depositAccounts.accountId, input.fromAccount))
        .limit(1);

      if (fromAccount.length === 0) {
        return {
          success: false,
          error: "Source account not found",
          payment: null,
          depositOutcome: null,
        };
      }

      // If internal transfer, validate toAccount exists
      if (input.toAccount) {
        const toAccount = await db.select()
          .from(depositAccounts)
          .where(eq(depositAccounts.accountId, input.toAccount))
          .limit(1);

        if (toAccount.length === 0) {
          return {
            success: false,
            error: "Destination account not found",
            payment: null,
            depositOutcome: null,
          };
        }

        // Cannot transfer to same account
        if (input.fromAccount === input.toAccount) {
          return {
            success: false,
            error: "Cannot transfer to same account",
            payment: null,
            depositOutcome: null,
          };
        }
      }

      // Emit PAYMENT_INITIATED fact
      const factData = {
        fromAccount: input.fromAccount,
        toAccount: input.toAccount || null,
        toExternal: input.toExternal || null,
        amount: input.amount,
        currency: input.currency,
        reference: input.reference || null,
        description: input.description || null,
      };

      await db.insert(paymentFacts).values({
        paymentId,
        sequence: 1,
        factType: "PAYMENT_INITIATED",
        factData,
        occurredAt: now,
      });

      // Create payment projection
      await db.insert(payments).values({
        paymentId,
        fromAccount: input.fromAccount,
        toAccount: input.toAccount || null,
        toExternal: input.toExternal || null,
        amount: input.amount,
        currency: input.currency,
        state: "INITIATED",
        reference: input.reference || null,
        description: input.description || null,
        initiatedAt: now,
      });

      return {
        success: true,
        error: null,
        payment: {
          paymentId,
          state: "INITIATED",
          fromAccount: input.fromAccount,
          toAccount: input.toAccount || null,
          amount: input.amount,
          currency: input.currency,
        },
        depositOutcome: null, // No deposit operation for initiate
      };
    }),

  /**
   * PLACE HOLD
   * 
   * Emits: PAYMENT_HOLD_PLACED fact
   * Deposits: HOLD_PLACED posting
   * Returns: Payment state + Deposit outcome
   */
  placeHold: publicProcedure
    .input(z.object({
      paymentId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const now = new Date();

      // Load payment
      const payment = await db.select()
        .from(payments)
        .where(eq(payments.paymentId, input.paymentId))
        .limit(1);

      if (payment.length === 0) {
        return {
          success: false,
          error: "Payment not found",
          payment: null,
          depositOutcome: null,
        };
      }

      const p = payment[0];

      // Validate state
      if (p.state !== "INITIATED") {
        return {
          success: false,
          error: `Cannot place hold on payment in state ${p.state}`,
          payment: { paymentId: p.paymentId, state: p.state },
          depositOutcome: null,
        };
      }

      // Generate hold ID
      const holdId = `HOLD-${nanoid(12)}`;

      // Rebuild state from facts (source of truth)
      const facts = await loadDepositFacts(db, p.fromAccount);
      if (facts.length === 0) {
        return {
          success: false,
          error: "ACCOUNT_NOT_FOUND",
          payment: { paymentId: p.paymentId, state: p.state },
          depositOutcome: { success: false, error: "ACCOUNT_NOT_FOUND" },
        };
      }

      const state = rebuildDepositState(facts);
      const available = Number(state.availableBalance) / 100; // Convert cents to dollars
      const holdAmount = parseFloat(p.amount);

      if (holdAmount > available) {
        // Emit PAYMENT_FAILED fact
        const existingFacts = await db.select().from(paymentFacts).where(eq(paymentFacts.paymentId, input.paymentId));
        const sequence = existingFacts.length + 1;
        
        await db.insert(paymentFacts).values({
          paymentId: input.paymentId,
          sequence,
          factType: "PAYMENT_FAILED",
          factData: {
            reason: "Hold placement failed: INSUFFICIENT_AVAILABLE_BALANCE",
            failureCode: "INSUFFICIENT_AVAILABLE_BALANCE",
            recoverable: true,
          },
          occurredAt: now,
        });

        await db.update(payments)
          .set({
            state: "FAILED",
            failureReason: "Hold placement failed: INSUFFICIENT_AVAILABLE_BALANCE",
            failedAt: now,
            updatedAt: now,
          })
          .where(eq(payments.paymentId, input.paymentId));

        return {
          success: false,
          error: "INSUFFICIENT_AVAILABLE_BALANCE",
          payment: { paymentId: p.paymentId, state: "FAILED" },
          depositOutcome: { success: false, error: "INSUFFICIENT_AVAILABLE_BALANCE" },
        };
      }

      // INVOKE DEPOSITS CORE: Create deposit fact for hold
      const depositFactsExisting = await db.select().from(depositFacts).where(eq(depositFacts.accountId, p.fromAccount));
      const depositSeq = depositFactsExisting.length + 1;

      const [insertedDepositFact] = await db.insert(depositFacts).values({
        factId: `FACT-${nanoid(12)}`,
        accountId: p.fromAccount,
        sequence: depositSeq,
        factType: "POSTING_APPLIED",
        factData: {
          type: "HOLD_PLACED",
          holdId,
          amount: { amount: (holdAmount * 100).toString(), currency: p.currency },
          reason: `Payment ${input.paymentId}`,
        },
        occurredAt: now,
      }).$returningId();

      // Update account projection
      await db.update(depositAccounts)
        .set({
          availableBalance: (available - holdAmount).toFixed(2),
          updatedAt: now,
        })
        .where(eq(depositAccounts.accountId, p.fromAccount));

      // Create hold record
      await db.insert(depositHolds).values({
        holdId,
        accountId: p.fromAccount,
        amount: p.amount,
        currency: p.currency,
        holdType: "PAYMENT",
        reason: `Payment ${input.paymentId}`,
        status: "ACTIVE",
        placedAt: now,
      });

      // Emit PAYMENT_HOLD_PLACED fact
      const existingPaymentFacts = await db.select().from(paymentFacts).where(eq(paymentFacts.paymentId, input.paymentId));
      const paymentSeq = existingPaymentFacts.length + 1;

      await db.insert(paymentFacts).values({
        paymentId: input.paymentId,
        sequence: paymentSeq,
        factType: "PAYMENT_HOLD_PLACED",
        factData: {
          holdId,
          amount: p.amount,
          currency: p.currency,
        },
        depositFactId: insertedDepositFact.id,
        depositPostingType: "HOLD_PLACED",
        occurredAt: now,
      });

      // Update payment projection
      await db.update(payments)
        .set({
          state: "HELD",
          activeHoldId: holdId,
          updatedAt: now,
        })
        .where(eq(payments.paymentId, input.paymentId));

      return {
        success: true,
        error: null,
        payment: {
          paymentId: p.paymentId,
          state: "HELD",
          holdId,
        },
        depositOutcome: {
          success: true,
          depositFactId: insertedDepositFact.id,
          postingType: "HOLD_PLACED",
        },
      };
    }),

  /**
   * SETTLE PAYMENT
   * 
   * Emits: PAYMENT_SENT + PAYMENT_SETTLED facts
   * Deposits: DEBIT (source) + CREDIT (destination if internal)
   * Returns: Payment state + Deposit outcomes
   */
  settlePayment: publicProcedure
    .input(z.object({
      paymentId: z.string(),
      settlementReference: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const now = new Date();

      // Load payment
      const payment = await db.select()
        .from(payments)
        .where(eq(payments.paymentId, input.paymentId))
        .limit(1);

      if (payment.length === 0) {
        return {
          success: false,
          error: "Payment not found",
          payment: null,
          depositOutcomes: [],
        };
      }

      const p = payment[0];

      // Validate state
      if (p.state !== "HELD" && p.state !== "AUTHORISED") {
        return {
          success: false,
          error: `Cannot settle payment in state ${p.state}`,
          payment: { paymentId: p.paymentId, state: p.state },
          depositOutcomes: [],
        };
      }

      const depositOutcomes: Array<{ operation: string; success: boolean; depositFactId?: number; error?: string }> = [];

      // INVOKE DEPOSITS CORE: Release hold and debit source
      if (p.activeHoldId) {
        // Get account and hold
        const account = await db.select()
          .from(depositAccounts)
          .where(eq(depositAccounts.accountId, p.fromAccount))
          .limit(1);

        const hold = await db.select()
          .from(depositHolds)
          .where(and(
            eq(depositHolds.holdId, p.activeHoldId),
            eq(depositHolds.status, "ACTIVE")
          ))
          .limit(1);

        if (account.length === 0 || hold.length === 0) {
          return {
            success: false,
            error: "Account or hold not found",
            payment: { paymentId: p.paymentId, state: p.state },
            depositOutcomes: [],
          };
        }

        const acc = account[0];
        const ledger = parseFloat(acc.ledgerBalance);
        const available = parseFloat(acc.availableBalance);
        const holdAmount = parseFloat(hold[0].amount);
        const debitAmount = parseFloat(p.amount);

        // Create deposit fact for debit
        const depositFactsExisting = await db.select().from(depositFacts).where(eq(depositFacts.accountId, p.fromAccount));
        const depositSeq = depositFactsExisting.length + 1;

        const [insertedDebitFact] = await db.insert(depositFacts).values({
          factId: `FACT-${nanoid(12)}`,
          accountId: p.fromAccount,
          sequence: depositSeq,
          factType: "POSTING_APPLIED",
          factData: {
            type: "DEBIT",
            amount: { amount: (debitAmount * 100).toString(), currency: p.currency },
            releasedHoldId: p.activeHoldId,
          },
          occurredAt: now,
        }).$returningId();

        // Update account projection: debit from ledger, restore available from hold
        await db.update(depositAccounts)
          .set({
            ledgerBalance: (ledger - debitAmount).toFixed(2),
            availableBalance: (available + holdAmount - debitAmount).toFixed(2),
            updatedAt: now,
          })
          .where(eq(depositAccounts.accountId, p.fromAccount));

        // Release hold
        await db.update(depositHolds)
          .set({
            status: "RELEASED",
            releasedAt: now,
            updatedAt: now,
          })
          .where(eq(depositHolds.holdId, p.activeHoldId));

        depositOutcomes.push({
          operation: "RELEASE_HOLD_AND_DEBIT",
          success: true,
          depositFactId: insertedDebitFact.id,
        });
      }

      // Emit PAYMENT_SENT fact
      const existingPaymentFacts1 = await db.select().from(paymentFacts).where(eq(paymentFacts.paymentId, input.paymentId));
      let paymentSeq = existingPaymentFacts1.length + 1;

      await db.insert(paymentFacts).values({
        paymentId: input.paymentId,
        sequence: paymentSeq,
        factType: "PAYMENT_SENT",
        factData: {
          networkReference: input.settlementReference || null,
        },
        occurredAt: now,
      });

      // If internal transfer, credit destination
      if (p.toAccount) {
        const destAccount = await db.select()
          .from(depositAccounts)
          .where(eq(depositAccounts.accountId, p.toAccount))
          .limit(1);

        if (destAccount.length > 0) {
          const dest = destAccount[0];
          const destLedger = parseFloat(dest.ledgerBalance);
          const destAvailable = parseFloat(dest.availableBalance);
          const creditAmount = parseFloat(p.amount);

          // Create deposit fact for credit
          const destFactsExisting = await db.select().from(depositFacts).where(eq(depositFacts.accountId, p.toAccount));
          const destSeq = destFactsExisting.length + 1;

          const [insertedCreditFact] = await db.insert(depositFacts).values({
            factId: `FACT-${nanoid(12)}`,
            accountId: p.toAccount,
            sequence: destSeq,
            factType: "POSTING_APPLIED",
            factData: {
              type: "CREDIT",
              amount: { amount: (creditAmount * 100).toString(), currency: p.currency },
              reference: `Payment ${input.paymentId}`,
            },
            occurredAt: now,
          }).$returningId();

          // Update destination account projection
          await db.update(depositAccounts)
            .set({
              ledgerBalance: (destLedger + creditAmount).toFixed(2),
              availableBalance: (destAvailable + creditAmount).toFixed(2),
              updatedAt: now,
            })
            .where(eq(depositAccounts.accountId, p.toAccount));

          depositOutcomes.push({
            operation: "CREDIT_DESTINATION",
            success: true,
            depositFactId: insertedCreditFact.id,
          });
        }
      }

      // Emit PAYMENT_SETTLED fact
      const existingPaymentFacts2 = await db.select().from(paymentFacts).where(eq(paymentFacts.paymentId, input.paymentId));
      paymentSeq = existingPaymentFacts2.length + 1;

      await db.insert(paymentFacts).values({
        paymentId: input.paymentId,
        sequence: paymentSeq,
        factType: "PAYMENT_SETTLED",
        factData: {
          settlementReference: input.settlementReference || null,
        },
        occurredAt: now,
      });

      // Update payment projection
      await db.update(payments)
        .set({
          state: "SETTLED",
          settledAt: now,
          activeHoldId: null,
          updatedAt: now,
        })
        .where(eq(payments.paymentId, input.paymentId));

      return {
        success: true,
        error: null,
        payment: {
          paymentId: p.paymentId,
          state: "SETTLED",
          settledAt: now.toISOString(),
        },
        depositOutcomes,
      };
    }),

  /**
   * REVERSE PAYMENT
   * 
   * Emits: PAYMENT_REVERSED fact
   * Deposits: CREDIT (refund to source)
   * Returns: Payment state + Deposit outcome
   */
  reversePayment: publicProcedure
    .input(z.object({
      paymentId: z.string(),
      reason: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const now = new Date();

      // Load payment
      const payment = await db.select()
        .from(payments)
        .where(eq(payments.paymentId, input.paymentId))
        .limit(1);

      if (payment.length === 0) {
        return {
          success: false,
          error: "Payment not found",
          payment: null,
          depositOutcome: null,
        };
      }

      const p = payment[0];

      // Validate state - can only reverse SETTLED payments
      if (p.state !== "SETTLED") {
        return {
          success: false,
          error: `Cannot reverse payment in state ${p.state}. Only SETTLED payments can be reversed.`,
          payment: { paymentId: p.paymentId, state: p.state },
          depositOutcome: null,
        };
      }

      // INVOKE DEPOSITS CORE: Credit source (refund)
      const account = await db.select()
        .from(depositAccounts)
        .where(eq(depositAccounts.accountId, p.fromAccount))
        .limit(1);

      if (account.length === 0) {
        return {
          success: false,
          error: "Source account not found",
          payment: { paymentId: p.paymentId, state: p.state },
          depositOutcome: { success: false, error: "ACCOUNT_NOT_FOUND" },
        };
      }

      const acc = account[0];
      const ledger = parseFloat(acc.ledgerBalance);
      const available = parseFloat(acc.availableBalance);
      const creditAmount = parseFloat(p.amount);

      // Create deposit fact for refund credit
      const depositFactsExisting = await db.select().from(depositFacts).where(eq(depositFacts.accountId, p.fromAccount));
      const depositSeq = depositFactsExisting.length + 1;

      const [insertedRefundFact] = await db.insert(depositFacts).values({
        factId: `FACT-${nanoid(12)}`,
        accountId: p.fromAccount,
        sequence: depositSeq,
        factType: "POSTING_APPLIED",
        factData: {
          type: "CREDIT",
          amount: { amount: (creditAmount * 100).toString(), currency: p.currency },
          reference: `Reversal of ${input.paymentId}: ${input.reason}`,
        },
        occurredAt: now,
      }).$returningId();

      // Update account projection
      await db.update(depositAccounts)
        .set({
          ledgerBalance: (ledger + creditAmount).toFixed(2),
          availableBalance: (available + creditAmount).toFixed(2),
          updatedAt: now,
        })
        .where(eq(depositAccounts.accountId, p.fromAccount));

      // Emit PAYMENT_REVERSED fact
      const existingPaymentFacts = await db.select().from(paymentFacts).where(eq(paymentFacts.paymentId, input.paymentId));
      const paymentSeq = existingPaymentFacts.length + 1;

      await db.insert(paymentFacts).values({
        paymentId: input.paymentId,
        sequence: paymentSeq,
        factType: "PAYMENT_REVERSED",
        factData: {
          reason: input.reason,
        },
        depositFactId: insertedRefundFact.id,
        depositPostingType: "CREDIT",
        occurredAt: now,
      });

      // Update payment projection
      await db.update(payments)
        .set({
          state: "REVERSED",
          reversalReason: input.reason,
          reversedAt: now,
          updatedAt: now,
        })
        .where(eq(payments.paymentId, input.paymentId));

      return {
        success: true,
        error: null,
        payment: {
          paymentId: p.paymentId,
          state: "REVERSED",
          reversedAt: now.toISOString(),
        },
        depositOutcome: {
          success: true,
          depositFactId: insertedRefundFact.id,
          postingType: "CREDIT",
          operation: "REFUND",
        },
      };
    }),
});
