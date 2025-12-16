import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, decimal, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================
// LEDGER TABLES (Double-Entry Accounting)
// ============================================

/**
 * Ledger Accounts - The "buckets" that hold value.
 * Examples: Customer Wallet, Loan Principal, Revenue
 */
export const ledgerAccounts = mysqlTable("ledger_accounts", {
  id: int("id").autoincrement().primaryKey(),
  accountId: varchar("accountId", { length: 64 }).notNull().unique(),
  accountType: mysqlEnum("accountType", ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("AUD").notNull(),
  balance: decimal("balance", { precision: 18, scale: 2 }).default("0.00").notNull(),
  frozen: mysqlEnum("frozen", ["true", "false"]).default("false").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LedgerAccount = typeof ledgerAccounts.$inferSelect;
export type InsertLedgerAccount = typeof ledgerAccounts.$inferInsert;

/**
 * Ledger Entries - Immutable record of every balance change.
 * Each entry is part of a "posting" (a balanced set of debits and credits).
 */
export const ledgerEntries = mysqlTable("ledger_entries", {
  id: int("id").autoincrement().primaryKey(),
  entryId: varchar("entryId", { length: 64 }).notNull().unique(),
  postingId: varchar("postingId", { length: 64 }).notNull(),
  accountId: varchar("accountId", { length: 64 }).notNull(),
  direction: mysqlEnum("direction", ["DEBIT", "CREDIT"]).notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("AUD").notNull(),
  description: text("description"),
  
  // Governance Links
  decisionId: varchar("decisionId", { length: 64 }),
  loanId: varchar("loanId", { length: 64 }),
  
  // Audit Trail
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).unique(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type InsertLedgerEntry = typeof ledgerEntries.$inferInsert;

/**
 * Ledger Postings - A balanced transaction (sum of debits = sum of credits).
 */
export const ledgerPostings = mysqlTable("ledger_postings", {
  id: int("id").autoincrement().primaryKey(),
  postingId: varchar("postingId", { length: 64 }).notNull().unique(),
  status: mysqlEnum("status", ["PENDING", "COMMITTED", "REVERSED"]).default("PENDING").notNull(),
  description: text("description"),
  
  // Governance Links
  decisionId: varchar("decisionId", { length: 64 }),
  loanId: varchar("loanId", { length: 64 }),
  
  // Audit Trail
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).unique(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  committedAt: timestamp("committedAt"),
  
  // Reversal Tracking
  reversesPostingId: varchar("reversesPostingId", { length: 64 }), // If this posting reverses another
  reversedBy: varchar("reversedBy", { length: 64 }), // The posting that reversed this one
  reversedAt: timestamp("reversedAt"),
});

export type LedgerPosting = typeof ledgerPostings.$inferSelect;
export type InsertLedgerPosting = typeof ledgerPostings.$inferInsert;

// ============================================
// DEPOSITS CORE v1 TABLES (Event Sourcing)
// ============================================

/**
 * Deposit Accounts - Metadata for deposit accounts.
 * State is derived from facts, this is for indexing/querying.
 */
export const depositAccounts = mysqlTable("deposit_accounts", {
  id: int("id").autoincrement().primaryKey(),
  accountId: varchar("accountId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  productType: varchar("productType", { length: 32 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("AUD").notNull(),
  status: mysqlEnum("status", ["OPEN", "CLOSED"]).default("OPEN").notNull(),
  customerSegment: varchar("customerSegment", { length: 32 }),
  
  // Cached balances (derived from facts, updated on each posting)
  ledgerBalance: decimal("ledgerBalance", { precision: 18, scale: 2 }).default("0.00").notNull(),
  availableBalance: decimal("availableBalance", { precision: 18, scale: 2 }).default("0.00").notNull(),
  holdCount: int("holdCount").default(0).notNull(),
  
  // Audit
  openedAt: timestamp("openedAt").defaultNow().notNull(),
  closedAt: timestamp("closedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DepositAccount = typeof depositAccounts.$inferSelect;
export type InsertDepositAccount = typeof depositAccounts.$inferInsert;

/**
 * Deposit Facts - Event sourcing facts for deposit accounts.
 * This is the source of truth. All state is derived from facts.
 * 
 * IMMUTABLE: Facts are never updated or deleted.
 */
export const depositFacts = mysqlTable("deposit_facts", {
  id: int("id").autoincrement().primaryKey(),
  factId: varchar("factId", { length: 64 }).notNull().unique(),
  accountId: varchar("accountId", { length: 64 }).notNull(),
  sequence: int("sequence").notNull(),
  
  // Fact type and data
  factType: mysqlEnum("factType", ["ACCOUNT_OPENED", "POSTING_APPLIED", "ACCOUNT_CLOSED"]).notNull(),
  factData: json("factData").notNull(), // The full fact object (Posting, etc.)
  
  // Governance links
  decisionId: varchar("decisionId", { length: 64 }),
  commandId: varchar("commandId", { length: 64 }),
  
  // Audit
  occurredAt: timestamp("occurredAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DepositFact = typeof depositFacts.$inferSelect;
export type InsertDepositFact = typeof depositFacts.$inferInsert;

/**
 * Deposit Holds - Active holds on deposit accounts.
 * Derived from facts, but stored for efficient querying.
 */
export const depositHolds = mysqlTable("deposit_holds", {
  id: int("id").autoincrement().primaryKey(),
  holdId: varchar("holdId", { length: 64 }).notNull().unique(),
  accountId: varchar("accountId", { length: 64 }).notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("AUD").notNull(),
  holdType: varchar("holdType", { length: 32 }).notNull(),
  reason: text("reason"),
  
  // Status
  status: mysqlEnum("status", ["ACTIVE", "RELEASED", "EXPIRED"]).default("ACTIVE").notNull(),
  
  // Audit
  placedAt: timestamp("placedAt").notNull(),
  releasedAt: timestamp("releasedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DepositHold = typeof depositHolds.$inferSelect;
export type InsertDepositHold = typeof depositHolds.$inferInsert;
