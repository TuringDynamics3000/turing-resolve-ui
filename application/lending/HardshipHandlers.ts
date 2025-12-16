/**
 * Application Layer - Hardship Handlers
 * 
 * Handles hardship entry/exit and loan closure.
 */

import {
  HardshipEnteredFact,
  HardshipExitedFact,
  LoanClosedFact,
  Loan,
} from "../../core/lending";

export interface EnterHardshipCommand {
  loanId: string;
  reason: string;
  approvedBy: string; // Operator ID
}

export interface EnterHardshipResult {
  loanId: string;
  fact: HardshipEnteredFact;
}

/**
 * Enter hardship arrangement.
 * 
 * Preconditions:
 * - Loan must be ACTIVE or IN_ARREARS
 * 
 * Emits: HARDSHIP_ENTERED fact
 */
export async function enterHardship(
  command: EnterHardshipCommand,
  currentLoan: Loan
): Promise<EnterHardshipResult> {
  // Validate loan can enter hardship
  if (currentLoan.state !== "ACTIVE" && currentLoan.state !== "IN_ARREARS") {
    throw new Error(
      `Cannot enter hardship for loan ${command.loanId} in state ${currentLoan.state}`
    );
  }

  const fact: HardshipEnteredFact = {
    type: "HARDSHIP_ENTERED",
    loanId: command.loanId,
    reason: command.reason,
    approvedBy: command.approvedBy,
    occurredAt: Date.now(),
  };

  return {
    loanId: command.loanId,
    fact,
  };
}

export interface ExitHardshipCommand {
  loanId: string;
  reason: string;
}

export interface ExitHardshipResult {
  loanId: string;
  fact: HardshipExitedFact;
}

/**
 * Exit hardship arrangement.
 * 
 * Preconditions:
 * - Loan must be in HARDSHIP state
 * 
 * Emits: HARDSHIP_EXITED fact
 */
export async function exitHardship(
  command: ExitHardshipCommand,
  currentLoan: Loan
): Promise<ExitHardshipResult> {
  // Validate loan is in hardship
  if (currentLoan.state !== "HARDSHIP") {
    throw new Error(
      `Cannot exit hardship for loan ${command.loanId} - not in hardship state`
    );
  }

  const fact: HardshipExitedFact = {
    type: "HARDSHIP_EXITED",
    loanId: command.loanId,
    reason: command.reason,
    occurredAt: Date.now(),
  };

  return {
    loanId: command.loanId,
    fact,
  };
}

export interface CloseLoanCommand {
  loanId: string;
  finalPaymentAmount: bigint;
  closedBy: string; // Operator or system ID
}

export interface CloseLoanResult {
  loanId: string;
  fact: LoanClosedFact;
}

/**
 * Close a loan (fully repaid).
 * 
 * Preconditions:
 * - Loan must be ACTIVE
 * - Loan must be fully repaid (validated externally)
 * 
 * Emits: LOAN_CLOSED fact
 */
export async function closeLoan(
  command: CloseLoanCommand,
  currentLoan: Loan
): Promise<CloseLoanResult> {
  // Validate loan can be closed
  if (currentLoan.state !== "ACTIVE") {
    throw new Error(
      `Cannot close loan ${command.loanId} in state ${currentLoan.state}`
    );
  }

  const fact: LoanClosedFact = {
    type: "LOAN_CLOSED",
    loanId: command.loanId,
    finalPaymentAmount: command.finalPaymentAmount,
    occurredAt: Date.now(),
  };

  return {
    loanId: command.loanId,
    fact,
  };
}
