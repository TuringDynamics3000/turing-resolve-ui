/**
 * Interest Accrual Service
 * 
 * TuringDynamics Core - Bank-Grade Interest Engine
 * 
 * Implements:
 * - Day-count conventions (ACT/365, ACT/360, 30/360, ACT/ACT)
 * - Daily interest accrual calculations
 * - Tiered interest rates
 * - Automated GL postings
 * - Compounding (simple, daily, monthly)
 * 
 * APRA Compliance: APS 117 Interest Rate Risk in the Banking Book
 */

import { Money } from "../../../core/deposits/ledger/Money";

// ============================================
// DAY COUNT CONVENTIONS
// ============================================

/**
 * Standard day-count conventions used in banking.
 * 
 * ACT/365 - Actual days / 365 (Australian standard)
 * ACT/360 - Actual days / 360 (Money market)
 * 30/360 - 30 days per month / 360 (Bond market)
 * ACT/ACT - Actual days / actual days in year (ISDA)
 */
export type DayCountConvention = 
  | "ACT_365"    // Actual/365 (Australian standard for loans)
  | "ACT_360"    // Actual/360 (Money market, some mortgages)
  | "30_360"     // 30/360 (Bond basis)
  | "ACT_ACT";   // Actual/Actual (ISDA)

/**
 * Compounding frequency.
 */
export type CompoundingFrequency = 
  | "SIMPLE"     // No compounding (simple interest)
  | "DAILY"      // Daily compounding
  | "MONTHLY"    // Monthly compounding
  | "QUARTERLY"  // Quarterly compounding
  | "ANNUALLY";  // Annual compounding

/**
 * Interest calculation method.
 */
export type InterestMethod = 
  | "FIXED"      // Fixed rate
  | "VARIABLE"   // Variable rate (linked to base rate)
  | "TIERED";    // Tiered rates based on balance

// ============================================
// INTEREST RATE STRUCTURES
// ============================================

/**
 * Interest rate definition.
 */
export interface InterestRate {
  readonly rateId: string;
  readonly name: string;
  readonly annualRate: number;           // Annual rate as decimal (e.g., 0.05 = 5%)
  readonly effectiveFrom: string;        // ISO 8601
  readonly effectiveTo?: string;         // ISO 8601 (null = current)
  readonly dayCountConvention: DayCountConvention;
  readonly compoundingFrequency: CompoundingFrequency;
  readonly method: InterestMethod;
  readonly baseRateId?: string;          // For variable rates
  readonly spread?: number;              // Spread over base rate
}

/**
 * Tiered interest rate structure.
 */
export interface TieredRate {
  readonly rateId: string;
  readonly name: string;
  readonly tiers: InterestTier[];
  readonly dayCountConvention: DayCountConvention;
  readonly compoundingFrequency: CompoundingFrequency;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
}

/**
 * Single tier in a tiered rate structure.
 */
export interface InterestTier {
  readonly tierNumber: number;
  readonly minBalance: Money;            // Minimum balance for this tier
  readonly maxBalance?: Money;           // Maximum balance (null = unlimited)
  readonly annualRate: number;           // Rate for this tier
  readonly description: string;
}

/**
 * Base rate for variable rate products.
 */
export interface BaseRate {
  readonly baseRateId: string;
  readonly name: string;                 // e.g., "RBA Cash Rate", "BBSW 3M"
  readonly currentRate: number;
  readonly effectiveFrom: string;
  readonly source: string;               // e.g., "RBA", "ASX"
}

// ============================================
// ACCRUAL TYPES
// ============================================

/**
 * Interest-bearing account/loan.
 */
export interface InterestBearingAccount {
  readonly accountId: string;
  readonly accountType: "DEPOSIT" | "LOAN" | "CREDIT_CARD" | "OVERDRAFT";
  readonly productCode: string;
  readonly balance: Money;               // Current balance
  readonly rateId: string;               // Interest rate ID
  readonly accrualStartDate: string;     // When accrual started
  readonly lastAccrualDate: string;      // Last accrual calculation date
  readonly accruedInterest: Money;       // Unpaid accrued interest
  readonly interestCapitalized: boolean; // Whether interest capitalizes
  readonly customerId: string;
}

/**
 * Daily accrual calculation result.
 */
export interface DailyAccrualResult {
  readonly accountId: string;
  readonly accrualDate: string;
  readonly openingBalance: Money;
  readonly dailyRate: number;            // Daily interest rate
  readonly daysInPeriod: number;         // Days accrued
  readonly interestAmount: Money;        // Interest for the day
  readonly closingAccruedInterest: Money;
  readonly dayCountConvention: DayCountConvention;
  readonly annualRate: number;
  readonly calculationDetails: string;
}

/**
 * Interest posting to GL.
 */
export interface InterestPosting {
  readonly postingId: string;
  readonly accountId: string;
  readonly postingDate: string;
  readonly postingType: "ACCRUAL" | "PAYMENT" | "CAPITALIZATION" | "ADJUSTMENT";
  readonly amount: Money;
  readonly debitAccount: string;         // GL account code
  readonly creditAccount: string;        // GL account code
  readonly description: string;
  readonly periodFrom: string;
  readonly periodTo: string;
}

// ============================================
// DAY COUNT CALCULATION FUNCTIONS
// ============================================

/**
 * Calculate the number of days between two dates.
 */
function daysBetween(startDate: Date, endDate: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay);
}

/**
 * Check if a year is a leap year.
 */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Get days in year for ACT/ACT convention.
 */
function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

/**
 * Calculate day count factor based on convention.
 * 
 * @param startDate - Period start date
 * @param endDate - Period end date
 * @param convention - Day count convention
 * @returns Day count factor (fraction of year)
 */
export function calculateDayCountFactor(
  startDate: Date,
  endDate: Date,
  convention: DayCountConvention
): { days: number; yearBasis: number; factor: number } {
  switch (convention) {
    case "ACT_365": {
      const days = daysBetween(startDate, endDate);
      return { days, yearBasis: 365, factor: days / 365 };
    }
    
    case "ACT_360": {
      const days = daysBetween(startDate, endDate);
      return { days, yearBasis: 360, factor: days / 360 };
    }
    
    case "30_360": {
      // 30/360 convention (US)
      let d1 = startDate.getDate();
      let d2 = endDate.getDate();
      const m1 = startDate.getMonth();
      const m2 = endDate.getMonth();
      const y1 = startDate.getFullYear();
      const y2 = endDate.getFullYear();
      
      // Adjust day 31 to 30
      if (d1 === 31) d1 = 30;
      if (d2 === 31 && d1 >= 30) d2 = 30;
      
      const days = (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
      return { days, yearBasis: 360, factor: days / 360 };
    }
    
    case "ACT_ACT": {
      const days = daysBetween(startDate, endDate);
      const yearBasis = daysInYear(startDate.getFullYear());
      return { days, yearBasis, factor: days / yearBasis };
    }
    
    default:
      throw new Error(`Unknown day count convention: ${convention}`);
  }
}

// ============================================
// INTEREST ACCRUAL SERVICE
// ============================================

export class InterestAccrualService {
  private rates: Map<string, InterestRate> = new Map();
  private tieredRates: Map<string, TieredRate> = new Map();
  private baseRates: Map<string, BaseRate> = new Map();
  
  /**
   * Register an interest rate.
   */
  registerRate(rate: InterestRate): void {
    this.rates.set(rate.rateId, rate);
  }
  
  /**
   * Register a tiered rate structure.
   */
  registerTieredRate(tieredRate: TieredRate): void {
    this.tieredRates.set(tieredRate.rateId, tieredRate);
  }
  
  /**
   * Register a base rate.
   */
  registerBaseRate(baseRate: BaseRate): void {
    this.baseRates.set(baseRate.baseRateId, baseRate);
  }
  
  /**
   * Get effective annual rate for an account.
   */
  getEffectiveRate(account: InterestBearingAccount): number {
    const rate = this.rates.get(account.rateId);
    
    if (rate) {
      if (rate.method === "VARIABLE" && rate.baseRateId) {
        const baseRate = this.baseRates.get(rate.baseRateId);
        if (baseRate) {
          return baseRate.currentRate + (rate.spread || 0);
        }
      }
      return rate.annualRate;
    }
    
    // Check tiered rates
    const tieredRate = this.tieredRates.get(account.rateId);
    if (tieredRate) {
      return this.calculateTieredRate(account.balance, tieredRate);
    }
    
    throw new Error(`Rate not found: ${account.rateId}`);
  }
  
  /**
   * Calculate blended rate for tiered structure.
   */
  calculateTieredRate(balance: Money, tieredRate: TieredRate): number {
    const balanceAmount = Number(balance.amount) / 100;
    let weightedRate = 0;
    let remainingBalance = balanceAmount;
    
    for (const tier of tieredRate.tiers.sort((a, b) => a.tierNumber - b.tierNumber)) {
      const tierMin = Number(tier.minBalance.amount) / 100;
      const tierMax = tier.maxBalance ? Number(tier.maxBalance.amount) / 100 : Infinity;
      
      if (remainingBalance <= 0) break;
      
      const tierRange = tierMax - tierMin;
      const balanceInTier = Math.min(remainingBalance, tierRange);
      
      if (balanceInTier > 0) {
        weightedRate += (balanceInTier / balanceAmount) * tier.annualRate;
        remainingBalance -= balanceInTier;
      }
    }
    
    return weightedRate;
  }
  
  /**
   * Calculate daily interest accrual.
   */
  calculateDailyAccrual(
    account: InterestBearingAccount,
    accrualDate: Date
  ): DailyAccrualResult {
    const rate = this.rates.get(account.rateId);
    const tieredRate = this.tieredRates.get(account.rateId);
    
    const dayCountConvention = rate?.dayCountConvention || 
                               tieredRate?.dayCountConvention || 
                               "ACT_365";
    
    const annualRate = this.getEffectiveRate(account);
    
    // Calculate day count factor for one day
    const previousDay = new Date(accrualDate);
    previousDay.setDate(previousDay.getDate() - 1);
    
    const { factor } = calculateDayCountFactor(previousDay, accrualDate, dayCountConvention);
    
    // Daily interest = Balance × Annual Rate × Day Count Factor
    const balanceAmount = Number(account.balance.amount);
    const dailyInterest = Math.round(balanceAmount * annualRate * factor);
    
    const interestAmount = new Money(BigInt(dailyInterest), account.balance.currency);
    const closingAccrued = new Money(
      account.accruedInterest.amount + BigInt(dailyInterest),
      account.balance.currency
    );
    
    // Calculate daily rate for reporting
    const dailyRate = annualRate * factor;
    
    return {
      accountId: account.accountId,
      accrualDate: accrualDate.toISOString().split("T")[0],
      openingBalance: account.balance,
      dailyRate,
      daysInPeriod: 1,
      interestAmount,
      closingAccruedInterest: closingAccrued,
      dayCountConvention,
      annualRate,
      calculationDetails: `${account.balance.toDisplayString()} × ${(annualRate * 100).toFixed(4)}% × ${factor.toFixed(6)} = ${interestAmount.toDisplayString()}`,
    };
  }
  
  /**
   * Calculate interest for a period.
   */
  calculatePeriodInterest(
    account: InterestBearingAccount,
    periodStart: Date,
    periodEnd: Date
  ): {
    totalInterest: Money;
    dailyAccruals: DailyAccrualResult[];
    effectiveRate: number;
    dayCount: number;
  } {
    const dailyAccruals: DailyAccrualResult[] = [];
    let totalInterest = BigInt(0);
    let currentDate = new Date(periodStart);
    currentDate.setDate(currentDate.getDate() + 1); // Start from day after period start
    
    // Create a mutable copy of the account for tracking accrued interest
    let currentAccruedInterest = account.accruedInterest.amount;
    
    while (currentDate <= periodEnd) {
      const tempAccount: InterestBearingAccount = {
        ...account,
        accruedInterest: new Money(currentAccruedInterest, account.balance.currency),
      };
      
      const accrual = this.calculateDailyAccrual(tempAccount, currentDate);
      dailyAccruals.push(accrual);
      totalInterest += accrual.interestAmount.amount;
      currentAccruedInterest = accrual.closingAccruedInterest.amount;
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return {
      totalInterest: new Money(totalInterest, account.balance.currency),
      dailyAccruals,
      effectiveRate: this.getEffectiveRate(account),
      dayCount: dailyAccruals.length,
    };
  }
  
  /**
   * Generate GL posting for interest accrual.
   */
  generateAccrualPosting(
    account: InterestBearingAccount,
    accrualResult: DailyAccrualResult
  ): InterestPosting {
    const postingId = `INT-${account.accountId}-${accrualResult.accrualDate}`;
    
    // Determine GL accounts based on account type
    let debitAccount: string;
    let creditAccount: string;
    
    if (account.accountType === "DEPOSIT") {
      // Deposit interest: Bank pays interest to customer
      debitAccount = "5000";  // Interest Expense - Deposits
      creditAccount = "2300"; // Interest Payable
    } else {
      // Loan interest: Customer pays interest to bank
      debitAccount = "1250";  // Interest Receivable
      creditAccount = "4000"; // Interest Income - Loans
    }
    
    return {
      postingId,
      accountId: account.accountId,
      postingDate: accrualResult.accrualDate,
      postingType: "ACCRUAL",
      amount: accrualResult.interestAmount,
      debitAccount,
      creditAccount,
      description: `Daily interest accrual - ${account.accountType} ${account.accountId}`,
      periodFrom: accrualResult.accrualDate,
      periodTo: accrualResult.accrualDate,
    };
  }
  
  /**
   * Generate GL posting for interest capitalization.
   */
  generateCapitalizationPosting(
    account: InterestBearingAccount,
    capitalizationDate: string
  ): InterestPosting | null {
    if (account.accruedInterest.amount === BigInt(0)) {
      return null;
    }
    
    const postingId = `CAP-${account.accountId}-${capitalizationDate}`;
    
    // Determine GL accounts based on account type
    let debitAccount: string;
    let creditAccount: string;
    
    if (account.accountType === "DEPOSIT") {
      // Capitalize deposit interest: Add to customer balance
      debitAccount = "2300";  // Interest Payable
      creditAccount = "2000"; // Customer Deposits Payable
    } else {
      // Capitalize loan interest: Add to loan principal
      debitAccount = "1200";  // Loans Receivable Control
      creditAccount = "1250"; // Interest Receivable
    }
    
    return {
      postingId,
      accountId: account.accountId,
      postingDate: capitalizationDate,
      postingType: "CAPITALIZATION",
      amount: account.accruedInterest,
      debitAccount,
      creditAccount,
      description: `Interest capitalization - ${account.accountType} ${account.accountId}`,
      periodFrom: account.lastAccrualDate,
      periodTo: capitalizationDate,
    };
  }
  
  /**
   * Load default rates for Australian market.
   */
  loadDefaultRates(): void {
    // RBA Cash Rate
    this.registerBaseRate({
      baseRateId: "RBA_CASH",
      name: "RBA Cash Rate",
      currentRate: 0.0435, // 4.35%
      effectiveFrom: "2023-11-07",
      source: "RBA",
    });
    
    // BBSW 3-month
    this.registerBaseRate({
      baseRateId: "BBSW_3M",
      name: "BBSW 3-Month",
      currentRate: 0.0445, // 4.45%
      effectiveFrom: new Date().toISOString().split("T")[0],
      source: "ASX",
    });
    
    // Standard variable home loan rate
    this.registerRate({
      rateId: "HOME_LOAN_VARIABLE",
      name: "Standard Variable Home Loan",
      annualRate: 0.0649, // 6.49%
      effectiveFrom: "2024-01-01",
      dayCountConvention: "ACT_365",
      compoundingFrequency: "MONTHLY",
      method: "VARIABLE",
      baseRateId: "RBA_CASH",
      spread: 0.0214, // 2.14% margin
    });
    
    // Personal loan fixed rate
    this.registerRate({
      rateId: "PERSONAL_LOAN_FIXED",
      name: "Personal Loan Fixed",
      annualRate: 0.0899, // 8.99%
      effectiveFrom: "2024-01-01",
      dayCountConvention: "ACT_365",
      compoundingFrequency: "MONTHLY",
      method: "FIXED",
    });
    
    // Credit card rate
    this.registerRate({
      rateId: "CREDIT_CARD_PURCHASE",
      name: "Credit Card Purchase Rate",
      annualRate: 0.2099, // 20.99%
      effectiveFrom: "2024-01-01",
      dayCountConvention: "ACT_365",
      compoundingFrequency: "DAILY",
      method: "FIXED",
    });
    
    // Savings account tiered rate
    this.registerTieredRate({
      rateId: "SAVINGS_TIERED",
      name: "Tiered Savings Account",
      dayCountConvention: "ACT_365",
      compoundingFrequency: "MONTHLY",
      effectiveFrom: "2024-01-01",
      tiers: [
        {
          tierNumber: 1,
          minBalance: new Money(BigInt(0), "AUD"),
          maxBalance: new Money(BigInt(1000000), "AUD"), // $10,000
          annualRate: 0.0100, // 1.00%
          description: "$0 - $10,000",
        },
        {
          tierNumber: 2,
          minBalance: new Money(BigInt(1000000), "AUD"),
          maxBalance: new Money(BigInt(5000000), "AUD"), // $50,000
          annualRate: 0.0350, // 3.50%
          description: "$10,000.01 - $50,000",
        },
        {
          tierNumber: 3,
          minBalance: new Money(BigInt(5000000), "AUD"),
          maxBalance: new Money(BigInt(25000000), "AUD"), // $250,000
          annualRate: 0.0450, // 4.50%
          description: "$50,000.01 - $250,000",
        },
        {
          tierNumber: 4,
          minBalance: new Money(BigInt(25000000), "AUD"),
          annualRate: 0.0500, // 5.00%
          description: "$250,000.01+",
        },
      ],
    });
    
    // Term deposit rates
    this.registerRate({
      rateId: "TERM_DEPOSIT_3M",
      name: "3-Month Term Deposit",
      annualRate: 0.0450, // 4.50%
      effectiveFrom: "2024-01-01",
      dayCountConvention: "ACT_365",
      compoundingFrequency: "SIMPLE",
      method: "FIXED",
    });
    
    this.registerRate({
      rateId: "TERM_DEPOSIT_6M",
      name: "6-Month Term Deposit",
      annualRate: 0.0475, // 4.75%
      effectiveFrom: "2024-01-01",
      dayCountConvention: "ACT_365",
      compoundingFrequency: "SIMPLE",
      method: "FIXED",
    });
    
    this.registerRate({
      rateId: "TERM_DEPOSIT_12M",
      name: "12-Month Term Deposit",
      annualRate: 0.0500, // 5.00%
      effectiveFrom: "2024-01-01",
      dayCountConvention: "ACT_365",
      compoundingFrequency: "SIMPLE",
      method: "FIXED",
    });
  }
  
  /**
   * Get all registered rates.
   */
  getAllRates(): {
    rates: InterestRate[];
    tieredRates: TieredRate[];
    baseRates: BaseRate[];
  } {
    return {
      rates: Array.from(this.rates.values()),
      tieredRates: Array.from(this.tieredRates.values()),
      baseRates: Array.from(this.baseRates.values()),
    };
  }
}

// Export singleton instance
export const interestAccrualService = new InterestAccrualService();

// Initialize with default rates
interestAccrualService.loadDefaultRates();

export default {
  InterestAccrualService,
  interestAccrualService,
  calculateDayCountFactor,
};
