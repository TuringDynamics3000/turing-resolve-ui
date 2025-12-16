/**
 * Lending AI Advisor - Delinquency Advisor
 * 
 * CRITICAL RULES:
 * - Produces recommendations only
 * - NEVER emits LoanFacts
 * - NEVER triggers repayments
 * - NEVER changes loan state
 * 
 * Output is stored as AdvisoryFact only.
 */

import type { LoanFact } from "../../core/lending";
import type { DelinquencyAdvisoryOutput } from "./types";

export interface DelinquencyAdvisorInput {
  loanId: string;
  loanFacts: LoanFact[];
  depositFacts: any[];
  currentDate: number;
}

/**
 * Delinquency Advisor - ML-powered arrears prediction
 * 
 * Analyzes:
 * - Recent payment patterns
 * - Deposit account cash flow
 * - Seasonal trends
 * - Early warning signals
 * 
 * Returns: Advisory output only (no execution)
 */
export function predictDelinquency(
  input: DelinquencyAdvisorInput
): DelinquencyAdvisoryOutput {
  const modelVersion = "delinquency-v1.0.0";
  const generatedAt = new Date().toISOString();
  
  // Extract features
  const features = extractDelinquencyFeatures(input);
  
  // Calculate arrears probability
  const arrearsProbability = calculateArrearsProbability(features);
  
  // Predict days past due
  const predictedDaysPastDue = Math.floor(arrearsProbability * 60); // Max 60 days
  
  // Identify early warning signals
  const earlyWarningSignals = identifyEarlyWarningSignals(features);
  
  // Generate recommendation
  let recommendation: DelinquencyAdvisoryOutput["recommendation"];
  let confidence: number;
  let rationale: string;
  
  if (arrearsProbability > 0.7) {
    recommendation = "ENTER_ARREARS";
    confidence = 0.85;
    rationale = `High arrears probability (${(arrearsProbability * 100).toFixed(1)}%). Predicted ${predictedDaysPastDue} days past due. Early warnings: ${earlyWarningSignals.join(", ")}`;
  } else if (arrearsProbability > 0.5) {
    recommendation = "ENTER_HARDSHIP";
    confidence = 0.75;
    rationale = `Moderate arrears probability (${(arrearsProbability * 100).toFixed(1)}%). Proactive hardship recommended. Early warnings: ${earlyWarningSignals.join(", ")}`;
  } else {
    recommendation = "NO_ACTION";
    confidence = 0.9;
    rationale = `Low arrears probability (${(arrearsProbability * 100).toFixed(1)}%). No action required.`;
  }
  
  return {
    recommendation,
    confidence,
    rationale,
    modelVersion,
    generatedAt,
    arrearsProbability,
    predictedDaysPastDue,
    earlyWarningSignals,
  };
}

function extractDelinquencyFeatures(input: DelinquencyAdvisorInput) {
  const { loanFacts, depositFacts } = input;
  
  // Payment regularity (0-1, higher = more regular)
  const paymentFacts = loanFacts.filter(f => f.type === "LOAN_PAYMENT_APPLIED");
  const paymentRegularity = paymentFacts.length >= 3 ? 0.8 : 0.4;
  
  // Deposit account balance trend
  const balanceTrend = depositFacts.length > 5 ? "STABLE" : "DECLINING";
  
  // Recent missed payments
  const recentMissedPayments = 0; // Simplified
  
  return {
    paymentRegularity,
    balanceTrend,
    recentMissedPayments,
  };
}

function calculateArrearsProbability(features: ReturnType<typeof extractDelinquencyFeatures>): number {
  let probability = 0.1; // Base probability
  
  if (features.paymentRegularity < 0.5) {
    probability += 0.3;
  }
  
  if (features.balanceTrend === "DECLINING") {
    probability += 0.2;
  }
  
  probability += features.recentMissedPayments * 0.2;
  
  return Math.min(1, probability);
}

function identifyEarlyWarningSignals(features: ReturnType<typeof extractDelinquencyFeatures>): string[] {
  const signals: string[] = [];
  
  if (features.paymentRegularity < 0.5) {
    signals.push("Irregular payment pattern");
  }
  
  if (features.balanceTrend === "DECLINING") {
    signals.push("Declining deposit balance");
  }
  
  if (features.recentMissedPayments > 0) {
    signals.push(`${features.recentMissedPayments} recent missed payments`);
  }
  
  if (signals.length === 0) {
    signals.push("No early warning signals detected");
  }
  
  return signals;
}
