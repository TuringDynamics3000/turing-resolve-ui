/**
 * Lending Core v1 - Domain Errors
 * 
 * All lending invariant violations throw these errors.
 */

export class LoanInvariantViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoanInvariantViolation";
  }
}

export class IllegalLoanStateTransition extends LoanInvariantViolation {
  constructor(from: string, to: string, factType: string) {
    super(`Illegal loan state transition: ${from} → ${to} via ${factType}`);
    this.name = "IllegalLoanStateTransition";
  }
}

export class NegativePrincipalError extends LoanInvariantViolation {
  constructor(principal: bigint) {
    super(`Loan principal cannot be negative: ${principal}`);
    this.name = "NegativePrincipalError";
  }
}

export class PaymentBeforeActivationError extends LoanInvariantViolation {
  constructor(loanId: string) {
    super(`Cannot apply payment to loan ${loanId} before activation`);
    this.name = "PaymentBeforeActivationError";
  }
}

export class HardshipExitWithoutEntryError extends LoanInvariantViolation {
  constructor(loanId: string) {
    super(`Cannot exit hardship for loan ${loanId} without entering it first`);
    this.name = "HardshipExitWithoutEntryError";
  }
}

export class WriteOffActiveLoadError extends LoanInvariantViolation {
  constructor(loanId: string, state: string) {
    super(`Cannot write off loan ${loanId} in state ${state} - must be DEFAULT`);
    this.name = "WriteOffActiveLoadError";
  }
}

export class InvalidLoanTermsError extends LoanInvariantViolation {
  constructor(message: string) {
    super(`Invalid loan terms: ${message}`);
    this.name = "InvalidLoanTermsError";
  }
}
