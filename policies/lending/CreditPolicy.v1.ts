/**
 * Lending Policy Layer - Credit Policy v1
 * 
 * CRITICAL RULES:
 * - Policies consume LoanFacts + DepositFacts
 * - Policies produce recommended LoanFacts
 * - Policies NEVER apply facts
 * - Policies NEVER mutate state
 * 
 * This replaces HES "automated underwriting" but keeps execution
 * deterministic and auditable.
 */

import type { LoanFact } from "../../core/lending";

export interface CreditPolicyInput {
  applicantAccountId: string;
  requestedPrincipal: bigint;
  requestedTermMonths: number;
  depositFacts: any[]; // Deposit account history
  existingLoanFacts: LoanFact[]; // Existing loans for this borrower
}

export interface CreditPolicyRecommendation {
  decision: "APPROVE" | "REVIEW" | "DECLINE";
  confidence: number; // 0-1
  rationale: string;
  recommendedPrincipal?: bigint;
  recommendedRate?: number;
  recommendedTermMonths?: number;
  conditions?: string[];
  riskScore: number; // 0-100
}

/**
 * Credit Policy v1 - Rule-based credit assessment
 * 
 * Evaluates:
 * - Deposit account balance history
 * - Existing loan repayment history
 * - Debt-to-income ratio (derived from deposit flows)
 * - Default risk indicators
 * 
 * Returns: Recommendation only (no execution)
 */
export function evaluateCreditPolicy(
  input: CreditPolicyInput
): CreditPolicyRecommendation {
  // Calculate deposit account health
  const depositHealth = calculateDepositHealth(input.depositFacts);
  
  // Calculate existing loan performance
  const loanPerformance = calculateLoanPerformance(input.existingLoanFacts);
  
  // Calculate debt-to-income ratio
  const dti = calculateDebtToIncome(input);
  
  // Calculate risk score (0-100, higher = riskier)
  const riskScore = calculateRiskScore(depositHealth, loanPerformance, dti);
  
  // Apply policy rules
  if (riskScore > 80) {
    return {
      decision: "DECLINE",
      confidence: 0.95,
      rationale: `High risk score (${riskScore}). Deposit health: ${depositHealth.status}, DTI: ${(dti * 100).toFixed(1)}%`,
      riskScore,
    };
  }
  
  if (riskScore > 60) {
    return {
      decision: "REVIEW",
      confidence: 0.75,
      rationale: `Moderate risk score (${riskScore}). Manual review recommended. DTI: ${(dti * 100).toFixed(1)}%`,
      riskScore,
      conditions: [
        "Verify income sources",
        "Review deposit account stability",
        "Assess existing loan repayment history",
      ],
    };
  }
  
  // Low risk - approve with recommended terms
  const recommendedRate = calculateRecommendedRate(riskScore);
  
  return {
    decision: "APPROVE",
    confidence: 0.9,
    rationale: `Low risk score (${riskScore}). Strong deposit health, good loan performance. DTI: ${(dti * 100).toFixed(1)}%`,
    recommendedPrincipal: input.requestedPrincipal,
    recommendedRate,
    recommendedTermMonths: input.requestedTermMonths,
    riskScore,
  };
}

/**
 * Calculate deposit account health from deposit facts
 */
function calculateDepositHealth(depositFacts: any[]): {
  status: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  averageBalance: bigint;
  volatility: number;
} {
  // Simplified: In production, analyze DEPOSIT_CREATED, DEPOSIT_CREDITED, etc.
  if (depositFacts.length === 0) {
    return { status: "POOR", averageBalance: 0n, volatility: 1.0 };
  }
  
  // Placeholder logic
  return {
    status: "GOOD",
    averageBalance: BigInt(50000), // $500 average balance
    volatility: 0.3,
  };
}

/**
 * Calculate loan performance from existing loan facts
 */
function calculateLoanPerformance(loanFacts: LoanFact[]): {
  status: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  onTimePaymentRate: number;
  hasArrears: boolean;
  hasDefaults: boolean;
} {
  if (loanFacts.length === 0) {
    return {
      status: "GOOD", // No history = neutral
      onTimePaymentRate: 1.0,
      hasArrears: false,
      hasDefaults: false,
    };
  }
  
  const hasArrears = loanFacts.some(f => f.type === "LOAN_IN_ARREARS");
  const hasDefaults = loanFacts.some(f => f.type === "LOAN_DEFAULTED");
  
  if (hasDefaults) {
    return { status: "POOR", onTimePaymentRate: 0.5, hasArrears: true, hasDefaults: true };
  }
  
  if (hasArrears) {
    return { status: "FAIR", onTimePaymentRate: 0.8, hasArrears: true, hasDefaults: false };
  }
  
  return { status: "EXCELLENT", onTimePaymentRate: 1.0, hasArrears: false, hasDefaults: false };
}

/**
 * Calculate debt-to-income ratio
 */
function calculateDebtToIncome(input: CreditPolicyInput): number {
  // Simplified: In production, derive from deposit account inflows vs existing loan obligations
  const estimatedMonthlyIncome = 5000; // Derived from deposit facts
  const monthlyLoanPayment = Number(input.requestedPrincipal) / input.requestedTermMonths / 100;
  
  return monthlyLoanPayment / estimatedMonthlyIncome;
}

/**
 * Calculate risk score (0-100, higher = riskier)
 */
function calculateRiskScore(
  depositHealth: ReturnType<typeof calculateDepositHealth>,
  loanPerformance: ReturnType<typeof calculateLoanPerformance>,
  dti: number
): number {
  let score = 0;
  
  // Deposit health component (0-30 points)
  if (depositHealth.status === "POOR") score += 30;
  else if (depositHealth.status === "FAIR") score += 20;
  else if (depositHealth.status === "GOOD") score += 10;
  else score += 0; // EXCELLENT
  
  // Loan performance component (0-40 points)
  if (loanPerformance.hasDefaults) score += 40;
  else if (loanPerformance.hasArrears) score += 25;
  else if (loanPerformance.status === "FAIR") score += 15;
  else score += 0; // GOOD or EXCELLENT
  
  // DTI component (0-30 points)
  if (dti > 0.5) score += 30; // >50% DTI
  else if (dti > 0.4) score += 20; // >40% DTI
  else if (dti > 0.3) score += 10; // >30% DTI
  else score += 0; // <30% DTI
  
  return Math.min(100, score);
}

/**
 * Calculate recommended interest rate based on risk score
 */
function calculateRecommendedRate(riskScore: number): number {
  const baseRate = 0.05; // 5% base rate
  const riskPremium = (riskScore / 100) * 0.10; // Up to 10% risk premium
  
  return baseRate + riskPremium;
}
