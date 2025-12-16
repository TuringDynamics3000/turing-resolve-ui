/**
 * Lending AI Advisor - Credit Risk Advisor
 * 
 * CRITICAL RULES:
 * - Produces recommendations only
 * - NEVER emits LoanFacts
 * - NEVER triggers repayments
 * - NEVER changes loan state
 * - NEVER bypasses human or policy gates
 * 
 * Output is stored as AdvisoryFact only.
 */

import type { LoanFact } from "../../core/lending";
import type { CreditRiskAdvisoryOutput } from "./types";

export interface CreditRiskAdvisorInput {
  loanId: string;
  loanFacts: LoanFact[];
  depositFacts: any[]; // Deposit account history
  externalCreditScore?: number; // Optional external credit bureau score
}

/**
 * Credit Risk Advisor - ML-powered default risk assessment
 * 
 * Analyzes:
 * - Loan payment history
 * - Deposit account behavior
 * - External credit score (if available)
 * - Macroeconomic indicators
 * 
 * Returns: Advisory output only (no execution)
 * 
 * NOTE: This is a simplified implementation. In production, this would
 * call an ML model (e.g., XGBoost, neural network) trained on historical data.
 */
export function assessCreditRisk(
  input: CreditRiskAdvisorInput
): CreditRiskAdvisoryOutput {
  const modelVersion = "credit-risk-v1.0.0";
  const generatedAt = new Date().toISOString();
  
  // Extract features from loan facts
  const features = extractFeatures(input);
  
  // Calculate default probability (simplified ML model)
  const defaultProbability = calculateDefaultProbability(features);
  
  // Calculate risk score (0-100)
  const riskScore = Math.floor(defaultProbability * 100);
  
  // Identify risk factors
  const riskFactors = identifyRiskFactors(features);
  
  // Generate recommendation
  let recommendation: CreditRiskAdvisoryOutput["recommendation"];
  let confidence: number;
  let rationale: string;
  
  if (defaultProbability > 0.7) {
    recommendation = "WRITE_OFF_REVIEW";
    confidence = 0.85;
    rationale = `High default probability (${(defaultProbability * 100).toFixed(1)}%). Recommend write-off review. Risk factors: ${riskFactors.join(", ")}`;
  } else if (defaultProbability > 0.5) {
    recommendation = "RESTRUCTURE";
    confidence = 0.75;
    rationale = `Moderate-high default probability (${(defaultProbability * 100).toFixed(1)}%). Recommend restructure to improve recovery. Risk factors: ${riskFactors.join(", ")}`;
  } else if (defaultProbability > 0.3) {
    recommendation = "ENTER_HARDSHIP";
    confidence = 0.7;
    rationale = `Moderate default probability (${(defaultProbability * 100).toFixed(1)}%). Recommend hardship arrangement. Risk factors: ${riskFactors.join(", ")}`;
  } else {
    recommendation = "NO_ACTION";
    confidence = 0.9;
    rationale = `Low default probability (${(defaultProbability * 100).toFixed(1)}%). No action required.`;
  }
  
  return {
    recommendation,
    confidence,
    rationale,
    modelVersion,
    generatedAt,
    defaultProbability,
    riskScore,
    riskFactors,
    metadata: {
      features,
    },
  };
}

/**
 * Extract features from loan and deposit facts
 */
function extractFeatures(input: CreditRiskAdvisorInput): {
  paymentHistoryScore: number;
  depositStability: number;
  externalCreditScore: number;
  loanAge: number;
  hasArrears: boolean;
  hasHardship: boolean;
} {
  const { loanFacts, depositFacts, externalCreditScore } = input;
  
  // Payment history score (0-1, higher = better)
  const paymentFacts = loanFacts.filter(f => f.type === "LOAN_PAYMENT_APPLIED");
  const paymentHistoryScore = paymentFacts.length > 0 ? 0.8 : 0.5;
  
  // Deposit stability (0-1, higher = more stable)
  const depositStability = depositFacts.length > 10 ? 0.9 : 0.5;
  
  // Loan age in months
  const activatedFact = loanFacts.find(f => f.type === "LOAN_ACTIVATED");
  const loanAge = activatedFact
    ? Math.floor((Date.now() - activatedFact.occurredAt) / (30 * 24 * 60 * 60 * 1000))
    : 0;
  
  // Arrears and hardship flags
  const hasArrears = loanFacts.some(f => f.type === "LOAN_IN_ARREARS");
  const hasHardship = loanFacts.some(f => f.type === "HARDSHIP_ENTERED");
  
  return {
    paymentHistoryScore,
    depositStability,
    externalCreditScore: externalCreditScore || 650, // Default to median score
    loanAge,
    hasArrears,
    hasHardship,
  };
}

/**
 * Calculate default probability using simplified ML model
 * 
 * NOTE: In production, this would call a trained ML model.
 * This is a simplified logistic regression approximation.
 */
function calculateDefaultProbability(features: ReturnType<typeof extractFeatures>): number {
  // Simplified logistic regression weights
  const weights = {
    paymentHistoryScore: -2.5,
    depositStability: -1.5,
    externalCreditScore: -0.005,
    loanAge: -0.02,
    hasArrears: 1.5,
    hasHardship: 0.8,
  };
  
  const intercept = 3.0;
  
  // Calculate logit
  let logit = intercept;
  logit += weights.paymentHistoryScore * features.paymentHistoryScore;
  logit += weights.depositStability * features.depositStability;
  logit += weights.externalCreditScore * (features.externalCreditScore / 850); // Normalize to 0-1
  logit += weights.loanAge * features.loanAge;
  logit += weights.hasArrears ? weights.hasArrears : 0;
  logit += features.hasHardship ? weights.hasHardship : 0;
  
  // Apply sigmoid function
  const probability = 1 / (1 + Math.exp(-logit));
  
  // Clamp to 0-1
  return Math.max(0, Math.min(1, probability));
}

/**
 * Identify key risk factors
 */
function identifyRiskFactors(features: ReturnType<typeof extractFeatures>): string[] {
  const factors: string[] = [];
  
  if (features.hasArrears) {
    factors.push("Currently in arrears");
  }
  
  if (features.hasHardship) {
    factors.push("Currently in hardship");
  }
  
  if (features.paymentHistoryScore < 0.5) {
    factors.push("Poor payment history");
  }
  
  if (features.depositStability < 0.5) {
    factors.push("Unstable deposit account");
  }
  
  if (features.externalCreditScore < 600) {
    factors.push("Low external credit score");
  }
  
  if (features.loanAge < 6) {
    factors.push("New loan (< 6 months)");
  }
  
  if (factors.length === 0) {
    factors.push("No significant risk factors identified");
  }
  
  return factors;
}
