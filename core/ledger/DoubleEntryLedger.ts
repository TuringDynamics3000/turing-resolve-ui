/**
 * DoubleEntryLedger.ts - Bank-Grade Double-Entry Accounting
 * 
 * TuringDynamics Core - Production Ledger
 * 
 * Design Principles:
 * - EVERY posting must balance (sum of debits = sum of credits)
 * - No posting commits without balance validation
 * - All entries are immutable facts
 * - Reversals create counter-entries, never delete
 * 
 * This is the foundation for regulatory-grade financial reporting.
 */

import { Money } from "../deposits/ledger/Money";

// ============================================
// ACCOUNT TYPES (Chart of Accounts)
// ============================================

/**
 * Standard accounting equation account types.
 * Assets = Liabilities + Equity + (Revenue - Expenses)
 */
export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

/**
 * Account category for sub-ledger mapping.
 */
export type AccountCategory = 
  | "DEPOSITS"      // Customer deposit accounts
  | "LOANS"         // Loan principal and interest
  | "PAYMENTS"      // Payment clearing accounts
  | "CARDS"         // Card settlement accounts
  | "SUSPENSE"      // Suspense and clearing
  | "REVENUE"       // Interest income, fees
  | "EXPENSE"       // Interest expense, provisions
  | "CAPITAL"       // Equity and reserves
  | "INTERCOMPANY"; // Intercompany accounts

/**
 * GL Account definition.
 */
export interface GLAccount {
  readonly accountCode: string;      // e.g., "1100-001"
  readonly name: string;             // e.g., "Customer Deposits - Savings"
  readonly type: AccountType;
  readonly category: AccountCategory;
  readonly currency: string;
  readonly parentCode?: string;      // For hierarchy
  readonly isControl: boolean;       // Control account (has sub-ledger)
  readonly isActive: boolean;
}

// ============================================
// DOUBLE-ENTRY POSTING TYPES
// ============================================

/**
 * A single leg of a double-entry posting.
 * Each leg debits or credits one account.
 */
export interface PostingLeg {
  readonly accountCode: string;
  readonly direction: "DEBIT" | "CREDIT";
  readonly amount: Money;
  readonly description?: string;
  readonly subLedgerRef?: string;    // Reference to sub-ledger entry (deposit, loan, payment)
}

/**
 * A complete double-entry posting.
 * INVARIANT: Sum of debits MUST equal sum of credits.
 */
export interface DoubleEntryPosting {
  readonly postingId: string;
  readonly legs: readonly PostingLeg[];
  readonly description: string;
  readonly occurredAt: string;       // ISO 8601
  readonly effectiveDate: string;    // Accounting date (may differ from occurred)
  readonly reference?: string;       // External reference
  readonly reversesPostingId?: string; // If this is a reversal
  readonly metadata?: Record<string, unknown>;
}

/**
 * Committed posting with audit trail.
 */
export interface CommittedPosting extends DoubleEntryPosting {
  readonly committedAt: string;
  readonly committedBy: string;
  readonly commitSequence: bigint;
}

/**
 * Reversal posting with reason.
 */
export interface ReversalPosting extends DoubleEntryPosting {
  readonly reversalReason: ReversalReason;
  readonly originalPostingId: string;
  readonly approvedBy?: string;
}

/**
 * Standard reversal reason codes.
 */
export type ReversalReason =
  | "ERROR_CORRECTION"      // Posting was made in error
  | "DUPLICATE_ENTRY"       // Duplicate posting detected
  | "CUSTOMER_DISPUTE"      // Customer disputed transaction
  | "FRAUD_DETECTED"        // Fraud investigation
  | "REGULATORY_REQUIREMENT" // Regulator-mandated reversal
  | "SYSTEM_RECONCILIATION" // Reconciliation break resolution
  | "OTHER";                // Other (requires description)

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate that a posting is balanced.
 * Sum of debits MUST equal sum of credits.
 * 
 * @throws POSTING_NOT_BALANCED if debits != credits
 * @throws CURRENCY_MISMATCH if legs have different currencies
 * @throws EMPTY_POSTING if no legs
 */
export function validatePostingBalance(posting: DoubleEntryPosting): void {
  if (posting.legs.length === 0) {
    throw new Error("EMPTY_POSTING");
  }
  
  // Check all legs have same currency
  const currencies = new Set(posting.legs.map(leg => leg.amount.currency));
  if (currencies.size > 1) {
    throw new Error("CURRENCY_MISMATCH_IN_POSTING");
  }
  
  // Calculate totals
  let totalDebits = BigInt(0);
  let totalCredits = BigInt(0);
  
  for (const leg of posting.legs) {
    if (leg.direction === "DEBIT") {
      totalDebits += leg.amount.amount;
    } else {
      totalCredits += leg.amount.amount;
    }
  }
  
  // Validate balance
  if (totalDebits !== totalCredits) {
    throw new Error(
      `POSTING_NOT_BALANCED: Debits=${totalDebits}, Credits=${totalCredits}, Difference=${totalDebits - totalCredits}`
    );
  }
}

/**
 * Validate posting has required fields.
 */
export function validatePostingStructure(posting: DoubleEntryPosting): string[] {
  const errors: string[] = [];
  
  if (!posting.postingId || posting.postingId.trim() === "") {
    errors.push("postingId is required");
  }
  
  if (!posting.description || posting.description.trim() === "") {
    errors.push("description is required");
  }
  
  if (!posting.occurredAt) {
    errors.push("occurredAt is required");
  }
  
  if (!posting.effectiveDate) {
    errors.push("effectiveDate is required");
  }
  
  if (!posting.legs || posting.legs.length < 2) {
    errors.push("posting must have at least 2 legs");
  }
  
  for (let i = 0; i < posting.legs.length; i++) {
    const leg = posting.legs[i];
    if (!leg.accountCode) {
      errors.push(`leg[${i}]: accountCode is required`);
    }
    if (!leg.direction) {
      errors.push(`leg[${i}]: direction is required`);
    }
    if (!leg.amount) {
      errors.push(`leg[${i}]: amount is required`);
    }
  }
  
  return errors;
}

// ============================================
// POSTING FACTORY FUNCTIONS
// ============================================

/**
 * Create a simple two-leg posting (most common case).
 */
export function createSimplePosting(params: {
  postingId: string;
  debitAccount: string;
  creditAccount: string;
  amount: Money;
  description: string;
  effectiveDate: string;
  reference?: string;
  subLedgerRef?: string;
}): DoubleEntryPosting {
  const posting: DoubleEntryPosting = {
    postingId: params.postingId,
    legs: [
      {
        accountCode: params.debitAccount,
        direction: "DEBIT",
        amount: params.amount,
        subLedgerRef: params.subLedgerRef,
      },
      {
        accountCode: params.creditAccount,
        direction: "CREDIT",
        amount: params.amount,
        subLedgerRef: params.subLedgerRef,
      },
    ],
    description: params.description,
    occurredAt: new Date().toISOString(),
    effectiveDate: params.effectiveDate,
    reference: params.reference,
  };
  
  // Validate before returning
  validatePostingBalance(posting);
  
  return posting;
}

/**
 * Create a multi-leg posting (for complex transactions).
 */
export function createMultiLegPosting(params: {
  postingId: string;
  legs: PostingLeg[];
  description: string;
  effectiveDate: string;
  reference?: string;
}): DoubleEntryPosting {
  const posting: DoubleEntryPosting = {
    postingId: params.postingId,
    legs: Object.freeze([...params.legs]),
    description: params.description,
    occurredAt: new Date().toISOString(),
    effectiveDate: params.effectiveDate,
    reference: params.reference,
  };
  
  // Validate before returning
  validatePostingBalance(posting);
  
  return posting;
}

/**
 * Create a reversal posting for an existing posting.
 * Reversal creates counter-entries (debits become credits, credits become debits).
 */
export function createReversalPosting(
  originalPosting: DoubleEntryPosting,
  params: {
    reversalPostingId: string;
    reason: ReversalReason;
    description: string;
    approvedBy?: string;
  }
): ReversalPosting {
  // Create counter-entries
  const reversedLegs: PostingLeg[] = originalPosting.legs.map(leg => ({
    accountCode: leg.accountCode,
    direction: leg.direction === "DEBIT" ? "CREDIT" : "DEBIT",
    amount: leg.amount,
    description: `Reversal: ${leg.description || ""}`,
    subLedgerRef: leg.subLedgerRef,
  }));
  
  const reversal: ReversalPosting = {
    postingId: params.reversalPostingId,
    legs: Object.freeze(reversedLegs),
    description: params.description,
    occurredAt: new Date().toISOString(),
    effectiveDate: new Date().toISOString().split("T")[0],
    reversesPostingId: originalPosting.postingId,
    reversalReason: params.reason,
    originalPostingId: originalPosting.postingId,
    approvedBy: params.approvedBy,
  };
  
  // Validate (should always pass since we just flipped directions)
  validatePostingBalance(reversal);
  
  return reversal;
}

// ============================================
// TRIAL BALANCE
// ============================================

/**
 * Account balance for trial balance.
 */
export interface AccountBalance {
  readonly accountCode: string;
  readonly accountName: string;
  readonly accountType: AccountType;
  readonly debitBalance: Money;
  readonly creditBalance: Money;
  readonly netBalance: Money;
}

/**
 * Trial balance report.
 */
export interface TrialBalance {
  readonly asOfDate: string;
  readonly generatedAt: string;
  readonly currency: string;
  readonly accounts: readonly AccountBalance[];
  readonly totalDebits: Money;
  readonly totalCredits: Money;
  readonly isBalanced: boolean;
  readonly variance: Money;
}

/**
 * Generate trial balance from committed postings.
 */
export function generateTrialBalance(
  accounts: GLAccount[],
  postings: CommittedPosting[],
  asOfDate: string,
  currency: string
): TrialBalance {
  // Initialize balances for all accounts
  const balances: Map<string, { debits: bigint; credits: bigint }> = new Map();
  
  for (const account of accounts) {
    if (account.currency === currency && account.isActive) {
      balances.set(account.accountCode, { debits: BigInt(0), credits: BigInt(0) });
    }
  }
  
  // Accumulate postings up to asOfDate
  for (const posting of postings) {
    if (posting.effectiveDate <= asOfDate) {
      for (const leg of posting.legs) {
        if (leg.amount.currency === currency) {
          const balance = balances.get(leg.accountCode);
          if (balance) {
            if (leg.direction === "DEBIT") {
              balance.debits += leg.amount.amount;
            } else {
              balance.credits += leg.amount.amount;
            }
          }
        }
      }
    }
  }
  
  // Build account balances
  const accountBalances: AccountBalance[] = [];
  let totalDebits = BigInt(0);
  let totalCredits = BigInt(0);
  
  for (const account of accounts) {
    const balance = balances.get(account.accountCode);
    if (balance && account.currency === currency) {
      const debitMoney = new Money(balance.debits, currency);
      const creditMoney = new Money(balance.credits, currency);
      
      // Calculate net balance based on account type
      // Assets & Expenses: normal debit balance (debits - credits)
      // Liabilities, Equity, Revenue: normal credit balance (credits - debits)
      let netAmount: bigint;
      if (account.type === "ASSET" || account.type === "EXPENSE") {
        netAmount = balance.debits - balance.credits;
      } else {
        netAmount = balance.credits - balance.debits;
      }
      
      // Only include accounts with activity
      if (balance.debits > 0 || balance.credits > 0) {
        accountBalances.push({
          accountCode: account.accountCode,
          accountName: account.name,
          accountType: account.type,
          debitBalance: debitMoney,
          creditBalance: creditMoney,
          netBalance: new Money(netAmount >= 0 ? netAmount : -netAmount, currency),
        });
        
        totalDebits += balance.debits;
        totalCredits += balance.credits;
      }
    }
  }
  
  const variance = totalDebits - totalCredits;
  
  return {
    asOfDate,
    generatedAt: new Date().toISOString(),
    currency,
    accounts: Object.freeze(accountBalances),
    totalDebits: new Money(totalDebits, currency),
    totalCredits: new Money(totalCredits, currency),
    isBalanced: variance === BigInt(0),
    variance: new Money(variance >= 0 ? variance : -variance, currency),
  };
}

// ============================================
// STANDARD CHART OF ACCOUNTS
// ============================================

/**
 * Default chart of accounts for a deposit-taking institution.
 */
export const STANDARD_CHART_OF_ACCOUNTS: GLAccount[] = [
  // ASSETS (1xxx)
  { accountCode: "1000", name: "Cash and Cash Equivalents", type: "ASSET", category: "DEPOSITS", currency: "AUD", isControl: true, isActive: true },
  { accountCode: "1100", name: "Customer Deposits - Control", type: "ASSET", category: "DEPOSITS", currency: "AUD", isControl: true, isActive: true },
  { accountCode: "1100-SAV", name: "Customer Deposits - Savings", type: "ASSET", category: "DEPOSITS", currency: "AUD", parentCode: "1100", isControl: false, isActive: true },
  { accountCode: "1100-TRM", name: "Customer Deposits - Term", type: "ASSET", category: "DEPOSITS", currency: "AUD", parentCode: "1100", isControl: false, isActive: true },
  { accountCode: "1200", name: "Loans Receivable - Control", type: "ASSET", category: "LOANS", currency: "AUD", isControl: true, isActive: true },
  { accountCode: "1200-PER", name: "Loans Receivable - Personal", type: "ASSET", category: "LOANS", currency: "AUD", parentCode: "1200", isControl: false, isActive: true },
  { accountCode: "1200-MTG", name: "Loans Receivable - Mortgage", type: "ASSET", category: "LOANS", currency: "AUD", parentCode: "1200", isControl: false, isActive: true },
  { accountCode: "1300", name: "Payment Clearing - Control", type: "ASSET", category: "PAYMENTS", currency: "AUD", isControl: true, isActive: true },
  { accountCode: "1300-NPP", name: "Payment Clearing - NPP", type: "ASSET", category: "PAYMENTS", currency: "AUD", parentCode: "1300", isControl: false, isActive: true },
  { accountCode: "1300-BECS", name: "Payment Clearing - BECS", type: "ASSET", category: "PAYMENTS", currency: "AUD", parentCode: "1300", isControl: false, isActive: true },
  { accountCode: "1400", name: "Card Settlement - Control", type: "ASSET", category: "CARDS", currency: "AUD", isControl: true, isActive: true },
  { accountCode: "1900", name: "Suspense Account", type: "ASSET", category: "SUSPENSE", currency: "AUD", isControl: false, isActive: true },
  
  // LIABILITIES (2xxx)
  { accountCode: "2000", name: "Customer Deposits Payable - Control", type: "LIABILITY", category: "DEPOSITS", currency: "AUD", isControl: true, isActive: true },
  { accountCode: "2000-SAV", name: "Customer Deposits Payable - Savings", type: "LIABILITY", category: "DEPOSITS", currency: "AUD", parentCode: "2000", isControl: false, isActive: true },
  { accountCode: "2000-TRM", name: "Customer Deposits Payable - Term", type: "LIABILITY", category: "DEPOSITS", currency: "AUD", parentCode: "2000", isControl: false, isActive: true },
  { accountCode: "2100", name: "Interest Payable", type: "LIABILITY", category: "DEPOSITS", currency: "AUD", isControl: false, isActive: true },
  { accountCode: "2200", name: "Fees Payable", type: "LIABILITY", category: "DEPOSITS", currency: "AUD", isControl: false, isActive: true },
  { accountCode: "2900", name: "Provisions - Loan Losses", type: "LIABILITY", category: "LOANS", currency: "AUD", isControl: false, isActive: true },
  
  // EQUITY (3xxx)
  { accountCode: "3000", name: "Share Capital", type: "EQUITY", category: "CAPITAL", currency: "AUD", isControl: false, isActive: true },
  { accountCode: "3100", name: "Retained Earnings", type: "EQUITY", category: "CAPITAL", currency: "AUD", isControl: false, isActive: true },
  { accountCode: "3200", name: "Current Year Profit/Loss", type: "EQUITY", category: "CAPITAL", currency: "AUD", isControl: false, isActive: true },
  
  // REVENUE (4xxx)
  { accountCode: "4000", name: "Interest Income - Loans", type: "REVENUE", category: "REVENUE", currency: "AUD", isControl: false, isActive: true },
  { accountCode: "4100", name: "Fee Income", type: "REVENUE", category: "REVENUE", currency: "AUD", isControl: false, isActive: true },
  { accountCode: "4200", name: "Card Interchange Income", type: "REVENUE", category: "REVENUE", currency: "AUD", isControl: false, isActive: true },
  
  // EXPENSES (5xxx)
  { accountCode: "5000", name: "Interest Expense - Deposits", type: "EXPENSE", category: "EXPENSE", currency: "AUD", isControl: false, isActive: true },
  { accountCode: "5100", name: "Provision Expense - Loan Losses", type: "EXPENSE", category: "EXPENSE", currency: "AUD", isControl: false, isActive: true },
  { accountCode: "5200", name: "Payment Processing Fees", type: "EXPENSE", category: "EXPENSE", currency: "AUD", isControl: false, isActive: true },
];

/**
 * Sub-ledger to GL mapping rules.
 */
export const SUB_LEDGER_GL_MAPPING: Record<string, { debitAccount: string; creditAccount: string }> = {
  // Deposit postings
  "DEPOSIT_CREDIT": { debitAccount: "1000", creditAccount: "2000-SAV" },
  "DEPOSIT_DEBIT": { debitAccount: "2000-SAV", creditAccount: "1000" },
  "DEPOSIT_INTEREST": { debitAccount: "5000", creditAccount: "2100" },
  
  // Loan postings
  "LOAN_DISBURSEMENT": { debitAccount: "1200-PER", creditAccount: "1000" },
  "LOAN_REPAYMENT": { debitAccount: "1000", creditAccount: "1200-PER" },
  "LOAN_INTEREST": { debitAccount: "1200-PER", creditAccount: "4000" },
  
  // Payment postings
  "PAYMENT_OUTBOUND": { debitAccount: "2000-SAV", creditAccount: "1300-NPP" },
  "PAYMENT_INBOUND": { debitAccount: "1300-NPP", creditAccount: "2000-SAV" },
  "PAYMENT_SETTLED": { debitAccount: "1300-NPP", creditAccount: "1000" },
  
  // Fee postings
  "FEE_CHARGED": { debitAccount: "2000-SAV", creditAccount: "4100" },
};

export default {
  validatePostingBalance,
  validatePostingStructure,
  createSimplePosting,
  createMultiLegPosting,
  createReversalPosting,
  generateTrialBalance,
  STANDARD_CHART_OF_ACCOUNTS,
  SUB_LEDGER_GL_MAPPING,
};
