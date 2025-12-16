/**
 * Loan Origination - Submit Application Handler
 * 
 * Emits APPLICATION_SUBMITTED fact when borrower submits loan application.
 */

import type { ApplicationSubmittedFact } from "../../../core/lending";

export interface SubmitApplicationInput {
  loanId: string;
  requestedPrincipal: bigint;
  requestedTermMonths: number;
  purpose: string;
}

/**
 * Submit loan application
 * 
 * Emits: APPLICATION_SUBMITTED fact
 */
export async function submitApplication(
  input: SubmitApplicationInput
): Promise<ApplicationSubmittedFact> {
  const fact: ApplicationSubmittedFact = {
    type: "APPLICATION_SUBMITTED",
    loanId: input.loanId,
    requestedPrincipal: input.requestedPrincipal,
    requestedTermMonths: input.requestedTermMonths,
    purpose: input.purpose,
    occurredAt: Date.now(),
  };
  
  // TODO: Persist fact to database
  
  return fact;
}
