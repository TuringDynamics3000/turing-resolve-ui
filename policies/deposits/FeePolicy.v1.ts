/**
 * FeePolicy.v1.ts - Deposit Fee Policy Version 1
 * 
 * VERSION: v1
 * RELEASED: 2024-12-16
 * STATUS: FROZEN (no edits after release)
 * 
 * This policy evaluates fee conditions and recommends fee postings.
 * It does NOT apply fees - only recommends them.
 * 
 * Fee Types Covered:
 * - Monthly maintenance fee
 * - Low balance fee
 * - Transaction fees (excessive withdrawals)
 * 
 * Waiver Conditions:
 * - Premium customers: all fees waived
 * - High balance: maintenance fee waived
 * - Direct deposit: maintenance fee waived
 */

import { DepositFact, isPostingApplied } from "../../core/deposits/events/DepositFact";
import { Posting, Postings, isDebitPosting } from "../../core/deposits/ledger/Posting";
import { Money } from "../../core/deposits/ledger/Money";
import { DepositPolicy, PolicyContext, PolicyRecommendation } from "./PolicyInterface";

/**
 * Fee configuration for v1.
 * These values are FROZEN for this version.
 */
const FEE_CONFIG_V1 = {
  // Monthly maintenance fee
  monthlyMaintenanceFee: {
    amount: 500n, // $5.00 in cents
    currency: "AUD",
  },
  
  // Low balance fee
  lowBalanceFee: {
    threshold: 10000n, // $100.00 minimum balance
    amount: 200n, // $2.00 fee
    currency: "AUD",
  },
  
  // Excessive withdrawal fee
  excessiveWithdrawalFee: {
    freeWithdrawalsPerMonth: 6,
    feePerExcess: 100n, // $1.00 per excess withdrawal
    currency: "AUD",
  },
  
  // Waiver thresholds
  waivers: {
    highBalanceThreshold: 500000n, // $5,000.00 waives maintenance
    premiumSegments: ["premium", "business", "private"],
  },
} as const;

/**
 * FeePolicy Version 1
 * 
 * FROZEN: Do not modify. Create v2 for changes.
 */
export class FeePolicyV1 implements DepositPolicy {
  readonly policyId = "FEE_POLICY";
  readonly version = "v1";
  readonly description = "Deposit fee evaluation policy - monthly maintenance, low balance, and transaction fees";
  
  evaluate(facts: DepositFact[], context: PolicyContext): PolicyRecommendation {
    const postings: Posting[] = [];
    const explanations: string[] = [];
    
    // Check for premium customer waiver
    if (this.isPremiumCustomer(context)) {
      return {
        policyId: this.policyId,
        policyVersion: this.version,
        postings: [],
        explanation: "All fees waived for premium customer segment",
        mandatory: false,
        evaluatedAt: context.asOf,
      };
    }
    
    // Calculate current balance from facts
    const currentBalance = this.calculateBalance(facts, context.currency);
    
    // 1. Monthly maintenance fee
    const maintenanceFee = this.evaluateMaintenanceFee(currentBalance, context);
    if (maintenanceFee) {
      postings.push(maintenanceFee);
      explanations.push("Monthly maintenance fee applied");
    } else {
      explanations.push("Monthly maintenance fee waived (high balance)");
    }
    
    // 2. Low balance fee
    const lowBalanceFee = this.evaluateLowBalanceFee(currentBalance, context);
    if (lowBalanceFee) {
      postings.push(lowBalanceFee);
      explanations.push(`Low balance fee applied (balance below $${FEE_CONFIG_V1.lowBalanceFee.threshold / 100n})`);
    }
    
    // 3. Excessive withdrawal fee
    const withdrawalFees = this.evaluateExcessiveWithdrawals(facts, context);
    if (withdrawalFees.length > 0) {
      postings.push(...withdrawalFees);
      explanations.push(`${withdrawalFees.length} excessive withdrawal fee(s) applied`);
    }
    
    return {
      policyId: this.policyId,
      policyVersion: this.version,
      postings,
      explanation: explanations.join("; "),
      mandatory: postings.length > 0,
      evaluatedAt: context.asOf,
    };
  }
  
  /**
   * Check if customer is in a premium segment (fees waived).
   */
  private isPremiumCustomer(context: PolicyContext): boolean {
    const segment = context.customerSegment ?? "";
    return (FEE_CONFIG_V1.waivers.premiumSegments as readonly string[]).includes(segment);
  }
  
  /**
   * Calculate current balance from facts.
   */
  private calculateBalance(facts: DepositFact[], currency: string): bigint {
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
   * Evaluate monthly maintenance fee.
   * Waived if balance exceeds threshold.
   */
  private evaluateMaintenanceFee(
    currentBalance: bigint,
    context: PolicyContext
  ): Posting | null {
    // Waive if high balance
    if (currentBalance >= FEE_CONFIG_V1.waivers.highBalanceThreshold) {
      return null;
    }
    
    // Only apply to checking/savings accounts
    if (!["checking", "savings"].includes(context.productType)) {
      return null;
    }
    
    return Postings.debit(
      new Money(
        FEE_CONFIG_V1.monthlyMaintenanceFee.amount,
        FEE_CONFIG_V1.monthlyMaintenanceFee.currency
      ),
      `FEE-MAINT-${context.asOf.slice(0, 7)}`, // e.g., FEE-MAINT-2024-12
      context.asOf
    );
  }
  
  /**
   * Evaluate low balance fee.
   */
  private evaluateLowBalanceFee(
    currentBalance: bigint,
    context: PolicyContext
  ): Posting | null {
    if (currentBalance >= FEE_CONFIG_V1.lowBalanceFee.threshold) {
      return null;
    }
    
    // Only apply to checking accounts
    if (context.productType !== "checking") {
      return null;
    }
    
    return Postings.debit(
      new Money(
        FEE_CONFIG_V1.lowBalanceFee.amount,
        FEE_CONFIG_V1.lowBalanceFee.currency
      ),
      `FEE-LOWBAL-${context.asOf.slice(0, 7)}`,
      context.asOf
    );
  }
  
  /**
   * Evaluate excessive withdrawal fees.
   * Count withdrawals in current month, charge for excess.
   */
  private evaluateExcessiveWithdrawals(
    facts: DepositFact[],
    context: PolicyContext
  ): Posting[] {
    // Only apply to savings accounts (Reg D style)
    if (context.productType !== "savings") {
      return [];
    }
    
    // Get current month
    const currentMonth = context.asOf.slice(0, 7); // YYYY-MM
    
    // Count withdrawals this month
    let withdrawalCount = 0;
    for (const fact of facts) {
      if (isPostingApplied(fact)) {
        if (isDebitPosting(fact.posting)) {
          if (fact.occurredAt.startsWith(currentMonth)) {
            withdrawalCount++;
          }
        }
      }
    }
    
    // Calculate excess
    const excessCount = Math.max(
      0,
      withdrawalCount - FEE_CONFIG_V1.excessiveWithdrawalFee.freeWithdrawalsPerMonth
    );
    
    if (excessCount === 0) {
      return [];
    }
    
    // Generate fee postings for excess withdrawals
    const fees: Posting[] = [];
    for (let i = 0; i < excessCount; i++) {
      fees.push(
        Postings.debit(
          new Money(
            FEE_CONFIG_V1.excessiveWithdrawalFee.feePerExcess,
            FEE_CONFIG_V1.excessiveWithdrawalFee.currency
          ),
          `FEE-EXWD-${currentMonth}-${i + 1}`,
          context.asOf
        )
      );
    }
    
    return fees;
  }
}

/**
 * Export singleton instance for convenience.
 * Use this in production.
 */
export const feePolicyV1 = new FeePolicyV1();
