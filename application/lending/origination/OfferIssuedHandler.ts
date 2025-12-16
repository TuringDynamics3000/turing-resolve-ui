/**
 * Loan Origination - Offer Issued Handler
 * 
 * Emits LOAN_OFFER_ISSUED fact when loan offer is issued to borrower.
 */

import type { LoanOfferIssuedFact } from "../../../core/lending";

export interface IssueLoanOfferInput {
  loanId: string;
  offeredPrincipal: bigint;
  offeredInterestRate: number;
  offeredTermMonths: number;
  conditions: string[];
  expiresInDays: number; // Offer validity period
}

/**
 * Issue loan offer
 * 
 * Emits: LOAN_OFFER_ISSUED fact
 */
export async function issueLoanOffer(
  input: IssueLoanOfferInput
): Promise<LoanOfferIssuedFact> {
  const expiresAt = Date.now() + (input.expiresInDays * 24 * 60 * 60 * 1000);
  
  const fact: LoanOfferIssuedFact = {
    type: "LOAN_OFFER_ISSUED",
    loanId: input.loanId,
    offeredPrincipal: input.offeredPrincipal,
    offeredInterestRate: input.offeredInterestRate,
    offeredTermMonths: input.offeredTermMonths,
    conditions: input.conditions,
    expiresAt,
    occurredAt: Date.now(),
  };
  
  // TODO: Persist fact to database
  
  return fact;
}
