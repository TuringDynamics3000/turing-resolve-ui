/**
 * Application Layer - Accept Loan Handler
 * 
 * Handles borrower accepting a loan offer.
 * Emits LOAN_ACCEPTED fact.
 */

import { LoanAcceptedFact, Loan } from "../../core/lending";

export interface AcceptLoanCommand {
  loanId: string;
  acceptedBy: string; // Borrower ID
}

export interface AcceptLoanResult {
  loanId: string;
  fact: LoanAcceptedFact;
}

/**
 * Accept a loan offer.
 * 
 * Preconditions:
 * - Loan must be in OFFERED state
 * 
 * Emits: LOAN_ACCEPTED fact
 */
export async function acceptLoan(
  command: AcceptLoanCommand,
  currentLoan: Loan
): Promise<AcceptLoanResult> {
  // Validate loan is in OFFERED state
  if (currentLoan.state !== "OFFERED") {
    throw new Error(
      `Cannot accept loan ${command.loanId} in state ${currentLoan.state}`
    );
  }

  // Create LOAN_ACCEPTED fact
  const fact: LoanAcceptedFact = {
    type: "LOAN_ACCEPTED",
    loanId: command.loanId,
    occurredAt: Date.now(),
  };

  return {
    loanId: command.loanId,
    fact,
  };
}
