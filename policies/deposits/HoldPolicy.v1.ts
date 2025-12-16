/**
 * HoldPolicy.v1.ts - Deposit Hold Policy Version 1
 * 
 * VERSION: v1
 * RELEASED: 2024-12-16
 * STATUS: FROZEN (no edits after release)
 * 
 * This policy evaluates hold conditions and recommends hold postings.
 * It does NOT apply holds - only recommends them.
 * 
 * Hold Types:
 * - Payment hold (pending payment authorization)
 * - Deposit hold (new deposit clearing)
 * - Regulatory hold (AML/compliance)
 * - Legal hold (court order, garnishment)
 * 
 * Hold Rules:
 * - Maximum hold duration by type
 * - Auto-release conditions
 * - Regulatory hold overrides
 */

import { DepositFact, isPostingApplied } from "../../core/deposits/events/DepositFact";
import { Posting, Postings, isHoldPlacedPosting } from "../../core/deposits/ledger/Posting";
import { Money } from "../../core/deposits/ledger/Money";
import { DepositPolicy, PolicyContext, PolicyRecommendation } from "./PolicyInterface";

/**
 * Hold type enumeration.
 */
export type HoldType = "PAYMENT" | "DEPOSIT" | "REGULATORY" | "LEGAL";

/**
 * Hold configuration for v1.
 * These values are FROZEN for this version.
 */
const HOLD_CONFIG_V1 = {
  // Maximum hold durations in days
  maxDurations: {
    PAYMENT: 7, // Payment authorizations expire in 7 days
    DEPOSIT: 5, // Deposit holds clear in 5 business days
    REGULATORY: 30, // AML holds up to 30 days
    LEGAL: 365, // Legal holds can be long-term
  } as Record<HoldType, number>,
  
  // Deposit hold thresholds
  depositHold: {
    // Deposits over this amount get held
    thresholdAmount: 500000n, // $5,000
    // New accounts get holds on all deposits for first 30 days
    newAccountDays: 30,
    // Hold percentage for large deposits
    holdPercentage: 50, // Hold 50% of large deposits
  },
  
  // Regulatory hold triggers
  regulatoryTriggers: {
    // Cash deposits over this trigger AML hold
    cashThreshold: 1000000n, // $10,000 (CTR threshold)
    // International transfers over this trigger review
    internationalThreshold: 300000n, // $3,000
  },
} as const;

/**
 * Hold request for policy evaluation.
 */
export interface HoldRequest {
  readonly type: HoldType;
  readonly amount: Money;
  readonly reason: string;
  readonly sourceReference?: string;
  readonly expiresAt?: string;
}

/**
 * HoldPolicy Version 1
 * 
 * FROZEN: Do not modify. Create v2 for changes.
 */
export class HoldPolicyV1 implements DepositPolicy {
  readonly policyId = "HOLD_POLICY";
  readonly version = "v1";
  readonly description = "Deposit hold evaluation policy - payment, deposit, regulatory, and legal holds";
  
  evaluate(facts: DepositFact[], context: PolicyContext): PolicyRecommendation {
    // This base evaluate checks for expired holds that should be released
    const releasePostings = this.evaluateExpiredHolds(facts, context);
    
    if (releasePostings.length === 0) {
      return {
        policyId: this.policyId,
        policyVersion: this.version,
        postings: [],
        explanation: "No expired holds to release",
        mandatory: false,
        evaluatedAt: context.asOf,
      };
    }
    
    return {
      policyId: this.policyId,
      policyVersion: this.version,
      postings: releasePostings,
      explanation: `${releasePostings.length} expired hold(s) recommended for release`,
      mandatory: true,
      evaluatedAt: context.asOf,
    };
  }
  
  /**
   * Evaluate a specific hold request.
   * Returns recommendation for placing the hold.
   */
  evaluateHoldRequest(
    facts: DepositFact[],
    context: PolicyContext,
    request: HoldRequest
  ): PolicyRecommendation {
    // Calculate available balance
    const availableBalance = this.calculateAvailableBalance(facts, context.currency);
    
    // Check if sufficient funds
    if (request.amount.amount > availableBalance) {
      return {
        policyId: this.policyId,
        policyVersion: this.version,
        postings: [],
        explanation: `Insufficient available balance for hold: ${availableBalance} < ${request.amount.amount}`,
        mandatory: false,
        evaluatedAt: context.asOf,
      };
    }
    
    // Generate hold ID
    const holdId = this.generateHoldId(request.type, context.asOf, request.sourceReference);
    
    // Create hold posting
    const holdPosting = Postings.holdPlaced(
      request.amount,
      holdId,
      request.reason,
      context.asOf
    );
    
    return {
      policyId: this.policyId,
      policyVersion: this.version,
      postings: [holdPosting],
      explanation: `${request.type} hold recommended: ${request.amount.toDisplayString()} - ${request.reason}`,
      mandatory: request.type === "REGULATORY" || request.type === "LEGAL",
      evaluatedAt: context.asOf,
    };
  }
  
  /**
   * Evaluate deposit for potential hold.
   * Large deposits or new accounts may require holds.
   */
  evaluateDepositHold(
    facts: DepositFact[],
    context: PolicyContext,
    depositAmount: Money,
    isNewAccount: boolean,
    isCashDeposit: boolean
  ): PolicyRecommendation {
    const postings: Posting[] = [];
    const explanations: string[] = [];
    
    // Check for regulatory hold (cash over threshold)
    if (isCashDeposit && depositAmount.amount >= HOLD_CONFIG_V1.regulatoryTriggers.cashThreshold) {
      const holdId = this.generateHoldId("REGULATORY", context.asOf, "CTR");
      postings.push(
        Postings.holdPlaced(
          depositAmount,
          holdId,
          "CTR threshold exceeded - AML review required",
          context.asOf
        )
      );
      explanations.push("Regulatory hold: cash deposit exceeds CTR threshold");
    }
    // Check for large deposit hold
    else if (depositAmount.amount >= HOLD_CONFIG_V1.depositHold.thresholdAmount) {
      // Hold percentage of large deposit
      const holdAmount = (depositAmount.amount * BigInt(HOLD_CONFIG_V1.depositHold.holdPercentage)) / 100n;
      const holdId = this.generateHoldId("DEPOSIT", context.asOf, "LARGE");
      postings.push(
        Postings.holdPlaced(
          new Money(holdAmount, depositAmount.currency),
          holdId,
          "Large deposit clearing hold",
          context.asOf
        )
      );
      explanations.push(`Deposit hold: ${HOLD_CONFIG_V1.depositHold.holdPercentage}% of large deposit`);
    }
    // Check for new account hold
    else if (isNewAccount) {
      const holdId = this.generateHoldId("DEPOSIT", context.asOf, "NEWACCT");
      postings.push(
        Postings.holdPlaced(
          depositAmount,
          holdId,
          "New account deposit hold",
          context.asOf
        )
      );
      explanations.push("Deposit hold: new account policy");
    }
    
    if (postings.length === 0) {
      return {
        policyId: this.policyId,
        policyVersion: this.version,
        postings: [],
        explanation: "No hold required for this deposit",
        mandatory: false,
        evaluatedAt: context.asOf,
      };
    }
    
    return {
      policyId: this.policyId,
      policyVersion: this.version,
      postings,
      explanation: explanations.join("; "),
      mandatory: postings.some(p => 
        isHoldPlacedPosting(p) && p.holdId.startsWith("HOLD-REGULATORY")
      ),
      evaluatedAt: context.asOf,
    };
  }
  
  /**
   * Evaluate hold release request.
   */
  evaluateHoldRelease(
    facts: DepositFact[],
    context: PolicyContext,
    holdId: string
  ): PolicyRecommendation {
    // Find the hold in facts
    const holdFact = this.findHold(facts, holdId);
    
    if (!holdFact) {
      return {
        policyId: this.policyId,
        policyVersion: this.version,
        postings: [],
        explanation: `Hold ${holdId} not found`,
        mandatory: false,
        evaluatedAt: context.asOf,
      };
    }
    
    // Check if already released
    if (this.isHoldReleased(facts, holdId)) {
      return {
        policyId: this.policyId,
        policyVersion: this.version,
        postings: [],
        explanation: `Hold ${holdId} already released`,
        mandatory: false,
        evaluatedAt: context.asOf,
      };
    }
    
    // Legal holds require explicit authorization
    if (holdId.includes("LEGAL")) {
      return {
        policyId: this.policyId,
        policyVersion: this.version,
        postings: [],
        explanation: "Legal holds require explicit authorization to release",
        mandatory: false,
        evaluatedAt: context.asOf,
      };
    }
    
    // Recommend release
    const releasePosting = Postings.holdReleased(holdId, context.asOf);
    
    return {
      policyId: this.policyId,
      policyVersion: this.version,
      postings: [releasePosting],
      explanation: `Hold ${holdId} recommended for release`,
      mandatory: false,
      evaluatedAt: context.asOf,
    };
  }
  
  /**
   * Find expired holds that should be auto-released.
   */
  private evaluateExpiredHolds(facts: DepositFact[], context: PolicyContext): Posting[] {
    const releasePostings: Posting[] = [];
    const currentDate = new Date(context.asOf);
    
    for (const fact of facts) {
      if (isPostingApplied(fact) && isHoldPlacedPosting(fact.posting)) {
        const holdId = fact.posting.holdId;
        
        // Skip if already released
        if (this.isHoldReleased(facts, holdId)) {
          continue;
        }
        
        // Determine hold type from ID
        const holdType = this.getHoldTypeFromId(holdId);
        if (!holdType) continue;
        
        // Skip legal holds - never auto-release
        if (holdType === "LEGAL") continue;
        
        // Check if expired
        const holdDate = new Date(fact.occurredAt);
        const maxDays = HOLD_CONFIG_V1.maxDurations[holdType];
        const expiryDate = new Date(holdDate);
        expiryDate.setDate(expiryDate.getDate() + maxDays);
        
        if (currentDate >= expiryDate) {
          releasePostings.push(Postings.holdReleased(holdId, context.asOf));
        }
      }
    }
    
    return releasePostings;
  }
  
  /**
   * Calculate available balance from facts.
   */
  private calculateAvailableBalance(facts: DepositFact[], currency: string): bigint {
    let ledger = 0n;
    let holds = 0n;
    
    for (const fact of facts) {
      if (isPostingApplied(fact)) {
        const posting = fact.posting;
        if (posting.type === "CREDIT" || posting.type === "INTEREST_ACCRUED") {
          if (posting.amount.currency === currency) {
            ledger += posting.amount.amount;
          }
        } else if (posting.type === "DEBIT") {
          if (posting.amount.currency === currency) {
            ledger -= posting.amount.amount;
          }
        } else if (posting.type === "HOLD_PLACED") {
          if (posting.amount.currency === currency) {
            holds += posting.amount.amount;
          }
        } else if (posting.type === "HOLD_RELEASED") {
          // Find the original hold amount
          const originalHold = this.findHold(facts, posting.holdId);
          if (originalHold && isHoldPlacedPosting(originalHold)) {
            holds -= originalHold.amount.amount;
          }
        }
      }
    }
    
    return ledger - holds;
  }
  
  /**
   * Find a hold posting by ID.
   */
  private findHold(facts: DepositFact[], holdId: string): Posting | null {
    for (const fact of facts) {
      if (isPostingApplied(fact) && isHoldPlacedPosting(fact.posting)) {
        if (fact.posting.holdId === holdId) {
          return fact.posting;
        }
      }
    }
    return null;
  }
  
  /**
   * Check if a hold has been released.
   */
  private isHoldReleased(facts: DepositFact[], holdId: string): boolean {
    for (const fact of facts) {
      if (isPostingApplied(fact) && fact.posting.type === "HOLD_RELEASED") {
        if (fact.posting.holdId === holdId) {
          return true;
        }
      }
    }
    return false;
  }
  
  /**
   * Generate a unique hold ID.
   */
  private generateHoldId(type: HoldType, timestamp: string, reference?: string): string {
    const ts = timestamp.replace(/[-:T.Z]/g, "").slice(0, 14);
    const ref = reference ? `-${reference}` : "";
    return `HOLD-${type}-${ts}${ref}`;
  }
  
  /**
   * Extract hold type from hold ID.
   */
  private getHoldTypeFromId(holdId: string): HoldType | null {
    if (holdId.includes("PAYMENT")) return "PAYMENT";
    if (holdId.includes("DEPOSIT")) return "DEPOSIT";
    if (holdId.includes("REGULATORY")) return "REGULATORY";
    if (holdId.includes("LEGAL")) return "LEGAL";
    return null;
  }
}

/**
 * Export singleton instance for convenience.
 */
export const holdPolicyV1 = new HoldPolicyV1();
