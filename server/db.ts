import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users,
  InsertLedgerAccount, ledgerAccounts, LedgerAccount,
  InsertLedgerEntry, ledgerEntries, LedgerEntry,
  InsertLedgerPosting, ledgerPostings, LedgerPosting,
} from "../drizzle/schema";
import { nanoid } from "nanoid";
import { sql } from "drizzle-orm";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============================================
// LEDGER OPERATIONS
// ============================================

/**
 * Create a new ledger account.
 */
export async function createLedgerAccount(input: {
  accountType: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  name: string;
  currency?: string;
  metadata?: Record<string, unknown>;
}): Promise<LedgerAccount | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Ledger] Cannot create account: database not available");
    return null;
  }

  const accountId = `ACC-${nanoid(12)}`;
  const values: InsertLedgerAccount = {
    accountId,
    accountType: input.accountType,
    name: input.name,
    currency: input.currency || "AUD",
    metadata: input.metadata || null,
  };

  await db.insert(ledgerAccounts).values(values);
  const result = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.accountId, accountId)).limit(1);
  return result[0] || null;
}

/**
 * Get a ledger account by ID.
 */
export async function getLedgerAccount(accountId: string): Promise<LedgerAccount | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.accountId, accountId)).limit(1);
  return result[0] || null;
}

/**
 * List all ledger accounts.
 */
export async function listLedgerAccounts(): Promise<LedgerAccount[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(ledgerAccounts);
}

/**
 * Create a balanced posting (double-entry transaction).
 * Returns the posting ID if successful, null if validation fails.
 */
export async function createPosting(input: {
  entries: Array<{
    accountId: string;
    direction: "DEBIT" | "CREDIT";
    amount: string; // Decimal as string
    description?: string;
  }>;
  description?: string;
  decisionId?: string;
  loanId?: string;
  idempotencyKey?: string;
}): Promise<{ postingId: string; entries: LedgerEntry[] } | { error: string }> {
  const db = await getDb();
  if (!db) {
    return { error: "Database not available" };
  }

  // Validate: sum of debits must equal sum of credits
  let totalDebits = 0;
  let totalCredits = 0;
  for (const entry of input.entries) {
    const amount = parseFloat(entry.amount);
    if (entry.direction === "DEBIT") {
      totalDebits += amount;
    } else {
      totalCredits += amount;
    }
  }

  if (Math.abs(totalDebits - totalCredits) > 0.001) {
    return { error: `Posting is not balanced: Debits=${totalDebits}, Credits=${totalCredits}` };
  }

  // Check idempotency
  if (input.idempotencyKey) {
    const existing = await db.select().from(ledgerPostings)
      .where(eq(ledgerPostings.idempotencyKey, input.idempotencyKey)).limit(1);
    if (existing.length > 0) {
      // Return existing posting
      const existingEntries = await db.select().from(ledgerEntries)
        .where(eq(ledgerEntries.postingId, existing[0].postingId));
      return { postingId: existing[0].postingId, entries: existingEntries };
    }
  }

  const postingId = `POST-${nanoid(12)}`;

  // Create posting record
  await db.insert(ledgerPostings).values({
    postingId,
    status: "PENDING",
    description: input.description || null,
    decisionId: input.decisionId || null,
    loanId: input.loanId || null,
    idempotencyKey: input.idempotencyKey || null,
  });

  // Create entry records
  const createdEntries: LedgerEntry[] = [];
  for (const entry of input.entries) {
    const entryId = `ENT-${nanoid(12)}`;
    await db.insert(ledgerEntries).values({
      entryId,
      postingId,
      accountId: entry.accountId,
      direction: entry.direction,
      amount: entry.amount,
      description: entry.description || null,
      decisionId: input.decisionId || null,
      loanId: input.loanId || null,
    });
    const created = await db.select().from(ledgerEntries).where(eq(ledgerEntries.entryId, entryId)).limit(1);
    if (created[0]) createdEntries.push(created[0]);
  }

  return { postingId, entries: createdEntries };
}

/**
 * Commit a posting (apply balance changes to accounts).
 * This is the "point of no return" for money movement.
 */
export async function commitPosting(postingId: string): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  // Get posting
  const postingResult = await db.select().from(ledgerPostings).where(eq(ledgerPostings.postingId, postingId)).limit(1);
  if (postingResult.length === 0) {
    return { success: false, error: "Posting not found" };
  }
  const posting = postingResult[0];

  if (posting.status === "COMMITTED") {
    return { success: true }; // Already committed (idempotent)
  }

  if (posting.status === "REVERSED") {
    return { success: false, error: "Cannot commit a reversed posting" };
  }

  // Get entries
  const entries = await db.select().from(ledgerEntries).where(eq(ledgerEntries.postingId, postingId));

  // Apply balance changes
  for (const entry of entries) {
    const amount = parseFloat(entry.amount);
    // DEBIT increases ASSET/EXPENSE, decreases LIABILITY/EQUITY/REVENUE
    // CREDIT decreases ASSET/EXPENSE, increases LIABILITY/EQUITY/REVENUE
    // For simplicity, we use: DEBIT = +, CREDIT = - (standard accounting)
    const delta = entry.direction === "DEBIT" ? amount : -amount;

    await db.update(ledgerAccounts)
      .set({ balance: sql`balance + ${delta}` })
      .where(eq(ledgerAccounts.accountId, entry.accountId));
  }

  // Mark posting as committed
  await db.update(ledgerPostings)
    .set({ status: "COMMITTED", committedAt: new Date() })
    .where(eq(ledgerPostings.postingId, postingId));

  return { success: true };
}

/**
 * Get posting by ID with its entries.
 */
export async function getPosting(postingId: string): Promise<{ posting: LedgerPosting; entries: LedgerEntry[] } | null> {
  const db = await getDb();
  if (!db) return null;

  const postingResult = await db.select().from(ledgerPostings).where(eq(ledgerPostings.postingId, postingId)).limit(1);
  if (postingResult.length === 0) return null;

  const entries = await db.select().from(ledgerEntries).where(eq(ledgerEntries.postingId, postingId));

  return { posting: postingResult[0], entries };
}

/**
 * Reverse a committed posting (create a counter-posting).
 * This is the proper way to handle corrections and refunds.
 * 
 * The original posting is marked as REVERSED and a new posting is created
 * with the opposite direction entries, maintaining a complete audit trail.
 */
export async function reversePosting(input: {
  postingId: string;
  reason: string;
  reversedBy?: string;
}): Promise<{ success: boolean; reversalPostingId?: string; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  // Get original posting
  const postingResult = await db.select().from(ledgerPostings).where(eq(ledgerPostings.postingId, input.postingId)).limit(1);
  if (postingResult.length === 0) {
    return { success: false, error: "Posting not found" };
  }
  const originalPosting = postingResult[0];

  // Can only reverse COMMITTED postings
  if (originalPosting.status !== "COMMITTED") {
    return { success: false, error: `Cannot reverse posting with status: ${originalPosting.status}. Only COMMITTED postings can be reversed.` };
  }

  // Check if already reversed
  if (originalPosting.reversedBy) {
    return { success: false, error: `Posting already reversed by: ${originalPosting.reversedBy}` };
  }

  // Get original entries
  const originalEntries = await db.select().from(ledgerEntries).where(eq(ledgerEntries.postingId, input.postingId));
  if (originalEntries.length === 0) {
    return { success: false, error: "No entries found for posting" };
  }

  // Create reversal posting ID
  const reversalPostingId = `POST-REV-${nanoid(12)}`;

  // Create reversal posting record
  await db.insert(ledgerPostings).values({
    postingId: reversalPostingId,
    status: "PENDING",
    description: `REVERSAL: ${input.reason} (Original: ${input.postingId})`,
    decisionId: originalPosting.decisionId,
    loanId: originalPosting.loanId,
    idempotencyKey: `REV-${input.postingId}`, // Prevent double-reversal
    reversesPostingId: input.postingId,
  });

  // Create reversed entries (opposite direction)
  for (const entry of originalEntries) {
    const entryId = `ENT-REV-${nanoid(12)}`;
    const reversedDirection = entry.direction === "DEBIT" ? "CREDIT" : "DEBIT";
    
    await db.insert(ledgerEntries).values({
      entryId,
      postingId: reversalPostingId,
      accountId: entry.accountId,
      direction: reversedDirection,
      amount: entry.amount,
      description: `REVERSAL: ${entry.description || 'Original entry'}`,
      decisionId: entry.decisionId,
      loanId: entry.loanId,
    });
  }

  // Commit the reversal posting (apply balance changes)
  const commitResult = await commitPosting(reversalPostingId);
  if (!commitResult.success) {
    return { success: false, error: `Failed to commit reversal: ${commitResult.error}` };
  }

  // Mark original posting as reversed
  await db.update(ledgerPostings)
    .set({ 
      status: "REVERSED",
      reversedBy: reversalPostingId,
      reversedAt: new Date(),
    })
    .where(eq(ledgerPostings.postingId, input.postingId));

  return { success: true, reversalPostingId };
}

/**
 * List all postings (for audit/debugging).
 */
export async function listPostings(limit = 100): Promise<LedgerPosting[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(ledgerPostings).limit(limit);
}
