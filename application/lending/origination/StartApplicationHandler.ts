/**
 * Loan Origination - Start Application Handler
 * 
 * Emits APPLICATION_STARTED fact when borrower begins loan application.
 * 
 * CRITICAL: This is a fact-based workflow, not a state machine.
 * Each step emits a fact. No implicit state transitions.
 */

import type { ApplicationStartedFact } from "../../../core/lending";

export interface StartApplicationInput {
  loanId: string;
  applicantAccountId: string;
}

/**
 * Start loan application
 * 
 * Emits: APPLICATION_STARTED fact
 */
export async function startApplication(
  input: StartApplicationInput
): Promise<ApplicationStartedFact> {
  const fact: ApplicationStartedFact = {
    type: "APPLICATION_STARTED",
    loanId: input.loanId,
    applicantAccountId: input.applicantAccountId,
    occurredAt: Date.now(),
  };
  
  // TODO: Persist fact to database
  // await db.insert(loanFacts).values({ loanId: fact.loanId, factData: fact, occurredAt: new Date(fact.occurredAt) });
  
  return fact;
}
