/**
 * Application Layer - Activate Loan Handler
 * 
 * Handles loan activation (disbursement).
 * Emits LOAN_ACTIVATED fact.
 * 
 * CRITICAL: This handler coordinates with Deposits Core to credit the borrower's account.
 */

import { LoanActivatedFact, Loan } from "../../core/lending";

export interface ActivateLoanCommand {
  loanId: string;
  disbursementAccountId: string; // Deposit account to credit
  activatedBy: string; // Operator ID
}

export interface ActivateLoanResult {
  loanId: string;
  fact: LoanActivatedFact;
  depositCreditRequired: {
    accountId: string;
    amount: bigint;
    reference: string;
  };
}

/**
 * Activate a loan (disburse funds).
 * 
 * Preconditions:
 * - Loan must be in ACTIVE state (after acceptance)
 * - Disbursement account must exist
 * 
 * Emits: LOAN_ACTIVATED fact
 * Side effect: Deposits Core must credit borrower account
 */
export async function activateLoan(
  command: ActivateLoanCommand,
  currentLoan: Loan
): Promise<ActivateLoanResult> {
  // Validate loan is in ACTIVE state (after acceptance, before activation)
  if (currentLoan.state !== "ACTIVE") {
    throw new Error(
      `Cannot activate loan ${command.loanId} in state ${currentLoan.state}`
    );
  }

  // Validate loan hasn't already been activated
  if (currentLoan.activatedAt) {
    throw new Error(`Loan ${command.loanId} has already been activated`);
  }

  // Create LOAN_ACTIVATED fact
  const fact: LoanActivatedFact = {
    type: "LOAN_ACTIVATED",
    loanId: command.loanId,
    disbursementAccountId: command.disbursementAccountId,
    occurredAt: Date.now(),
  };

  return {
    loanId: command.loanId,
    fact,
    depositCreditRequired: {
      accountId: command.disbursementAccountId,
      amount: currentLoan.principal,
      reference: `Loan disbursement: ${command.loanId}`,
    },
  };
}
