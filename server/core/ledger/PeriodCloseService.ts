/**
 * Period Close Service
 * 
 * Handles month-end and year-end close processes:
 * - Journal entry freeze for closed periods
 * - P&L rollup to retained earnings
 * - Period status management
 * - Close validation and audit trail
 */

import { nanoid } from "nanoid";

// ============================================
// Types
// ============================================

export type PeriodType = "MONTH" | "QUARTER" | "YEAR";
export type PeriodStatus = "OPEN" | "SOFT_CLOSE" | "HARD_CLOSE" | "LOCKED";

export interface AccountingPeriod {
  periodId: string;
  periodType: PeriodType;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  fiscalYear: number;
  fiscalMonth: number;
  fiscalQuarter: number;
  status: PeriodStatus;
  closedAt?: string;
  closedBy?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenReason?: string;
  plRollupPostingId?: string;
  notes?: string;
}

export interface PeriodCloseResult {
  success: boolean;
  periodId: string;
  status: PeriodStatus;
  message: string;
  plRollupAmount?: string;
  plRollupPostingId?: string;
  warnings?: string[];
  errors?: string[];
}

export interface PLRollupEntry {
  accountCode: string;
  accountName: string;
  accountType: "REVENUE" | "EXPENSE";
  balance: bigint;
  currency: string;
}

export interface PeriodValidation {
  isValid: boolean;
  canClose: boolean;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  severity: "ERROR" | "WARNING" | "INFO";
  code: string;
  message: string;
  accountCode?: string;
  postingId?: string;
}

// ============================================
// Revenue & Expense Account Codes
// ============================================

const REVENUE_ACCOUNTS = [
  { code: "4000", name: "Interest Income - Loans" },
  { code: "4100", name: "Fee Income" },
  { code: "4200", name: "Card Interchange Income" },
];

const EXPENSE_ACCOUNTS = [
  { code: "5000", name: "Interest Expense - Deposits" },
  { code: "5100", name: "Provision Expense - Loan Losses" },
  { code: "5200", name: "Payment Processing Fees" },
];

const RETAINED_EARNINGS_CODE = "3100";

// ============================================
// In-Memory Period Store (would be database in production)
// ============================================

const periods: Map<string, AccountingPeriod> = new Map();

// Initialize current and past periods
function initializePeriods() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  // Create periods for current year
  for (let month = 1; month <= 12; month++) {
    const startDate = new Date(currentYear, month - 1, 1);
    const endDate = new Date(currentYear, month, 0);
    const periodId = `${currentYear}-${String(month).padStart(2, "0")}`;
    
    periods.set(periodId, {
      periodId,
      periodType: "MONTH",
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      fiscalYear: currentYear,
      fiscalMonth: month,
      fiscalQuarter: Math.ceil(month / 3),
      status: month < currentMonth ? "OPEN" : "OPEN", // Past months still open for demo
    });
  }
}

initializePeriods();

// ============================================
// Period Close Service
// ============================================

class PeriodCloseService {
  /**
   * Get all accounting periods
   */
  listPeriods(fiscalYear?: number): AccountingPeriod[] {
    const allPeriods = Array.from(periods.values());
    if (fiscalYear) {
      return allPeriods.filter(p => p.fiscalYear === fiscalYear);
    }
    return allPeriods.sort((a, b) => a.periodId.localeCompare(b.periodId));
  }

  /**
   * Get a specific period
   */
  getPeriod(periodId: string): AccountingPeriod | undefined {
    return periods.get(periodId);
  }

  /**
   * Get current open period
   */
  getCurrentPeriod(): AccountingPeriod | undefined {
    const now = new Date();
    const periodId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return periods.get(periodId);
  }

  /**
   * Validate period for close
   */
  validatePeriodForClose(periodId: string): PeriodValidation {
    const period = periods.get(periodId);
    const issues: ValidationIssue[] = [];
    
    if (!period) {
      return {
        isValid: false,
        canClose: false,
        issues: [{
          severity: "ERROR",
          code: "PERIOD_NOT_FOUND",
          message: `Period ${periodId} not found`,
        }],
      };
    }

    // Check if already closed
    if (period.status === "HARD_CLOSE" || period.status === "LOCKED") {
      issues.push({
        severity: "ERROR",
        code: "ALREADY_CLOSED",
        message: `Period ${periodId} is already closed (status: ${period.status})`,
      });
    }

    // Check if period end date is in the future
    const endDate = new Date(period.endDate);
    if (endDate > new Date()) {
      issues.push({
        severity: "ERROR",
        code: "FUTURE_PERIOD",
        message: `Cannot close period ${periodId} - end date is in the future`,
      });
    }

    // Check for prior open periods
    const priorPeriods = this.listPeriods(period.fiscalYear)
      .filter(p => p.periodId < periodId && p.status === "OPEN");
    
    if (priorPeriods.length > 0) {
      issues.push({
        severity: "WARNING",
        code: "PRIOR_PERIODS_OPEN",
        message: `${priorPeriods.length} prior period(s) are still open`,
      });
    }

    // In production: Check for unposted entries, suspense balances, etc.
    // For demo, we'll add a simulated check
    const suspenseBalance = Math.random() > 0.8 ? 1234.56 : 0;
    if (suspenseBalance > 0) {
      issues.push({
        severity: "WARNING",
        code: "SUSPENSE_BALANCE",
        message: `Suspense account has balance of $${suspenseBalance.toFixed(2)}`,
        accountCode: "1900",
      });
    }

    const hasErrors = issues.some(i => i.severity === "ERROR");
    
    return {
      isValid: !hasErrors,
      canClose: !hasErrors,
      issues,
    };
  }

  /**
   * Soft close a period (allows corrections with approval)
   */
  softClosePeriod(periodId: string, closedBy: string): PeriodCloseResult {
    const validation = this.validatePeriodForClose(periodId);
    
    if (!validation.canClose) {
      return {
        success: false,
        periodId,
        status: periods.get(periodId)?.status || "OPEN",
        message: "Period cannot be soft closed due to validation errors",
        errors: validation.issues.filter(i => i.severity === "ERROR").map(i => i.message),
        warnings: validation.issues.filter(i => i.severity === "WARNING").map(i => i.message),
      };
    }

    const period = periods.get(periodId)!;
    period.status = "SOFT_CLOSE";
    period.closedAt = new Date().toISOString();
    period.closedBy = closedBy;
    periods.set(periodId, period);

    return {
      success: true,
      periodId,
      status: "SOFT_CLOSE",
      message: `Period ${periodId} soft closed. Corrections require approval.`,
      warnings: validation.issues.filter(i => i.severity === "WARNING").map(i => i.message),
    };
  }

  /**
   * Hard close a period with P&L rollup
   */
  hardClosePeriod(periodId: string, closedBy: string): PeriodCloseResult {
    const validation = this.validatePeriodForClose(periodId);
    
    if (!validation.canClose) {
      return {
        success: false,
        periodId,
        status: periods.get(periodId)?.status || "OPEN",
        message: "Period cannot be hard closed due to validation errors",
        errors: validation.issues.filter(i => i.severity === "ERROR").map(i => i.message),
      };
    }

    const period = periods.get(periodId)!;
    
    // Calculate P&L rollup
    const plRollup = this.calculatePLRollup(periodId);
    const netIncome = plRollup.totalRevenue - plRollup.totalExpenses;
    
    // Create P&L rollup posting (in production, this would create actual ledger entries)
    const rollupPostingId = `PL-ROLLUP-${periodId}-${nanoid(8)}`;
    
    // Update period status
    period.status = "HARD_CLOSE";
    period.closedAt = new Date().toISOString();
    period.closedBy = closedBy;
    period.plRollupPostingId = rollupPostingId;
    periods.set(periodId, period);

    return {
      success: true,
      periodId,
      status: "HARD_CLOSE",
      message: `Period ${periodId} hard closed. P&L rolled to retained earnings.`,
      plRollupAmount: this.formatCurrency(netIncome),
      plRollupPostingId: rollupPostingId,
      warnings: validation.issues.filter(i => i.severity === "WARNING").map(i => i.message),
    };
  }

  /**
   * Lock a period (no changes allowed, even with approval)
   */
  lockPeriod(periodId: string, lockedBy: string): PeriodCloseResult {
    const period = periods.get(periodId);
    
    if (!period) {
      return {
        success: false,
        periodId,
        status: "OPEN",
        message: `Period ${periodId} not found`,
        errors: ["Period not found"],
      };
    }

    if (period.status !== "HARD_CLOSE") {
      return {
        success: false,
        periodId,
        status: period.status,
        message: "Period must be hard closed before locking",
        errors: ["Period must be hard closed first"],
      };
    }

    period.status = "LOCKED";
    periods.set(periodId, period);

    return {
      success: true,
      periodId,
      status: "LOCKED",
      message: `Period ${periodId} locked. No further changes allowed.`,
    };
  }

  /**
   * Reopen a closed period (requires reason and approval)
   */
  reopenPeriod(periodId: string, reopenedBy: string, reason: string): PeriodCloseResult {
    const period = periods.get(periodId);
    
    if (!period) {
      return {
        success: false,
        periodId,
        status: "OPEN",
        message: `Period ${periodId} not found`,
        errors: ["Period not found"],
      };
    }

    if (period.status === "LOCKED") {
      return {
        success: false,
        periodId,
        status: "LOCKED",
        message: "Locked periods cannot be reopened",
        errors: ["Period is locked and cannot be reopened"],
      };
    }

    if (period.status === "OPEN") {
      return {
        success: false,
        periodId,
        status: "OPEN",
        message: "Period is already open",
        errors: ["Period is already open"],
      };
    }

    // Reopen the period
    const previousStatus = period.status;
    period.status = "OPEN";
    period.reopenedAt = new Date().toISOString();
    period.reopenedBy = reopenedBy;
    period.reopenReason = reason;
    periods.set(periodId, period);

    return {
      success: true,
      periodId,
      status: "OPEN",
      message: `Period ${periodId} reopened from ${previousStatus}. Reason: ${reason}`,
      warnings: ["P&L rollup may need to be reversed if entries are modified"],
    };
  }

  /**
   * Calculate P&L rollup for a period
   */
  calculatePLRollup(periodId: string): {
    revenueAccounts: PLRollupEntry[];
    expenseAccounts: PLRollupEntry[];
    totalRevenue: bigint;
    totalExpenses: bigint;
    netIncome: bigint;
  } {
    // In production, this would query actual ledger balances
    // For demo, we'll generate realistic sample data
    const revenueAccounts: PLRollupEntry[] = REVENUE_ACCOUNTS.map(acc => ({
      accountCode: acc.code,
      accountName: acc.name,
      accountType: "REVENUE" as const,
      balance: BigInt(Math.floor(Math.random() * 500000) + 100000), // $1,000 - $6,000
      currency: "AUD",
    }));

    const expenseAccounts: PLRollupEntry[] = EXPENSE_ACCOUNTS.map(acc => ({
      accountCode: acc.code,
      accountName: acc.name,
      accountType: "EXPENSE" as const,
      balance: BigInt(Math.floor(Math.random() * 300000) + 50000), // $500 - $3,500
      currency: "AUD",
    }));

    const totalRevenue = revenueAccounts.reduce((sum, acc) => sum + acc.balance, BigInt(0));
    const totalExpenses = expenseAccounts.reduce((sum, acc) => sum + acc.balance, BigInt(0));
    const netIncome = totalRevenue - totalExpenses;

    return {
      revenueAccounts,
      expenseAccounts,
      totalRevenue,
      totalExpenses,
      netIncome,
    };
  }

  /**
   * Check if posting is allowed for a date
   */
  canPostToDate(effectiveDate: string): { allowed: boolean; reason?: string } {
    const date = new Date(effectiveDate);
    const periodId = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const period = periods.get(periodId);

    if (!period) {
      return { allowed: false, reason: `No accounting period found for ${effectiveDate}` };
    }

    switch (period.status) {
      case "OPEN":
        return { allowed: true };
      case "SOFT_CLOSE":
        return { allowed: false, reason: `Period ${periodId} is soft closed. Corrections require approval.` };
      case "HARD_CLOSE":
        return { allowed: false, reason: `Period ${periodId} is hard closed. Reopen required for corrections.` };
      case "LOCKED":
        return { allowed: false, reason: `Period ${periodId} is locked. No changes allowed.` };
      default:
        return { allowed: false, reason: "Unknown period status" };
    }
  }

  /**
   * Get period close summary for reporting
   */
  getPeriodCloseSummary(fiscalYear: number): {
    year: number;
    periods: Array<{
      periodId: string;
      month: number;
      status: PeriodStatus;
      closedAt?: string;
      closedBy?: string;
    }>;
    openCount: number;
    softCloseCount: number;
    hardCloseCount: number;
    lockedCount: number;
  } {
    const yearPeriods = this.listPeriods(fiscalYear);
    
    return {
      year: fiscalYear,
      periods: yearPeriods.map(p => ({
        periodId: p.periodId,
        month: p.fiscalMonth,
        status: p.status,
        closedAt: p.closedAt,
        closedBy: p.closedBy,
      })),
      openCount: yearPeriods.filter(p => p.status === "OPEN").length,
      softCloseCount: yearPeriods.filter(p => p.status === "SOFT_CLOSE").length,
      hardCloseCount: yearPeriods.filter(p => p.status === "HARD_CLOSE").length,
      lockedCount: yearPeriods.filter(p => p.status === "LOCKED").length,
    };
  }

  private formatCurrency(cents: bigint): string {
    const dollars = Number(cents) / 100;
    return `$${dollars.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

export const periodCloseService = new PeriodCloseService();
