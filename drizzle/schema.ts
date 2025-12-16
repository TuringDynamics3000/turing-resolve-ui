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


// ============================================
// PAYMENTS CORE v1 TABLES (Event Sourcing)
// ============================================

/**
 * Payment Facts - Immutable event log for Payments Core v1.
 * 
 * CRITICAL: This is append-only. No UPDATE, no DELETE.
 * Payment state is rebuilt by replaying facts.
 */
export const paymentFacts = mysqlTable("payment_facts", {
  id: int("id").autoincrement().primaryKey(),
  
  // Payment identity
  paymentId: varchar("paymentId", { length: 64 }).notNull(),
  sequence: int("sequence").notNull(), // Monotonic within payment
  
  // Fact type and data
  factType: mysqlEnum("factType", [
    "PAYMENT_INITIATED",
    "PAYMENT_HOLD_PLACED",
    "PAYMENT_AUTHORISED",
    "PAYMENT_SENT",
    "PAYMENT_SETTLED",
    "PAYMENT_FAILED",
    "PAYMENT_REVERSED"
  ]).notNull(),
  factData: json("factData").notNull(), // The full fact object
  
  // Deposits Core integration - links to deposit facts
  depositFactId: int("depositFactId"), // FK to deposit_facts when posting applied
  depositPostingType: varchar("depositPostingType", { length: 32 }), // HOLD_PLACED, DEBIT, CREDIT, etc.
  
  // Governance links
  decisionId: varchar("decisionId", { length: 64 }),
  
  // Audit
  occurredAt: timestamp("occurredAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PaymentFact = typeof paymentFacts.$inferSelect;
export type InsertPaymentFact = typeof paymentFacts.$inferInsert;

// ============================================
// LENDING CORE v1 TABLES (Event Sourcing)
// ============================================

/**
 * Loan Facts - Immutable event log for Lending Core v1.
 * 
 * CRITICAL: This is append-only. No UPDATE, no DELETE.
 * Loan state is rebuilt by replaying facts.
 */
export const loanFacts = mysqlTable("loan_facts", {
  id: int("id").autoincrement().primaryKey(),
  
  // Loan identity
  loanId: varchar("loanId", { length: 64 }).notNull(),
  sequence: int("sequence").notNull(), // Monotonic within loan
  
  // Fact type and data
  factType: mysqlEnum("factType", [
    "LOAN_OFFERED",
    "LOAN_ACCEPTED",
    "LOAN_ACTIVATED",
    "LOAN_PAYMENT_APPLIED",
    "INTEREST_ACCRUED",
    "FEE_APPLIED",
    "LOAN_IN_ARREARS",
    "HARDSHIP_ENTERED",
    "HARDSHIP_EXITED",
    "LOAN_RESTRUCTURED",
    "LOAN_DEFAULTED",
    "LOAN_CLOSED",
    "LOAN_WRITTEN_OFF"
  ]).notNull(),
  factData: json("factData").notNull(), // The full fact object
  
  // Deposits Core integration - links to deposit facts for disbursement/repayment
  depositFactId: int("depositFactId"), // FK to deposit_facts when posting applied
  depositPostingType: varchar("depositPostingType", { length: 32 }), // CREDIT (disbursement), DEBIT (repayment)
  
  // Governance links
  decisionId: varchar("decisionId", { length: 64 }),
  
  // Audit
  occurredAt: timestamp("occurredAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LoanFact = typeof loanFacts.$inferSelect;
export type InsertLoanFact = typeof loanFacts.$inferInsert;

/**
 * Loans - Derived state for efficient querying.
 * 
 * CRITICAL: This is a projection, NOT the source of truth.
 * Source of truth is loan_facts.
 */
export const loans = mysqlTable("loans", {
  id: int("id").autoincrement().primaryKey(),
  loanId: varchar("loanId", { length: 64 }).notNull().unique(),
  
  // Loan details
  borrowerAccountId: varchar("borrowerAccountId", { length: 64 }).notNull(),
  principal: decimal("principal", { precision: 18, scale: 2 }).notNull(),
  interestRate: decimal("interestRate", { precision: 5, scale: 4 }).notNull(), // e.g., 0.0500 for 5%
  termMonths: int("termMonths").notNull(),
  
  // Current state (derived from facts)
  state: mysqlEnum("state", [
    "OFFERED",
    "ACTIVE",
    "IN_ARREARS",
    "HARDSHIP",
    "DEFAULT",
    "CLOSED",
    "WRITTEN_OFF"
  ]).notNull(),
  
  // Disbursement info
  disbursementAccountId: varchar("disbursementAccountId", { length: 64 }),
  activatedAt: timestamp("activatedAt"),
  
  // Derived balances (computed from facts)
  totalPaid: decimal("totalPaid", { precision: 18, scale: 2 }).default("0.00").notNull(),
  principalPaid: decimal("principalPaid", { precision: 18, scale: 2 }).default("0.00").notNull(),
  interestPaid: decimal("interestPaid", { precision: 18, scale: 2 }).default("0.00").notNull(),
  feesPaid: decimal("feesPaid", { precision: 18, scale: 2 }).default("0.00").notNull(),
  
  // Arrears tracking
  daysPastDue: int("daysPastDue").default(0),
  amountOverdue: decimal("amountOverdue", { precision: 18, scale: 2 }).default("0.00"),
  
  // Governance links
  decisionId: varchar("decisionId", { length: 64 }),
  
  // Audit
  offeredAt: timestamp("offeredAt").notNull(),
  closedAt: timestamp("closedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Loan = typeof loans.$inferSelect;
export type InsertLoan = typeof loans.$inferInsert;

/**
 * Payments - Derived state for efficient querying.
 * 
 * CRITICAL: This is a projection, NOT the source of truth.
 * Source of truth is payment_facts.
 */
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  paymentId: varchar("paymentId", { length: 64 }).notNull().unique(),
  
  // Payment details
  fromAccount: varchar("fromAccount", { length: 64 }).notNull(),
  toAccount: varchar("toAccount", { length: 64 }),
  toExternal: json("toExternal"), // External party details
  
  // Amount
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("AUD").notNull(),
  
  // State (derived from facts)
  state: mysqlEnum("state", [
    "INITIATED",
    "HELD",
    "AUTHORISED",
    "SENT",
    "SETTLED",
    "FAILED",
    "REVERSED"
  ]).default("INITIATED").notNull(),
  
  // References
  reference: varchar("reference", { length: 255 }),
  description: text("description"),
  
  // Hold tracking
  activeHoldId: varchar("activeHoldId", { length: 64 }),
  
  // Failure/reversal info
  failureReason: text("failureReason"),
  reversalReason: text("reversalReason"),
  
  // Timestamps
  initiatedAt: timestamp("initiatedAt").notNull(),
  settledAt: timestamp("settledAt"),
  failedAt: timestamp("failedAt"),
  reversedAt: timestamp("reversedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;


// ============================================
// ADVISORY FACTS (Human Advisory Override - Non-Executing)
// ============================================

/**
 * Advisory Facts - Human advisory notes that do NOT execute or override system decisions.
 * 
 * CRITICAL: Advisory facts:
 * - Do NOT affect replay
 * - Do NOT change state
 * - Do NOT emit postings
 * - Are visible, auditable, and permanent
 */
export const advisoryFacts = mysqlTable("advisory_facts", {
  id: int("id").autoincrement().primaryKey(),
  factId: varchar("factId", { length: 64 }).notNull().unique(),
  
  // Entity reference
  entityType: mysqlEnum("entityType", ["PAYMENT", "ACCOUNT"]).notNull(),
  entityId: varchar("entityId", { length: 64 }).notNull(),
  
  // Advisory type
  advisoryType: mysqlEnum("advisoryType", [
    "RECOMMEND_RETRY",
    "RECOMMEND_REVERSAL",
    "HOLD_FOR_REVIEW",
    "NO_ACTION"
  ]).notNull(),
  
  // Content
  note: text("note").notNull(),
  
  // Actor (who added this advisory)
  actor: varchar("actor", { length: 128 }).notNull(),
  
  // Audit
  occurredAt: timestamp("occurredAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdvisoryFact = typeof advisoryFacts.$inferSelect;
export type InsertAdvisoryFact = typeof advisoryFacts.$inferInsert;


// ============================================
// AUDIT FACTS (Operator Accountability)
// ============================================

/**
 * Audit Facts - Immutable record of every human-initiated action.
 * 
 * CRITICAL: Audit facts:
 * - Are append-only (never updated or deleted)
 * - Survive replay
 * - Are exportable for regulator reports
 * - Cover ALL operator actions (kill-switch, retry, reverse, advisory)
 */
export const auditFacts = mysqlTable("audit_facts", {
  id: int("id").autoincrement().primaryKey(),
  factId: varchar("factId", { length: 64 }).notNull().unique(),
  
  // Actor information
  actor: varchar("actor", { length: 128 }).notNull(), // Operator ID
  actorRole: varchar("actorRole", { length: 64 }).notNull(), // Role at time of action
  
  // Action details
  actionType: mysqlEnum("actionType", [
    "KILL_SWITCH_ENABLE",
    "KILL_SWITCH_DISABLE",
    "PAYMENT_RETRY",
    "PAYMENT_REVERSE",
    "ADVISORY_NOTE_ADDED",
    "INCIDENT_ANNOTATION"
  ]).notNull(),
  
  // Target entity
  targetType: mysqlEnum("targetType", ["PAYMENT", "ACCOUNT", "ADAPTER", "SYSTEM"]).notNull(),
  targetId: varchar("targetId", { length: 64 }).notNull(),
  
  // Action context
  reason: text("reason"), // Required for some actions
  metadata: json("metadata"), // Additional context
  
  // Result
  result: mysqlEnum("result", ["ACCEPTED", "REJECTED"]).notNull(),
  resultReason: text("resultReason"), // Why rejected, if applicable
  
  // Audit
  occurredAt: timestamp("occurredAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditFact = typeof auditFacts.$inferSelect;
export type InsertAuditFact = typeof auditFacts.$inferInsert;


// ============================================
// SHADOW AI ADVISORY FACTS (AI Recommendations - Non-Executing)
// ============================================

/**
 * Shadow AI Advisory Facts - AI domain recommendations that do NOT execute.
 * 
 * CRITICAL BOUNDARIES:
 * - Shadow mode only (no execution)
 * - Advisory facts are logged for audit
 * - Resolve can see them but does NOT act on them
 * - Used for board packs and regulator reports
 */
export const shadowAIAdvisoryFacts = mysqlTable("shadow_ai_advisory_facts", {
  id: int("id").autoincrement().primaryKey(),
  advisoryId: varchar("advisoryId", { length: 64 }).notNull().unique(),
  
  // Shadow AI domain
  domain: mysqlEnum("domain", ["PAYMENTS_RL", "FRAUD", "AML", "TREASURY"]).notNull(),
  
  // Entity being advised on
  entityType: mysqlEnum("entityType", ["PAYMENT", "DEPOSIT", "LOAN", "EXPOSURE"]).notNull(),
  entityId: varchar("entityId", { length: 64 }).notNull(),
  
  // Recommendation
  recommendation: mysqlEnum("recommendation", [
    "APPROVE",
    "REVIEW",
    "DECLINE",
    "HOLD",
    "ESCALATE",
    "NO_ACTION"
  ]).notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull(), // 0.0000 to 1.0000
  reasoning: text("reasoning").notNull(), // Explainable AI output
  
  // Model metadata
  modelVersion: varchar("modelVersion", { length: 64 }).notNull(),
  modelType: varchar("modelType", { length: 64 }), // "RL", "RULE_BASED", "ENSEMBLE"
  metadata: json("metadata"), // Additional model outputs
  
  // Audit
  occurredAt: timestamp("occurredAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShadowAIAdvisoryFact = typeof shadowAIAdvisoryFacts.$inferSelect;
export type InsertShadowAIAdvisoryFact = typeof shadowAIAdvisoryFacts.$inferInsert;
