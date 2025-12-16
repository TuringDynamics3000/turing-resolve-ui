/**
 * Application Layer - Offer Loan Handler
 * 
 * Handles loan origination (offer creation).
 * Emits LOAN_OFFERED fact.
 */

import { LoanOfferedFact } from "../../core/lending";
import { validatePrincipal } from "../../core/lending";
import { InvalidLoanTermsError } from "../../core/lending";

export interface OfferLoanCommand {
  loanId: string;
  borrowerAccountId: string;
  principal: bigint;
  interestRate: number; // Annual percentage rate (e.g., 0.05 for 5%)
  termMonths: number;
  requestedBy: string; // Operator ID
}

export interface OfferLoanResult {
  loanId: string;
  fact: LoanOfferedFact;
}

/**
 * Offer a loan to a borrower.
 * 
 * Validates:
 * - Principal is positive
 * - Interest rate is valid (0-100%)
 * - Term is positive
 * 
 * Emits: LOAN_OFFERED fact
 */
export async function offerLoan(
  command: OfferLoanCommand
): Promise<OfferLoanResult> {
  // Validate principal
  validatePrincipal(command.principal);

  if (command.principal === 0n) {
    throw new InvalidLoanTermsError("Principal must be greater than zero");
  }

  // Validate interest rate (0-100%)
  if (command.interestRate < 0 || command.interestRate > 1) {
    throw new InvalidLoanTermsError(
      `Interest rate must be between 0 and 1, got ${command.interestRate}`
    );
  }

  // Validate term
  if (command.termMonths <= 0) {
    throw new InvalidLoanTermsError(
      `Term must be positive, got ${command.termMonths}`
    );
  }

  // Create LOAN_OFFERED fact
  const fact: LoanOfferedFact = {
    type: "LOAN_OFFERED",
    loanId: command.loanId,
    borrowerAccountId: command.borrowerAccountId,
    principal: command.principal,
    interestRate: command.interestRate,
    termMonths: command.termMonths,
    occurredAt: Date.now(),
  };

  return {
    loanId: command.loanId,
    fact,
  };
}
