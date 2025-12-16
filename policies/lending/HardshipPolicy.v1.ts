/**
 * Lending Policy Layer - Hardship Policy v1
 * 
 * CRITICAL RULES:
 * - Policies consume LoanFacts
 * - Policies produce recommended LoanFacts
 * - Policies NEVER apply facts
 * - Policies NEVER mutate state
 */

import type { LoanFact } from "../../core/lending";

export interface HardshipPolicyInput {
  loanId: string;
  loanFacts: LoanFact[];
  borrowerReason: string;
  borrowerFinancialSituation: {
    monthlyIncome: number;
    monthlyExpenses: number;
    hasEmergency: boolean;
  };
}

export interface HardshipPolicyRecommendation {
  eligible: boolean;
  recommendedType: "PAYMENT_PAUSE" | "REDUCED_PAYMENTS" | "INTEREST_ONLY" | null;
  confidence: number;
  rationale: string;
  durationMonths: number;
  conditions: string[];
}

/**
 * Hardship Policy v1 - Eligibility assessment
 * 
 * Evaluates:
 * - Borrower financial situation
 * - Loan payment history
 * - Existing hardship history
 * 
 * Returns: Recommendation only (no execution)
 */
export function evaluateHardshipPolicy(
  input: HardshipPolicyInput
): HardshipPolicyRecommendation {
  // Check if already in hardship
  const hardshipFacts = input.loanFacts.filter(f => f.type === "HARDSHIP_ENTERED");
  const exitFacts = input.loanFacts.filter(f => f.type === "HARDSHIP_EXITED");
  const isCurrentlyInHardship = hardshipFacts.length > exitFacts.length;
  
  if (isCurrentlyInHardship) {
    return {
      eligible: false,
      recommendedType: null,
      confidence: 1.0,
      rationale: "Borrower is already in hardship arrangement.",
      durationMonths: 0,
      conditions: [],
    };
  }
  
  // Check hardship history (max 2 hardship periods per loan)
  if (hardshipFacts.length >= 2) {
    return {
      eligible: false,
      recommendedType: null,
      confidence: 0.9,
      rationale: "Borrower has already used maximum hardship allowances (2 periods).",
      durationMonths: 0,
      conditions: [],
    };
  }
  
  // Assess financial situation
  const { monthlyIncome, monthlyExpenses, hasEmergency } = input.borrowerFinancialSituation;
  const discretionaryIncome = monthlyIncome - monthlyExpenses;
  const financialStress = discretionaryIncome / monthlyIncome;
  
  // Emergency situations get priority
  if (hasEmergency) {
    return {
      eligible: true,
      recommendedType: "PAYMENT_PAUSE",
      confidence: 0.95,
      rationale: `Emergency situation (${input.borrowerReason}). Recommend 3-month payment pause.`,
      durationMonths: 3,
      conditions: [
        "Borrower must provide evidence of emergency",
        "Review financial situation monthly",
        "Resume payments after 3 months or when situation improves",
      ],
    };
  }
  
  // Severe financial stress (>80% of income goes to expenses)
  if (financialStress < 0.2) {
    return {
      eligible: true,
      recommendedType: "REDUCED_PAYMENTS",
      confidence: 0.85,
      rationale: `Severe financial stress (${(financialStress * 100).toFixed(1)}% discretionary income). Recommend reduced payments for 6 months.`,
      durationMonths: 6,
      conditions: [
        "Reduce monthly payment by 50%",
        "Borrower must provide income/expense documentation",
        "Review situation every 2 months",
        "Extend loan term to compensate",
      ],
    };
  }
  
  // Moderate financial stress (60-80% of income goes to expenses)
  if (financialStress < 0.4) {
    return {
      eligible: true,
      recommendedType: "INTEREST_ONLY",
      confidence: 0.75,
      rationale: `Moderate financial stress (${(financialStress * 100).toFixed(1)}% discretionary income). Recommend interest-only payments for 6 months.`,
      durationMonths: 6,
      conditions: [
        "Pay interest only (no principal reduction)",
        "Borrower must provide income/expense documentation",
        "Review situation every 3 months",
      ],
    };
  }
  
  // Not eligible - financial situation is manageable
  return {
    eligible: false,
    recommendedType: null,
    confidence: 0.8,
    rationale: `Financial situation appears manageable (${(financialStress * 100).toFixed(1)}% discretionary income). Hardship not recommended at this time.`,
    durationMonths: 0,
    conditions: [
      "Consider budgeting assistance",
      "Monitor for 30 days",
      "Reassess if situation worsens",
    ],
  };
}
