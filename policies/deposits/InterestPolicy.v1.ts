/**
 * InterestPolicy.v1.ts - Deposit Interest Policy Version 1
 * 
 * VERSION: v1
 * RELEASED: 2024-12-16
 * STATUS: FROZEN (no edits after release)
 * 
 * This policy evaluates interest accrual and recommends interest postings.
 * It does NOT apply interest - only recommends the posting.
 * 
 * Interest Calculation:
 * - Daily accrual based on ledger balance
 * - Tiered rates based on balance
 * - Monthly posting of accrued interest
 * 
 * Rate Determination:
 * - Product type (savings vs checking vs term)
 * - Balance tier
 * - Customer segment bonus
 */

import { DepositFact, isPostingApplied } from "../../core/deposits/events/DepositFact";
import { Posting, Postings } from "../../core/deposits/ledger/Posting";
import { Money } from "../../core/deposits/ledger/Money";
import { DepositPolicy, PolicyContext, PolicyRecommendation } from "./PolicyInterface";

/**
 * Interest rate configuration for v1.
 * Rates are in basis points (1 bp = 0.01%).
 * These values are FROZEN for this version.
 */
const INTEREST_CONFIG_V1 = {
  // Base rates by product type (annual, in basis points)
  baseRates: {
    savings: 350, // 3.50%
    checking: 50, // 0.50%
    term_deposit: 450, // 4.50%
  } as Record<string, number>,
  
  // Tiered bonus rates (additional basis points)
  balanceTiers: [
    { minBalance: 0n, bonusBps: 0 },
    { minBalance: 1000000n, bonusBps: 25 }, // $10,000+ gets +0.25%
    { minBalance: 5000000n, bonusBps: 50 }, // $50,000+ gets +0.50%
    { minBalance: 10000000n, bonusBps: 75 }, // $100,000+ gets +0.75%
  ],
  
  // Customer segment bonus rates
  segmentBonus: {
    standard: 0,
    premium: 25, // +0.25%
    business: 15, // +0.15%
    private: 50, // +0.50%
  } as Record<string, number>,
  
  // Minimum balance to earn interest
  minimumBalanceForInterest: 100n, // $1.00
  
  // Days in year for calculation
  daysInYear: 365,
} as const;

/**
 * InterestPolicy Version 1
 * 
 * FROZEN: Do not modify. Create v2 for changes.
 */
export class InterestPolicyV1 implements DepositPolicy {
  readonly policyId = "INTEREST_POLICY";
  readonly version = "v1";
  readonly description = "Deposit interest accrual policy - tiered rates with segment bonuses";
  
  evaluate(facts: DepositFact[], context: PolicyContext): PolicyRecommendation {
    // Calculate current balance from facts
    const currentBalance = this.calculateLedgerBalance(facts, context.currency);
    
    // Check minimum balance requirement
    if (currentBalance < INTEREST_CONFIG_V1.minimumBalanceForInterest) {
      return {
        policyId: this.policyId,
        policyVersion: this.version,
        postings: [],
        explanation: `Balance below minimum ($${INTEREST_CONFIG_V1.minimumBalanceForInterest / 100n}) for interest`,
        mandatory: false,
        evaluatedAt: context.asOf,
      };
    }
    
    // Calculate effective annual rate
    const effectiveRate = this.calculateEffectiveRate(
      currentBalance,
      context.productType,
      context.customerSegment
    );
    
    // Calculate daily interest
    const dailyInterest = this.calculateDailyInterest(currentBalance, effectiveRate);
    
    // If interest is zero (due to rounding), skip
    if (dailyInterest === 0n) {
      return {
        policyId: this.policyId,
        policyVersion: this.version,
        postings: [],
        explanation: "Interest rounds to zero for current balance",
        mandatory: false,
        evaluatedAt: context.asOf,
      };
    }
    
    // Create interest posting recommendation
    const interestPosting = Postings.interestAccrued(
      new Money(dailyInterest, context.currency),
      context.asOf.slice(0, 7), // Period: YYYY-MM
      context.asOf
    );
    
    const ratePercent = (effectiveRate / 100).toFixed(2);
    
    return {
      policyId: this.policyId,
      policyVersion: this.version,
      postings: [interestPosting],
      explanation: `Daily interest accrual at ${ratePercent}% annual rate = $${(Number(dailyInterest) / 100).toFixed(2)}`,
      mandatory: true,
      evaluatedAt: context.asOf,
    };
  }
  
  /**
   * Calculate ledger balance from facts.
   */
  private calculateLedgerBalance(facts: DepositFact[], currency: string): bigint {
    let balance = 0n;
    
    for (const fact of facts) {
      if (isPostingApplied(fact)) {
        const posting = fact.posting;
        if (posting.type === "CREDIT" || posting.type === "INTEREST_ACCRUED") {
          if (posting.amount.currency === currency) {
            balance += posting.amount.amount;
          }
        } else if (posting.type === "DEBIT") {
          if (posting.amount.currency === currency) {
            balance -= posting.amount.amount;
          }
        }
        // Holds don't affect ledger balance
      }
    }
    
    return balance;
  }
  
  /**
   * Calculate effective annual rate in basis points.
   */
  private calculateEffectiveRate(
    balance: bigint,
    productType: string,
    customerSegment?: string
  ): number {
    // Base rate for product
    const baseRate = INTEREST_CONFIG_V1.baseRates[productType] ?? 0;
    
    // Balance tier bonus
    let tierBonus = 0;
    for (const tier of INTEREST_CONFIG_V1.balanceTiers) {
      if (balance >= tier.minBalance) {
        tierBonus = tier.bonusBps;
      }
    }
    
    // Customer segment bonus
    const segmentBonus = INTEREST_CONFIG_V1.segmentBonus[customerSegment ?? "standard"] ?? 0;
    
    return baseRate + tierBonus + segmentBonus;
  }
  
  /**
   * Calculate daily interest amount in cents.
   * 
   * Formula: balance * (rate_bps / 10000) / 365
   * Using bigint math to avoid floating point.
   */
  private calculateDailyInterest(balance: bigint, annualRateBps: number): bigint {
    // Convert to avoid precision loss:
    // daily = balance * rateBps / 10000 / 365
    // = balance * rateBps / 3650000
    
    const numerator = balance * BigInt(annualRateBps);
    const denominator = BigInt(10000 * INTEREST_CONFIG_V1.daysInYear);
    
    // Round down (floor) - conservative for bank
    return numerator / denominator;
  }
  
  /**
   * Calculate monthly interest (for monthly posting).
   * This aggregates daily accruals for a full month.
   */
  calculateMonthlyInterest(
    facts: DepositFact[],
    context: PolicyContext,
    daysInMonth: number
  ): PolicyRecommendation {
    const currentBalance = this.calculateLedgerBalance(facts, context.currency);
    
    if (currentBalance < INTEREST_CONFIG_V1.minimumBalanceForInterest) {
      return {
        policyId: this.policyId,
        policyVersion: this.version,
        postings: [],
        explanation: "Balance below minimum for interest",
        mandatory: false,
        evaluatedAt: context.asOf,
      };
    }
    
    const effectiveRate = this.calculateEffectiveRate(
      currentBalance,
      context.productType,
      context.customerSegment
    );
    
    // Monthly interest = daily * days in month
    const dailyInterest = this.calculateDailyInterest(currentBalance, effectiveRate);
    const monthlyInterest = dailyInterest * BigInt(daysInMonth);
    
    if (monthlyInterest === 0n) {
      return {
        policyId: this.policyId,
        policyVersion: this.version,
        postings: [],
        explanation: "Monthly interest rounds to zero",
        mandatory: false,
        evaluatedAt: context.asOf,
      };
    }
    
    const interestPosting = Postings.interestAccrued(
      new Money(monthlyInterest, context.currency),
      context.asOf.slice(0, 7),
      context.asOf
    );
    
    const ratePercent = (effectiveRate / 100).toFixed(2);
    
    return {
      policyId: this.policyId,
      policyVersion: this.version,
      postings: [interestPosting],
      explanation: `Monthly interest at ${ratePercent}% annual rate for ${daysInMonth} days = $${(Number(monthlyInterest) / 100).toFixed(2)}`,
      mandatory: true,
      evaluatedAt: context.asOf,
    };
  }
}

/**
 * Export singleton instance for convenience.
 */
export const interestPolicyV1 = new InterestPolicyV1();
