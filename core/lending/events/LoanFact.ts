/**
 * Lending Core v1 - Loan Facts
 * 
 * Authoritative, immutable facts representing loan lifecycle events.
 * All loan state changes are represented as facts.
 * Nothing is inferred. Nothing is implicit.
 */

export type LoanFact =
  | LoanOfferedFact
  | LoanAcceptedFact
  | LoanActivatedFact
  | LoanPaymentAppliedFact
  | InterestAccruedFact
  | FeeAppliedFact
  | LoanInArrearsFact
  | HardshipEnteredFact
  | HardshipExitedFact
  | LoanRestructuredFact
  | LoanDefaultedFact
  | LoanClosedFact
  | LoanWrittenOffFact;

export interface LoanOfferedFact {
  type: "LOAN_OFFERED";
  loanId: string;
  borrowerAccountId: string;
  principal: bigint;
  interestRate: number; // Annual percentage rate (e.g., 0.05 for 5%)
  termMonths: number;
  occurredAt: number; // Unix timestamp
}

export interface LoanAcceptedFact {
  type: "LOAN_ACCEPTED";
  loanId: string;
  occurredAt: number;
}

export interface LoanActivatedFact {
  type: "LOAN_ACTIVATED";
  loanId: string;
  disbursementAccountId: string; // Deposit account receiving funds
  occurredAt: number;
}

export interface LoanPaymentAppliedFact {
  type: "LOAN_PAYMENT_APPLIED";
  loanId: string;
  amount: bigint; // Amount applied to loan (principal + interest)
  principalPortion: bigint;
  interestPortion: bigint;
  occurredAt: number;
}

export interface InterestAccruedFact {
  type: "INTEREST_ACCRUED";
  loanId: string;
  amount: bigint;
  accrualPeriodStart: number;
  accrualPeriodEnd: number;
  occurredAt: number;
}

export interface FeeAppliedFact {
  type: "FEE_APPLIED";
  loanId: string;
  feeType: "LATE_FEE" | "RESTRUCTURE_FEE" | "EARLY_REPAYMENT_FEE" | "OTHER";
  amount: bigint;
  reason: string;
  occurredAt: number;
}

export interface LoanInArrearsFact {
  type: "LOAN_IN_ARREARS";
  loanId: string;
  daysPastDue: number;
  amountOverdue: bigint;
  occurredAt: number;
}

export interface HardshipEnteredFact {
  type: "HARDSHIP_ENTERED";
  loanId: string;
  reason: string;
  approvedBy: string; // Operator ID
  occurredAt: number;
}

export interface HardshipExitedFact {
  type: "HARDSHIP_EXITED";
  loanId: string;
  reason: string;
  occurredAt: number;
}

export interface LoanRestructuredFact {
  type: "LOAN_RESTRUCTURED";
  loanId: string;
  newInterestRate?: number;
  newTermMonths?: number;
  principalAdjustment?: bigint; // Positive = increase, negative = decrease
  reason: string;
  approvedBy: string;
  occurredAt: number;
}

export interface LoanDefaultedFact {
  type: "LOAN_DEFAULTED";
  loanId: string;
  daysPastDue: number;
  amountOutstanding: bigint;
  occurredAt: number;
}

export interface LoanClosedFact {
  type: "LOAN_CLOSED";
  loanId: string;
  finalPaymentAmount: bigint;
  occurredAt: number;
}

export interface LoanWrittenOffFact {
  type: "LOAN_WRITTEN_OFF";
  loanId: string;
  amountWrittenOff: bigint;
  reason: string;
  approvedBy: string;
  occurredAt: number;
}
