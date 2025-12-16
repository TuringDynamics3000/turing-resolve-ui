/**
 * Lending Core v1 - Loan Aggregate
 * 
 * Immutable loan entity. The only way to change loan state is via apply(fact).
 * 
 * Rules:
 * - No mutable balances
 * - No stored "outstanding amount"
 * - No stored schedule
 * - All state changes via facts
 */

import { LoanFact } from "../events/LoanFact";
import { LoanState } from "./LoanState";
import { applyLoanFact } from "../invariants/LoanInvariants";

export class Loan {
  readonly loanId: string;
  readonly borrowerAccountId: string;
  readonly principal: bigint;
  readonly interestRate: number;
  readonly termMonths: number;
  readonly state: LoanState;
  readonly disbursementAccountId?: string;
  readonly activatedAt?: number;
  readonly closedAt?: number;

  constructor(
    loanId: string,
    borrowerAccountId: string,
    principal: bigint,
    interestRate: number,
    termMonths: number,
    state: LoanState,
    disbursementAccountId?: string,
    activatedAt?: number,
    closedAt?: number
  ) {
    this.loanId = loanId;
    this.borrowerAccountId = borrowerAccountId;
    this.principal = principal;
    this.interestRate = interestRate;
    this.termMonths = termMonths;
    this.state = state;
    this.disbursementAccountId = disbursementAccountId;
    this.activatedAt = activatedAt;
    this.closedAt = closedAt;
  }

  /**
   * Apply a fact to this loan, returning a new Loan instance.
   * 
   * This is the ONLY way to change loan state.
   * Delegates to LoanInvariants.applyLoanFact() for enforcement.
   */
  apply(fact: LoanFact): Loan {
    return applyLoanFact(this, fact);
  }

  /**
   * Create a new loan from LOAN_OFFERED fact
   */
  static fromOfferedFact(fact: LoanFact): Loan {
    if (fact.type !== "LOAN_OFFERED") {
      throw new Error("Can only create loan from LOAN_OFFERED fact");
    }

    return new Loan(
      fact.loanId,
      fact.borrowerAccountId,
      fact.principal,
      fact.interestRate,
      fact.termMonths,
      "OFFERED"
    );
  }
}
