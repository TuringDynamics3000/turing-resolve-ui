/**
 * Application Layer - Apply Repayment Handler
 * 
 * Handles loan repayment application.
 * Emits LOAN_PAYMENT_APPLIED fact.
 * 
 * CRITICAL: Repayments flow via Deposits Core.
 * This handler is triggered AFTER the deposit debit is applied.
 */

import { LoanPaymentAppliedFact, Loan } from "../../core/lending";

export interface ApplyRepaymentCommand {
  loanId: string;
  amount: bigint;
  principalPortion: bigint;
  interestPortion: bigint;
  appliedBy: string; // System or operator ID
}

export interface ApplyRepaymentResult {
  loanId: string;
  fact: LoanPaymentAppliedFact;
}

/**
 * Apply a repayment to a loan.
 * 
 * Preconditions:
 * - Loan must be activated
 * - Deposit debit must have already occurred
 * - Amount = principalPortion + interestPortion
 * 
 * Emits: LOAN_PAYMENT_APPLIED fact
 */
export async function applyRepayment(
  command: ApplyRepaymentCommand,
  currentLoan: Loan
): Promise<ApplyRepaymentResult> {
  // Validate loan is activated
  if (!currentLoan.activatedAt) {
    throw new Error(
      `Cannot apply repayment to loan ${command.loanId} before activation`
    );
  }

  // Validate loan is not closed or written off
  if (currentLoan.state === "CLOSED" || currentLoan.state === "WRITTEN_OFF") {
    throw new Error(
      `Cannot apply repayment to loan ${command.loanId} in state ${currentLoan.state}`
    );
  }

  // Validate amount breakdown
  if (command.amount !== command.principalPortion + command.interestPortion) {
    throw new Error(
      `Amount mismatch: ${command.amount} !== ${command.principalPortion} + ${command.interestPortion}`
    );
  }

  // Create LOAN_PAYMENT_APPLIED fact
  const fact: LoanPaymentAppliedFact = {
    type: "LOAN_PAYMENT_APPLIED",
    loanId: command.loanId,
    amount: command.amount,
    principalPortion: command.principalPortion,
    interestPortion: command.interestPortion,
    occurredAt: Date.now(),
  };

  return {
    loanId: command.loanId,
    fact,
  };
}
