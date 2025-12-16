/**
 * Lending Core v1 - Loan Invariants
 * 
 * All invariants live in one place.
 * Invariant breach must throw.
 * 
 * Enforces:
 * - Legal state transitions
 * - Principal never negative
 * - Cannot apply repayment before activation
 * - Cannot exit hardship without entering it
 * - Cannot write off an active loan
 */

import { Loan } from "../aggregate/Loan";
import { LoanFact } from "../events/LoanFact";
import { LoanState } from "../aggregate/LoanState";
import {
  IllegalLoanStateTransition,
  NegativePrincipalError,
  PaymentBeforeActivationError,
  HardshipExitWithoutEntryError,
  WriteOffActiveLoadError,
} from "../errors/LoanErrors";

/**
 * Apply a fact to a loan, enforcing all invariants.
 * Returns a new Loan instance (immutable).
 */
export function applyLoanFact(loan: Loan, fact: LoanFact): Loan {
  // Route to specific handlers based on fact type
  switch (fact.type) {
    // Origination facts (pass-through, no state change)
    case "APPLICATION_STARTED":
    case "APPLICATION_SUBMITTED":
    case "CREDIT_DECISION_RECORDED":
    case "LOAN_OFFER_ISSUED":
    case "LOAN_OFFER_ACCEPTED":
    case "LOAN_OFFERED": // Legacy fact, replaced by LOAN_OFFER_ISSUED
      return loan; // Origination facts don't change loan state

    case "LOAN_ACCEPTED":
      return applyLoanAccepted(loan, fact);

    case "LOAN_ACTIVATED":
      return applyLoanActivated(loan, fact);

    case "LOAN_PAYMENT_APPLIED":
      return applyLoanPaymentApplied(loan, fact);

    case "INTEREST_ACCRUED":
      return applyInterestAccrued(loan, fact);

    case "FEE_APPLIED":
      return applyFeeApplied(loan, fact)

    case "LOAN_IN_ARREARS":
      return applyLoanInArrears(loan, fact);

    case "HARDSHIP_ENTERED":
      return applyHardshipEntered(loan, fact);

    case "HARDSHIP_EXITED":
      return applyHardshipExited(loan, fact);

    case "LOAN_RESTRUCTURED":
      return applyLoanRestructured(loan, fact);

    case "LOAN_DEFAULTED":
      return applyLoanDefaulted(loan, fact);

    case "LOAN_CLOSED":
      return applyLoanClosed(loan, fact);

    case "LOAN_WRITTEN_OFF":
      return applyLoanWrittenOff(loan, fact);

    default:
      const _exhaustive: never = fact;
      throw new Error(`Unknown fact type: ${(_exhaustive as any).type}`);
  }
}

function applyLoanAccepted(loan: Loan, fact: LoanFact): Loan {
  if (fact.type !== "LOAN_ACCEPTED") throw new Error("Invalid fact type");

  // Can only accept an OFFERED loan
  if (loan.state !== "OFFERED") {
    throw new IllegalLoanStateTransition(loan.state, "ACTIVE", fact.type);
  }

  return new Loan(
    loan.loanId,
    loan.borrowerAccountId,
    loan.principal,
    loan.interestRate,
    loan.termMonths,
    "ACTIVE", // Transition to ACTIVE
    loan.disbursementAccountId,
    loan.activatedAt,
    loan.closedAt
  );
}

function applyLoanActivated(loan: Loan, fact: LoanFact): Loan {
  if (fact.type !== "LOAN_ACTIVATED") throw new Error("Invalid fact type");

  // Can only activate an ACTIVE loan (after acceptance)
  if (loan.state !== "ACTIVE") {
    throw new IllegalLoanStateTransition(loan.state, "ACTIVE", fact.type);
  }

  return new Loan(
    loan.loanId,
    loan.borrowerAccountId,
    loan.principal,
    loan.interestRate,
    loan.termMonths,
    "ACTIVE",
    fact.disbursementAccountId,
    fact.occurredAt, // Record activation timestamp
    loan.closedAt
  );
}

function applyLoanPaymentApplied(loan: Loan, fact: LoanFact): Loan {
  if (fact.type !== "LOAN_PAYMENT_APPLIED") throw new Error("Invalid fact type");

  // Cannot apply payment before activation
  if (!loan.activatedAt) {
    throw new PaymentBeforeActivationError(loan.loanId);
  }

  // Can only apply payments to active, arrears, or hardship loans
  if (
    loan.state !== "ACTIVE" &&
    loan.state !== "IN_ARREARS" &&
    loan.state !== "HARDSHIP"
  ) {
    throw new IllegalLoanStateTransition(loan.state, loan.state, fact.type);
  }

  // Reduce principal by payment amount
  const newPrincipal = loan.principal - fact.amount;
  if (newPrincipal < 0n) {
    throw new NegativePrincipalError(newPrincipal);
  }

  // If principal is now zero, transition to CLOSED
  const newState = newPrincipal === 0n ? "CLOSED" : loan.state;

  return new Loan(
    loan.loanId,
    loan.borrowerAccountId,
    newPrincipal,
    loan.interestRate,
    loan.termMonths,
    newState,
    loan.disbursementAccountId,
    loan.activatedAt,
    newState === "CLOSED" ? fact.occurredAt : loan.closedAt
  );
}

function applyInterestAccrued(loan: Loan, fact: LoanFact): Loan {
  if (fact.type !== "INTEREST_ACCRUED") throw new Error("Invalid fact type");

  // Cannot accrue interest on closed or written-off loans
  if (loan.state === "CLOSED" || loan.state === "WRITTEN_OFF") {
    throw new IllegalLoanStateTransition(loan.state, loan.state, fact.type);
  }

  // Interest capitalizes to principal (increases outstanding balance)
  const newPrincipal = loan.principal + fact.amount;

  return new Loan(
    loan.loanId,
    loan.borrowerAccountId,
    newPrincipal,
    loan.interestRate,
    loan.termMonths,
    loan.state,
    loan.disbursementAccountId,
    loan.activatedAt,
    loan.closedAt
  );
}

function applyFeeApplied(loan: Loan, fact: LoanFact): Loan {
  if (fact.type !== "FEE_APPLIED") throw new Error("Invalid fact type");

  // Cannot apply fees to closed or written-off loans
  if (loan.state === "CLOSED" || loan.state === "WRITTEN_OFF") {
    throw new IllegalLoanStateTransition(loan.state, loan.state, fact.type);
  }

  // Fees capitalize to principal (increases outstanding balance)
  const newPrincipal = loan.principal + fact.amount;

  return new Loan(
    loan.loanId,
    loan.borrowerAccountId,
    newPrincipal,
    loan.interestRate,
    loan.termMonths,
    loan.state,
    loan.disbursementAccountId,
    loan.activatedAt,
    loan.closedAt
  );
}

function applyLoanInArrears(loan: Loan, fact: LoanFact): Loan {
  if (fact.type !== "LOAN_IN_ARREARS") throw new Error("Invalid fact type");

  // Can only go into arrears from ACTIVE state
  if (loan.state !== "ACTIVE") {
    throw new IllegalLoanStateTransition(loan.state, "IN_ARREARS", fact.type);
  }

  return new Loan(
    loan.loanId,
    loan.borrowerAccountId,
    loan.principal,
    loan.interestRate,
    loan.termMonths,
    "IN_ARREARS",
    loan.disbursementAccountId,
    loan.activatedAt,
    loan.closedAt
  );
}

function applyHardshipEntered(loan: Loan, fact: LoanFact): Loan {
  if (fact.type !== "HARDSHIP_ENTERED") throw new Error("Invalid fact type");

  // Can enter hardship from ACTIVE or IN_ARREARS
  if (loan.state !== "ACTIVE" && loan.state !== "IN_ARREARS") {
    throw new IllegalLoanStateTransition(loan.state, "HARDSHIP", fact.type);
  }

  return new Loan(
    loan.loanId,
    loan.borrowerAccountId,
    loan.principal,
    loan.interestRate,
    loan.termMonths,
    "HARDSHIP",
    loan.disbursementAccountId,
    loan.activatedAt,
    loan.closedAt
  );
}

function applyHardshipExited(loan: Loan, fact: LoanFact): Loan {
  if (fact.type !== "HARDSHIP_EXITED") throw new Error("Invalid fact type");

  // Can only exit hardship if currently in hardship
  if (loan.state !== "HARDSHIP") {
    throw new HardshipExitWithoutEntryError(loan.loanId);
  }

  // Exit to ACTIVE (good standing) by default
  // If still in arrears, a separate LOAN_IN_ARREARS fact will be emitted
  return new Loan(
    loan.loanId,
    loan.borrowerAccountId,
    loan.principal,
    loan.interestRate,
    loan.termMonths,
    "ACTIVE",
    loan.disbursementAccountId,
    loan.activatedAt,
    loan.closedAt
  );
}

function applyLoanRestructured(loan: Loan, fact: LoanFact): Loan {
  if (fact.type !== "LOAN_RESTRUCTURED") throw new Error("Invalid fact type");

  // Restructure updates terms but doesn't change state
  const newInterestRate = fact.newInterestRate ?? loan.interestRate;
  const newTermMonths = fact.newTermMonths ?? loan.termMonths;

  return new Loan(
    loan.loanId,
    loan.borrowerAccountId,
    loan.principal,
    newInterestRate,
    newTermMonths,
    loan.state,
    loan.disbursementAccountId,
    loan.activatedAt,
    loan.closedAt
  );
}

function applyLoanDefaulted(loan: Loan, fact: LoanFact): Loan {
  if (fact.type !== "LOAN_DEFAULTED") throw new Error("Invalid fact type");

  // Can only default from IN_ARREARS
  if (loan.state !== "IN_ARREARS") {
    throw new IllegalLoanStateTransition(loan.state, "DEFAULT", fact.type);
  }

  return new Loan(
    loan.loanId,
    loan.borrowerAccountId,
    loan.principal,
    loan.interestRate,
    loan.termMonths,
    "DEFAULT",
    loan.disbursementAccountId,
    loan.activatedAt,
    loan.closedAt
  );
}

function applyLoanClosed(loan: Loan, fact: LoanFact): Loan {
  if (fact.type !== "LOAN_CLOSED") throw new Error("Invalid fact type");

  // CRITICAL INVARIANT: Cannot close loan with outstanding principal
  if (loan.principal !== 0n) {
    throw new Error(`INVARIANT_BREACH: CLOSING_WITH_BALANCE (principal: ${loan.principal})`);
  }

  // Can only close from ACTIVE state (fully repaid)
  if (loan.state !== "ACTIVE") {
    throw new IllegalLoanStateTransition(loan.state, "CLOSED", fact.type);
  }

  return new Loan(
    loan.loanId,
    loan.borrowerAccountId,
    0n, // Principal is zero
    loan.interestRate,
    loan.termMonths,
    "CLOSED",
    loan.disbursementAccountId,
    loan.activatedAt,
    fact.occurredAt // Record closure timestamp
  );
}

function applyLoanWrittenOff(loan: Loan, fact: LoanFact): Loan {
  if (fact.type !== "LOAN_WRITTEN_OFF") throw new Error("Invalid fact type");

  // Can only write off from DEFAULT state
  if (loan.state !== "DEFAULT") {
    throw new WriteOffActiveLoadError(loan.loanId, loan.state);
  }

  // Write-off sets principal to zero (debt forgiven)
  return new Loan(
    loan.loanId,
    loan.borrowerAccountId,
    0n, // Principal written off
    loan.interestRate,
    loan.termMonths,
    "WRITTEN_OFF",
    loan.disbursementAccountId,
    loan.activatedAt,
    fact.occurredAt
  );
}

/**
 * Validate principal is never negative
 */
export function validatePrincipal(principal: bigint): void {
  if (principal < 0n) {
    throw new NegativePrincipalError(principal);
  }
}
