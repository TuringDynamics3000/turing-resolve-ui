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
});

export type LedgerPosting = typeof ledgerPostings.$inferSelect;
export type InsertLedgerPosting = typeof ledgerPostings.$inferInsert;