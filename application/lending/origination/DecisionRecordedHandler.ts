/**
 * Loan Origination - Credit Decision Recorded Handler
 * 
 * Emits CREDIT_DECISION_RECORDED fact when credit decision is made.
 * 
 * CRITICAL: This records the decision (APPROVED/DECLINED/REVIEW) but does NOT
 * execute it. Execution happens in OfferIssuedHandler.
 */

import type { CreditDecisionRecordedFact } from "../../../core/lending";

export interface RecordCreditDecisionInput {
  loanId: string;
  decision: "APPROVED" | "DECLINED" | "REVIEW";
  riskScore: number;
  rationale: string;
  decidedBy: string; // Operator ID or "POLICY_ENGINE"
}

/**
 * Record credit decision
 * 
 * Emits: CREDIT_DECISION_RECORDED fact
 */
export async function recordCreditDecision(
  input: RecordCreditDecisionInput
): Promise<CreditDecisionRecordedFact> {
  const fact: CreditDecisionRecordedFact = {
    type: "CREDIT_DECISION_RECORDED",
    loanId: input.loanId,
    decision: input.decision,
    riskScore: input.riskScore,
    rationale: input.rationale,
    decidedBy: input.decidedBy,
    occurredAt: Date.now(),
  };
  
  // TODO: Persist fact to database
  
  return fact;
}
