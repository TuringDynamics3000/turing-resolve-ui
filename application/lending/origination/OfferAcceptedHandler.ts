/**
 * Loan Origination - Offer Accepted Handler
 * 
 * Emits LOAN_OFFER_ACCEPTED fact when borrower accepts loan offer.
 */

import type { LoanOfferAcceptedFact } from "../../../core/lending";

export interface AcceptLoanOfferInput {
  loanId: string;
}

/**
 * Accept loan offer
 * 
 * Emits: LOAN_OFFER_ACCEPTED fact
 */
export async function acceptLoanOffer(
  input: AcceptLoanOfferInput
): Promise<LoanOfferAcceptedFact> {
  const now = Date.now();
  
  const fact: LoanOfferAcceptedFact = {
    type: "LOAN_OFFER_ACCEPTED",
    loanId: input.loanId,
    acceptedAt: now,
    occurredAt: now,
  };
  
  return fact;
}
