/**
 * Interest Posting Scheduler
 * 
 * TuringDynamics Core - Bank-Grade Interest Automation
 * 
 * Implements:
 * - Daily interest accrual automation
 * - EOD reconciliation and posting
 * - Interest capitalization processing
 * - Batch processing with audit trail
 */

import { Money } from "../../../core/deposits/ledger/Money";

// ============================================
// SCHEDULER TYPES
// ============================================

export type SchedulerStatus = "IDLE" | "RUNNING" | "COMPLETED" | "FAILED";
export type PostingType = "ACCRUAL" | "CAPITALIZATION" | "PAYMENT";

export interface InterestAccount {
  readonly accountId: string;
  readonly accountType: "DEPOSIT" | "LOAN" | "CREDIT_CARD" | "OVERDRAFT";
  readonly customerId: string;
  readonly customerName: string;
  readonly productCode: string;
  readonly balanceCents: bigint;
  readonly rateId: string;
  readonly annualRate: number;
  readonly accruedInterestCents: bigint;
  readonly lastAccrualDate: string;
  readonly capitalizationDay: number; // Day of month (1-31)
  readonly isActive: boolean;
}

export interface AccrualResult {
  readonly accountId: string;
  readonly accrualDate: string;
  readonly openingBalanceCents: bigint;
  readonly dailyInterestCents: bigint;
  readonly closingAccruedCents: bigint;
  readonly annualRate: number;
  readonly dayCountConvention: string;
}

export interface SchedulerRun {
  readonly runId: string;
  readonly runType: "DAILY_ACCRUAL" | "CAPITALIZATION" | "EOD_RECONCILIATION";
  readonly runDate: string;
  readonly status: SchedulerStatus;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly accountsProcessed: number;
  readonly totalInterestCents: bigint;
  readonly results: AccrualResult[];
  readonly glPostings: InterestGLPosting[];
  readonly errors: SchedulerError[];
}

export interface InterestGLPosting {
  readonly postingId: string;
  readonly accountId: string;
  readonly postingType: PostingType;
  readonly debitAccount: string;
  readonly creditAccount: string;
  readonly amountCents: bigint;
  readonly description: string;
  readonly effectiveDate: string;
}

export interface SchedulerError {
  readonly accountId: string;
  readonly errorCode: string;
  readonly message: string;
}

export interface EODReconciliation {
  readonly reconciliationId: string;
  readonly reconciliationDate: string;
  readonly status: "BALANCED" | "VARIANCE" | "PENDING";
  readonly totalAccruedCents: bigint;
  readonly totalPostedCents: bigint;
  readonly varianceCents: bigint;
  readonly accountCount: number;
  readonly completedAt: string;
}

// GL Accounts
const INTEREST_GL_ACCOUNTS = {
  // Deposit interest (bank pays customer)
  DEPOSIT_INTEREST_EXPENSE: "5000",
  DEPOSIT_INTEREST_PAYABLE: "2300",
  DEPOSIT_CONTROL: "2000",
  
  // Loan interest (customer pays bank)
  LOAN_INTEREST_INCOME: "4000",
  LOAN_INTEREST_RECEIVABLE: "1250",
  LOAN_CONTROL: "1200",
};

// ============================================
// INTEREST POSTING SCHEDULER
// ============================================

export class InterestPostingScheduler {
  private accounts: Map<string, InterestAccount> = new Map();
  private runs: Map<string, SchedulerRun> = new Map();
  private reconciliations: Map<string, EODReconciliation> = new Map();
  
  /**
   * Register an interest-bearing account.
   */
  registerAccount(account: InterestAccount): void {
    this.accounts.set(account.accountId, account);
  }
  
  /**
   * Get all registered accounts.
   */
  getAccounts(): InterestAccount[] {
    return Array.from(this.accounts.values());
  }
  
  /**
   * Calculate daily interest for an account.
   */
  calculateDailyInterest(account: InterestAccount, accrualDate: string): AccrualResult {
    // ACT/365 day count
    const dailyRate = account.annualRate / 365;
    const dailyInterest = Math.round(Number(account.balanceCents) * dailyRate);
    const dailyInterestCents = BigInt(dailyInterest);
    const closingAccruedCents = account.accruedInterestCents + dailyInterestCents;
    
    return {
      accountId: account.accountId,
      accrualDate,
      openingBalanceCents: account.balanceCents,
      dailyInterestCents,
      closingAccruedCents,
      annualRate: account.annualRate,
      dayCountConvention: "ACT_365",
    };
  }
  
  /**
   * Generate GL posting for interest accrual.
   */
  generateAccrualPosting(account: InterestAccount, result: AccrualResult): InterestGLPosting {
    const isDeposit = account.accountType === "DEPOSIT";
    
    return {
      postingId: `INT-ACCR-${account.accountId}-${result.accrualDate}`,
      accountId: account.accountId,
      postingType: "ACCRUAL",
      debitAccount: isDeposit ? INTEREST_GL_ACCOUNTS.DEPOSIT_INTEREST_EXPENSE : INTEREST_GL_ACCOUNTS.LOAN_INTEREST_RECEIVABLE,
      creditAccount: isDeposit ? INTEREST_GL_ACCOUNTS.DEPOSIT_INTEREST_PAYABLE : INTEREST_GL_ACCOUNTS.LOAN_INTEREST_INCOME,
      amountCents: result.dailyInterestCents,
      description: `Daily interest accrual - ${account.accountType} ${account.accountId}`,
      effectiveDate: result.accrualDate,
    };
  }
  
  /**
   * Generate GL posting for interest capitalization.
   */
  generateCapitalizationPosting(account: InterestAccount, capitalizationDate: string): InterestGLPosting | null {
    if (account.accruedInterestCents === BigInt(0)) return null;
    
    const isDeposit = account.accountType === "DEPOSIT";
    
    return {
      postingId: `INT-CAP-${account.accountId}-${capitalizationDate}`,
      accountId: account.accountId,
      postingType: "CAPITALIZATION",
      debitAccount: isDeposit ? INTEREST_GL_ACCOUNTS.DEPOSIT_INTEREST_PAYABLE : INTEREST_GL_ACCOUNTS.LOAN_CONTROL,
      creditAccount: isDeposit ? INTEREST_GL_ACCOUNTS.DEPOSIT_CONTROL : INTEREST_GL_ACCOUNTS.LOAN_INTEREST_RECEIVABLE,
      amountCents: account.accruedInterestCents,
      description: `Interest capitalization - ${account.accountType} ${account.accountId}`,
      effectiveDate: capitalizationDate,
    };
  }
  
  /**
   * Run daily accrual for all accounts.
   */
  runDailyAccrual(accrualDate: string): SchedulerRun {
    const runId = `ACCR-${accrualDate}-${Date.now()}`;
    const results: AccrualResult[] = [];
    const glPostings: InterestGLPosting[] = [];
    const errors: SchedulerError[] = [];
    let totalInterest = BigInt(0);
    
    for (const account of this.accounts.values()) {
      if (!account.isActive) continue;
      
      try {
        const result = this.calculateDailyInterest(account, accrualDate);
        results.push(result);
        totalInterest += result.dailyInterestCents;
        
        const posting = this.generateAccrualPosting(account, result);
        if (posting.amountCents > BigInt(0)) {
          glPostings.push(posting);
        }
        
        // Update account accrued interest
        this.accounts.set(account.accountId, {
          ...account,
          accruedInterestCents: result.closingAccruedCents,
          lastAccrualDate: accrualDate,
        });
        
      } catch (error) {
        errors.push({
          accountId: account.accountId,
          errorCode: "ACCRUAL_FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    
    const run: SchedulerRun = {
      runId,
      runType: "DAILY_ACCRUAL",
      runDate: accrualDate,
      status: errors.length > 0 ? "COMPLETED" : "COMPLETED",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      accountsProcessed: results.length,
      totalInterestCents: totalInterest,
      results,
      glPostings,
      errors,
    };
    
    this.runs.set(runId, run);
    return run;
  }
  
  /**
   * Run capitalization for accounts due on given day.
   */
  runCapitalization(capitalizationDate: string): SchedulerRun {
    const runId = `CAP-${capitalizationDate}-${Date.now()}`;
    const dayOfMonth = new Date(capitalizationDate).getDate();
    const glPostings: InterestGLPosting[] = [];
    const errors: SchedulerError[] = [];
    let totalCapitalized = BigInt(0);
    let accountsProcessed = 0;
    
    for (const account of this.accounts.values()) {
      if (!account.isActive) continue;
      if (account.capitalizationDay !== dayOfMonth) continue;
      
      try {
        const posting = this.generateCapitalizationPosting(account, capitalizationDate);
        if (posting) {
          glPostings.push(posting);
          totalCapitalized += posting.amountCents;
          accountsProcessed++;
          
          // Update account - add interest to balance, reset accrued
          this.accounts.set(account.accountId, {
            ...account,
            balanceCents: account.balanceCents + account.accruedInterestCents,
            accruedInterestCents: BigInt(0),
          });
        }
      } catch (error) {
        errors.push({
          accountId: account.accountId,
          errorCode: "CAPITALIZATION_FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    
    const run: SchedulerRun = {
      runId,
      runType: "CAPITALIZATION",
      runDate: capitalizationDate,
      status: "COMPLETED",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      accountsProcessed,
      totalInterestCents: totalCapitalized,
      results: [],
      glPostings,
      errors,
    };
    
    this.runs.set(runId, run);
    return run;
  }
  
  /**
   * Run EOD reconciliation.
   */
  runEODReconciliation(reconciliationDate: string): EODReconciliation {
    const reconciliationId = `RECON-${reconciliationDate}-${Date.now()}`;
    
    // Calculate total accrued across all accounts
    let totalAccrued = BigInt(0);
    let accountCount = 0;
    
    for (const account of this.accounts.values()) {
      if (!account.isActive) continue;
      totalAccrued += account.accruedInterestCents;
      accountCount++;
    }
    
    // Get total posted from today's runs
    let totalPosted = BigInt(0);
    for (const run of this.runs.values()) {
      if (run.runDate === reconciliationDate) {
        totalPosted += run.totalInterestCents;
      }
    }
    
    const variance = totalAccrued - totalPosted;
    
    const reconciliation: EODReconciliation = {
      reconciliationId,
      reconciliationDate,
      status: variance === BigInt(0) ? "BALANCED" : "VARIANCE",
      totalAccruedCents: totalAccrued,
      totalPostedCents: totalPosted,
      varianceCents: variance,
      accountCount,
      completedAt: new Date().toISOString(),
    };
    
    this.reconciliations.set(reconciliationId, reconciliation);
    return reconciliation;
  }
  
  /**
   * Get scheduler runs.
   */
  getRuns(): SchedulerRun[] {
    return Array.from(this.runs.values());
  }
  
  /**
   * Get reconciliations.
   */
  getReconciliations(): EODReconciliation[] {
    return Array.from(this.reconciliations.values());
  }
  
  /**
   * Load sample accounts for demonstration.
   */
  loadSampleAccounts(): void {
    const today = new Date().toISOString().split("T")[0];
    const samples: InterestAccount[] = [
      { accountId: "DEP-001", accountType: "DEPOSIT", customerId: "CUST-001", customerName: "James Wilson", productCode: "SAVINGS", balanceCents: BigInt(10000000), rateId: "SAVINGS_TIERED", annualRate: 0.045, accruedInterestCents: BigInt(12329), lastAccrualDate: today, capitalizationDay: 1, isActive: true },
      { accountId: "DEP-002", accountType: "DEPOSIT", customerId: "CUST-002", customerName: "Sarah Chen", productCode: "TERM_12M", balanceCents: BigInt(50000000), rateId: "TERM_DEPOSIT_12M", annualRate: 0.05, accruedInterestCents: BigInt(68493), lastAccrualDate: today, capitalizationDay: 15, isActive: true },
      { accountId: "LOAN-001", accountType: "LOAN", customerId: "CUST-003", customerName: "Michael Brown", productCode: "PERSONAL", balanceCents: BigInt(2500000), rateId: "PERSONAL_LOAN_FIXED", annualRate: 0.0899, accruedInterestCents: BigInt(6157), lastAccrualDate: today, capitalizationDay: 1, isActive: true },
      { accountId: "LOAN-002", accountType: "LOAN", customerId: "CUST-004", customerName: "Emma Davis", productCode: "HOME_LOAN", balanceCents: BigInt(45000000), rateId: "HOME_LOAN_VARIABLE", annualRate: 0.0649, accruedInterestCents: BigInt(80000), lastAccrualDate: today, capitalizationDay: 1, isActive: true },
      { accountId: "CC-001", accountType: "CREDIT_CARD", customerId: "CUST-005", customerName: "David Thompson", productCode: "PLATINUM", balanceCents: BigInt(500000), rateId: "CREDIT_CARD_PURCHASE", annualRate: 0.2099, accruedInterestCents: BigInt(2876), lastAccrualDate: today, capitalizationDay: 25, isActive: true },
      { accountId: "OD-001", accountType: "OVERDRAFT", customerId: "CUST-006", customerName: "Lisa Anderson", productCode: "BUSINESS_OD", balanceCents: BigInt(1500000), rateId: "OVERDRAFT_RATE", annualRate: 0.1299, accruedInterestCents: BigInt(5336), lastAccrualDate: today, capitalizationDay: 1, isActive: true },
    ];
    samples.forEach(a => this.registerAccount(a));
  }
}

export const interestPostingScheduler = new InterestPostingScheduler();
interestPostingScheduler.loadSampleAccounts();

export default { InterestPostingScheduler, interestPostingScheduler, INTEREST_GL_ACCOUNTS };
