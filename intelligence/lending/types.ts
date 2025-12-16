/**
 * Lending AI Advisory - Type Definitions
 * 
 * CRITICAL RULES:
 * - AI advisors produce recommendations only
 * - AI advisors NEVER emit LoanFacts
 * - AI advisors NEVER trigger repayments
 * - AI advisors NEVER change loan state
 * - AI advisors NEVER bypass human or policy gates
 * 
 * Output is stored as AdvisoryFact only.
 */

export type LendingAdvisoryOutput = {
  recommendation:
    | "NO_ACTION"
    | "ENTER_ARREARS"
    | "ENTER_HARDSHIP"
    | "RESTRUCTURE"
    | "WRITE_OFF_REVIEW";
  confidence: number; // 0-1
  rationale: string;
  modelVersion: string;
  generatedAt: string; // ISO 8601
  metadata?: Record<string, unknown>;
};

export interface CreditRiskAdvisoryOutput extends LendingAdvisoryOutput {
  defaultProbability: number; // 0-1
  riskScore: number; // 0-100
  riskFactors: string[];
}

export interface DelinquencyAdvisoryOutput extends LendingAdvisoryOutput {
  arrearsProbability: number; // 0-1
  predictedDaysPastDue: number;
  earlyWarningSignals: string[];
}

export interface RestructureAdvisoryOutput extends LendingAdvisoryOutput {
  suggestedTerms: {
    newInterestRate?: number;
    newTermMonths?: number;
    hardshipType?: "PAYMENT_PAUSE" | "REDUCED_PAYMENTS" | "INTEREST_ONLY";
  };
  estimatedRecoveryRate: number; // 0-1
}
