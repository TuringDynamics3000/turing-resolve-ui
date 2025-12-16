/**
 * depositsRouter.ts - Deposits Core v1 tRPC Routes
 * 
 * Exposes the Deposits Core v1 functionality via tRPC.
 * Uses JSON facts stored in database - the core types are used
 * for business logic validation, not for storage.
 */
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { nanoid } from "nanoid";
import { eq, asc, desc } from "drizzle-orm";
import { depositFacts, depositAccounts } from "../drizzle/schema";

// Simple JSON types for storage (not the core Money class)
type JsonMoney = { amount: string; currency: string };
type JsonPosting = 
  | { type: "CREDIT"; amount: JsonMoney; occurredAt: string; reference?: string }
  | { type: "DEBIT"; amount: JsonMoney; occurredAt: string; reference?: string }
  | { type: "HOLD_PLACED"; amount: JsonMoney; holdId: string; reason?: string; occurredAt: string }
  | { type: "HOLD_RELEASED"; holdId: string; occurredAt: string }
  | { type: "INTEREST_ACCRUED"; amount: JsonMoney; period?: string; occurredAt: string };

type JsonFact =
  | { type: "ACCOUNT_OPENED"; accountId: string; currency: string; occurredAt: string }
  | { type: "POSTING_APPLIED"; accountId: string; posting: JsonPosting; sequence: number; occurredAt: string }
  | { type: "ACCOUNT_CLOSED"; accountId: string; reason?: string; occurredAt: string };

/**
 * Get next sequence number for an account.
 */
async function getNextSequence(db: any, accountId: string): Promise<number> {
  const result = await db
    .select({ sequence: depositFacts.sequence })
    .from(depositFacts)
    .where(eq(depositFacts.accountId, accountId))
    .orderBy(desc(depositFacts.sequence))
    .limit(1);
  
  return result.length > 0 ? result[0].sequence + 1 : 1;
}

/**
 * Append a fact to the database.
 */
async function appendFact(db: any, fact: JsonFact): Promise<void> {
  const factId = `FACT-${nanoid(12)}`;
  let sequence = 0;
  
  if (fact.type === "POSTING_APPLIED") {
    sequence = fact.sequence;
  } else {
    sequence = await getNextSequence(db, fact.accountId);
  }
  
  await db.insert(depositFacts).values({
    factId,
    accountId: fact.accountId,
    factType: fact.type,
    sequence,
    factData: fact, // The full fact object as JSON
    occurredAt: new Date(fact.occurredAt),
    createdAt: new Date(),
  });
}

/**
 * Load all facts for an account.
 */
async function loadFacts(db: any, accountId: string): Promise<JsonFact[]> {
  const rows = await db
    .select()
    .from(depositFacts)
    .where(eq(depositFacts.accountId, accountId))
    .orderBy(asc(depositFacts.sequence));
  
  return rows.map((row: any) => row.factData as JsonFact);
}

/**
 * Rebuild account state from facts.
 */
function rebuildState(facts: JsonFact[]): {
  ledgerBalance: bigint;
  availableBalance: bigint;
  holds: { id: string; amount: JsonMoney }[];
  status: "OPEN" | "CLOSED";
  currency: string;
} {
  let ledgerBalance = BigInt(0);
  let availableBalance = BigInt(0);
  const holds: { id: string; amount: JsonMoney }[] = [];
  let status: "OPEN" | "CLOSED" = "OPEN";
  let currency = "AUD";
  
  for (const fact of facts) {
    if (fact.type === "ACCOUNT_OPENED") {
      currency = fact.currency;
    } else if (fact.type === "POSTING_APPLIED") {
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
    } else if (fact.type === "ACCOUNT_CLOSED") {
      status = "CLOSED";
    }
  }
  
  return { ledgerBalance, availableBalance, holds, status, currency };
}

/**
 * Format cents to decimal string.
 */
function formatMoney(cents: bigint): string {
  const isNegative = cents < BigInt(0);
  const absCents = isNegative ? -cents : cents;
  const dollars = absCents / BigInt(100);
  const remainder = absCents % BigInt(100);
  const sign = isNegative ? "-" : "";
  return `${sign}${dollars}.${remainder.toString().padStart(2, "0")}`;
}

export const depositsRouter = router({
  // ============================================
  // ACCOUNT OPERATIONS
  // ============================================
  
  /**
   * Open a new deposit account.
   */
  openAccount: publicProcedure
    .input(z.object({
      accountId: z.string().optional(),
      currency: z.string().length(3).default("AUD"),
      productType: z.enum(["savings", "checking", "term_deposit"]),
      customerId: z.string(),
      customerSegment: z.enum(["standard", "premium", "business", "private"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const accountId = input.accountId || `DEP-${nanoid(12)}`;
      const now = new Date().toISOString();
      
      // Create ACCOUNT_OPENED fact
      const fact: JsonFact = {
        type: "ACCOUNT_OPENED",
        accountId,
        currency: input.currency,
        occurredAt: now,
      };
      
      await appendFact(db, fact);
      
      // Save account metadata
      await db.insert(depositAccounts).values({
        accountId,
        customerId: input.customerId,
        productType: input.productType,
        customerSegment: input.customerSegment || "standard",
        currency: input.currency,
        status: "OPEN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      return {
        success: true,
        accountId,
        fact,
      };
    }),
  
  /**
   * List all deposit accounts.
   */
  listAccounts: publicProcedure
    .input(z.object({
      status: z.enum(["OPEN", "CLOSED"]).optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const accounts = input?.status 
        ? await db.select().from(depositAccounts).where(eq(depositAccounts.status, input.status))
        : await db.select().from(depositAccounts);
      
      // Rebuild state for each account
      const results = await Promise.all(
        accounts.map(async (account: any) => {
          const facts = await loadFacts(db, account.accountId);
          const state = rebuildState(facts);
          
          return {
            ...account,
            ledgerBalance: formatMoney(state.ledgerBalance),
            availableBalance: formatMoney(state.availableBalance),
            holdsCount: state.holds.length,
            factCount: facts.length,
          };
        })
      );
      
      return results;
    }),
  
  /**
   * Get account details with rebuilt state.
   */
  getAccount: publicProcedure
    .input(z.object({
      accountId: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      
      const accounts = await db
        .select()
        .from(depositAccounts)
        .where(eq(depositAccounts.accountId, input.accountId));
      
      if (accounts.length === 0) return null;
      
      const metadata = accounts[0];
      const facts = await loadFacts(db, input.accountId);
      const state = rebuildState(facts);
      
      return {
        metadata,
        state: {
          id: input.accountId,
          ledgerBalance: formatMoney(state.ledgerBalance),
          availableBalance: formatMoney(state.availableBalance),
          holds: state.holds.map(h => ({
            id: h.id,
            amount: formatMoney(BigInt(h.amount.amount)),
            currency: h.amount.currency,
          })),
          status: state.status,
          currency: state.currency,
        },
        facts,
      };
    }),
  
  /**
   * Close an account.
   */
  closeAccount: publicProcedure
    .input(z.object({
      accountId: z.string(),
      reason: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const now = new Date().toISOString();
      
      // Create ACCOUNT_CLOSED fact
      const fact: JsonFact = {
        type: "ACCOUNT_CLOSED",
        accountId: input.accountId,
        reason: input.reason,
        occurredAt: now,
      };
      
      await appendFact(db, fact);
      
      // Update account status
      await db
        .update(depositAccounts)
        .set({ status: "CLOSED", updatedAt: new Date() })
        .where(eq(depositAccounts.accountId, input.accountId));
      
      return {
        success: true,
        accountId: input.accountId,
        fact,
      };
    }),
  
  // ============================================
  // POSTING OPERATIONS
  // ============================================
  
  /**
   * Credit an account (add money).
   */
  credit: publicProcedure
    .input(z.object({
      accountId: z.string(),
      amount: z.string(), // Decimal string e.g., "100.00"
      currency: z.string().length(3).default("AUD"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const now = new Date().toISOString();
      const amountCents = Math.round(parseFloat(input.amount) * 100).toString();
      const sequence = await getNextSequence(db, input.accountId);
      
      const fact: JsonFact = {
        type: "POSTING_APPLIED",
        accountId: input.accountId,
        posting: {
          type: "CREDIT",
          amount: { amount: amountCents, currency: input.currency },
          occurredAt: now,
        },
        sequence,
        occurredAt: now,
      };
      
      await appendFact(db, fact);
      
      return {
        success: true,
        accountId: input.accountId,
        fact,
      };
    }),
  
  /**
   * Debit an account (remove money).
   */
  debit: publicProcedure
    .input(z.object({
      accountId: z.string(),
      amount: z.string(),
      currency: z.string().length(3).default("AUD"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Check available balance first
      const facts = await loadFacts(db, input.accountId);
      const state = rebuildState(facts);
      const amountCents = BigInt(Math.round(parseFloat(input.amount) * 100));
      
      if (state.availableBalance < amountCents) {
        throw new Error("INSUFFICIENT_FUNDS: Available balance is less than debit amount");
      }
      
      const now = new Date().toISOString();
      const sequence = await getNextSequence(db, input.accountId);
      
      const fact: JsonFact = {
        type: "POSTING_APPLIED",
        accountId: input.accountId,
        posting: {
          type: "DEBIT",
          amount: { amount: amountCents.toString(), currency: input.currency },
          occurredAt: now,
        },
        sequence,
        occurredAt: now,
      };
      
      await appendFact(db, fact);
      
      return {
        success: true,
        accountId: input.accountId,
        fact,
      };
    }),
  
  /**
   * Place a hold on an account.
   */
  placeHold: publicProcedure
    .input(z.object({
      accountId: z.string(),
      amount: z.string(),
      currency: z.string().length(3).default("AUD"),
      holdType: z.enum(["PAYMENT", "DEPOSIT", "REGULATORY", "LEGAL"]).default("PAYMENT"),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Check available balance first
      const facts = await loadFacts(db, input.accountId);
      const state = rebuildState(facts);
      const amountCents = BigInt(Math.round(parseFloat(input.amount) * 100));
      
      if (state.availableBalance < amountCents) {
        throw new Error("INSUFFICIENT_FUNDS: Available balance is less than hold amount");
      }
      
      const now = new Date().toISOString();
      const holdId = `HOLD-${input.holdType}-${nanoid(8)}`;
      const sequence = await getNextSequence(db, input.accountId);
      
      const fact: JsonFact = {
        type: "POSTING_APPLIED",
        accountId: input.accountId,
        posting: {
          type: "HOLD_PLACED",
          amount: { amount: amountCents.toString(), currency: input.currency },
          holdId,
          reason: input.reason,
          occurredAt: now,
        },
        sequence,
        occurredAt: now,
      };
      
      await appendFact(db, fact);
      
      return {
        success: true,
        accountId: input.accountId,
        holdId,
        fact,
      };
    }),
  
  /**
   * Release a hold.
   */
  releaseHold: publicProcedure
    .input(z.object({
      accountId: z.string(),
      holdId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Check hold exists
      const facts = await loadFacts(db, input.accountId);
      const state = rebuildState(facts);
      const hold = state.holds.find(h => h.id === input.holdId);
      
      if (!hold) {
        throw new Error("HOLD_NOT_FOUND: No hold exists with this ID");
      }
      
      const now = new Date().toISOString();
      const sequence = await getNextSequence(db, input.accountId);
      
      const fact: JsonFact = {
        type: "POSTING_APPLIED",
        accountId: input.accountId,
        posting: {
          type: "HOLD_RELEASED",
          holdId: input.holdId,
          occurredAt: now,
        },
        sequence,
        occurredAt: now,
      };
      
      await appendFact(db, fact);
      
      return {
        success: true,
        accountId: input.accountId,
        holdId: input.holdId,
        fact,
      };
    }),
  
  // ============================================
  // STATS
  // ============================================
  
  /**
   * Get deposits statistics.
   */
  getStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return {
        totalAccounts: 0,
        openAccounts: 0,
        closedAccounts: 0,
        totalLedgerBalance: "0.00",
        totalHolds: 0,
      };
    }
    
    const accounts = await db.select().from(depositAccounts);
    const openAccounts = accounts.filter((a: any) => a.status === "OPEN").length;
    const closedAccounts = accounts.filter((a: any) => a.status === "CLOSED").length;
    
    // Calculate totals
    let totalLedger = BigInt(0);
    let totalHolds = 0;
    
    for (const account of accounts) {
      const facts = await loadFacts(db, account.accountId);
      const state = rebuildState(facts);
      totalLedger += state.ledgerBalance;
      totalHolds += state.holds.length;
    }
    
    return {
      totalAccounts: accounts.length,
      openAccounts,
      closedAccounts,
      totalLedgerBalance: formatMoney(totalLedger),
      totalHolds,
    };
  }),
});
