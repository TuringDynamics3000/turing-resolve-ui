/**
 * Lending Core v1 - Test Suite
 * 
 * Tests:
 * - Invariant enforcement (state transitions, principal validation)
 * - Deterministic replay
 * - Fact-based state reconstruction
 * - Hardship/restructure flows
 */

import { describe, it, expect } from "vitest";
import {
  Loan,
  rebuildFromFacts,
  applyLoanFact,
  IllegalLoanStateTransition,
  NegativePrincipalError,
  PaymentBeforeActivationError,
  HardshipExitWithoutEntryError,
  WriteOffActiveLoadError,
  type LoanFact,
} from "../core/lending";

describe("Lending Core v1", () => {
  describe("Loan Aggregate", () => {
    it("creates a loan from LOAN_OFFERED fact", () => {
      const fact: LoanFact = {
        type: "LOAN_OFFERED",
        loanId: "LOAN-001",
        borrowerAccountId: "ACC-001",
        principal: BigInt(100000),
        interestRate: 0.05,
        termMonths: 360,
        occurredAt: Date.now(),
      };

      const loan = Loan.fromOfferedFact(fact);

      expect(loan.loanId).toBe("LOAN-001");
      expect(loan.borrowerAccountId).toBe("ACC-001");
      expect(loan.principal).toBe(BigInt(100000));
      expect(loan.interestRate).toBe(0.05);
      expect(loan.termMonths).toBe(360);
      expect(loan.state).toBe("OFFERED");
    });

    it("transitions from OFFERED to ACTIVE on acceptance", () => {
      const offeredFact: LoanFact = {
        type: "LOAN_OFFERED",
        loanId: "LOAN-001",
        borrowerAccountId: "ACC-001",
        principal: BigInt(100000),
        interestRate: 0.05,
        termMonths: 360,
        occurredAt: Date.now(),
      };

      const acceptedFact: LoanFact = {
        type: "LOAN_ACCEPTED",
        loanId: "LOAN-001",
        occurredAt: Date.now(),
      };

      const loan = Loan.fromOfferedFact(offeredFact).apply(acceptedFact);

      expect(loan.state).toBe("ACTIVE");
    });

    it("records activation timestamp on LOAN_ACTIVATED", () => {
      const facts: LoanFact[] = [
        {
          type: "LOAN_OFFERED",
          loanId: "LOAN-001",
          borrowerAccountId: "ACC-001",
          principal: BigInt(100000),
          interestRate: 0.05,
          termMonths: 360,
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_ACCEPTED",
          loanId: "LOAN-001",
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_ACTIVATED",
          loanId: "LOAN-001",
          disbursementAccountId: "ACC-001",
          occurredAt: 1700000000000,
        },
      ];

      const loan = rebuildFromFacts(facts);

      expect(loan.activatedAt).toBe(1700000000000);
      expect(loan.disbursementAccountId).toBe("ACC-001");
    });
  });

  describe("State Transitions", () => {
    it("allows ACTIVE → IN_ARREARS transition", () => {
      const facts: LoanFact[] = [
        {
          type: "LOAN_OFFERED",
          loanId: "LOAN-001",
          borrowerAccountId: "ACC-001",
          principal: BigInt(100000),
          interestRate: 0.05,
          termMonths: 360,
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_ACCEPTED",
          loanId: "LOAN-001",
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_ACTIVATED",
          loanId: "LOAN-001",
          disbursementAccountId: "ACC-001",
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_IN_ARREARS",
          loanId: "LOAN-001",
          daysPastDue: 30,
          amountOverdue: BigInt(5000),
          occurredAt: Date.now(),
        },
      ];

      const loan = rebuildFromFacts(facts);

      expect(loan.state).toBe("IN_ARREARS");
    });

    it("allows IN_ARREARS → DEFAULT transition", () => {
      const facts: LoanFact[] = [
        {
          type: "LOAN_OFFERED",
          loanId: "LOAN-001",
          borrowerAccountId: "ACC-001",
          principal: BigInt(100000),
          interestRate: 0.05,
          termMonths: 360,
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_ACCEPTED",
          loanId: "LOAN-001",
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_ACTIVATED",
          loanId: "LOAN-001",
          disbursementAccountId: "ACC-001",
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_IN_ARREARS",
          loanId: "LOAN-001",
          daysPastDue: 30,
          amountOverdue: BigInt(5000),
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_DEFAULTED",
          loanId: "LOAN-001",
          daysPastDue: 90,
          amountOutstanding: BigInt(95000),
          occurredAt: Date.now(),
        },
      ];

      const loan = rebuildFromFacts(facts);

      expect(loan.state).toBe("DEFAULT");
    });

    it("allows DEFAULT → WRITTEN_OFF transition", () => {
      const facts: LoanFact[] = [
        {
          type: "LOAN_OFFERED",
          loanId: "LOAN-001",
          borrowerAccountId: "ACC-001",
          principal: BigInt(100000),
          interestRate: 0.05,
          termMonths: 360,
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_ACCEPTED",
          loanId: "LOAN-001",
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_ACTIVATED",
          loanId: "LOAN-001",
          disbursementAccountId: "ACC-001",
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_IN_ARREARS",
          loanId: "LOAN-001",
          daysPastDue: 30,
          amountOverdue: BigInt(5000),
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_DEFAULTED",
          loanId: "LOAN-001",
          daysPastDue: 90,
          amountOutstanding: BigInt(95000),
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_WRITTEN_OFF",
          loanId: "LOAN-001",
          amountWrittenOff: BigInt(95000),
          reason: "Uncollectible",
          approvedBy: "OPS-001",
          occurredAt: Date.now(),
        },
      ];

      const loan = rebuildFromFacts(facts);

      expect(loan.state).toBe("WRITTEN_OFF");
    });

    it("allows ACTIVE → CLOSED transition", () => {
      const facts: LoanFact[] = [
        {
          type: "LOAN_OFFERED",
          loanId: "LOAN-001",
          borrowerAccountId: "ACC-001",
          principal: BigInt(100000),
          interestRate: 0.05,
          termMonths: 360,
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_ACCEPTED",
          loanId: "LOAN-001",
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_ACTIVATED",
          loanId: "LOAN-001",
          disbursementAccountId: "ACC-001",
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_PAYMENT_APPLIED",
          loanId: "LOAN-001",
          amount: BigInt(100000), // Pay off entire principal
          principalPortion: BigInt(100000),
          interestPortion: BigInt(0),
          occurredAt: Date.now(),
        },
      ];

      const loan = rebuildFromFacts(facts);

      // Payment that reduces principal to zero auto-transitions to CLOSED
      expect(loan.state).toBe("CLOSED");
      expect(loan.principal).toBe(BigInt(0));
    });

    it("rejects illegal OFFERED → IN_ARREARS transition", () => {
      const loan = Loan.fromOfferedFact({
        type: "LOAN_OFFERED",
        loanId: "LOAN-001",
        borrowerAccountId: "ACC-001",
        principal: BigInt(100000),
        interestRate: 0.05,
        termMonths: 360,
        occurredAt: Date.now(),
      });

      expect(() =>
        loan.apply({
          type: "LOAN_IN_ARREARS",
          loanId: "LOAN-001",
          daysPastDue: 30,
          amountOverdue: BigInt(5000),
          occurredAt: Date.now(),
        })
      ).toThrow(IllegalLoanStateTransition);
    });

    it("rejects write-off of non-DEFAULT loan", () => {
      const loan = Loan.fromOfferedFact({
        type: "LOAN_OFFERED",
        loanId: "LOAN-001",
        borrowerAccountId: "ACC-001",
        principal: BigInt(100000),
        interestRate: 0.05,
        termMonths: 360,
        occurredAt: Date.now(),
      }).apply({
        type: "LOAN_ACCEPTED",
        loanId: "LOAN-001",
        occurredAt: Date.now(),
      });

      expect(() =>
        loan.apply({
          type: "LOAN_WRITTEN_OFF",
          loanId: "LOAN-001",
          amountWrittenOff: BigInt(100000),
          reason: "Test",
          approvedBy: "OPS-001",
          occurredAt: Date.now(),
        })
      ).toThrow(WriteOffActiveLoadError);
    });
  });

  describe("Hardship Flows", () => {
    it("allows ACTIVE → HARDSHIP → ACTIVE transition", () => {
      const facts: LoanFact[] = [
        {
          type: "LOAN_OFFERED",
          loanId: "LOAN-001",
          borrowerAccountId: "ACC-001",
          principal: BigInt(100000),
          interestRate: 0.05,
          termMonths: 360,
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_ACCEPTED",
          loanId: "LOAN-001",
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_ACTIVATED",
          loanId: "LOAN-001",
          disbursementAccountId: "ACC-001",
          occurredAt: Date.now(),
        },
        {
          type: "HARDSHIP_ENTERED",
          loanId: "LOAN-001",
          reason: "Job loss",
          approvedBy: "OPS-001",
          occurredAt: Date.now(),
        },
        {
          type: "HARDSHIP_EXITED",
          loanId: "LOAN-001",
          reason: "Employment resumed",
          occurredAt: Date.now(),
        },
      ];

      const loan = rebuildFromFacts(facts);

      expect(loan.state).toBe("ACTIVE");
    });

    it("allows IN_ARREARS → HARDSHIP transition", () => {
      const facts: LoanFact[] = [
        {
          type: "LOAN_OFFERED",
          loanId: "LOAN-001",
          borrowerAccountId: "ACC-001",
          principal: BigInt(100000),
          interestRate: 0.05,
          termMonths: 360,
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_ACCEPTED",
          loanId: "LOAN-001",
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_ACTIVATED",
          loanId: "LOAN-001",
          disbursementAccountId: "ACC-001",
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_IN_ARREARS",
          loanId: "LOAN-001",
          daysPastDue: 15,
          amountOverdue: BigInt(2000),
          occurredAt: Date.now(),
        },
        {
          type: "HARDSHIP_ENTERED",
          loanId: "LOAN-001",
          reason: "Medical emergency",
          approvedBy: "OPS-001",
          occurredAt: Date.now(),
        },
      ];

      const loan = rebuildFromFacts(facts);

      expect(loan.state).toBe("HARDSHIP");
    });

    it("rejects hardship exit without entry", () => {
      const loan = Loan.fromOfferedFact({
        type: "LOAN_OFFERED",
        loanId: "LOAN-001",
        borrowerAccountId: "ACC-001",
        principal: BigInt(100000),
        interestRate: 0.05,
        termMonths: 360,
        occurredAt: Date.now(),
      })
        .apply({
          type: "LOAN_ACCEPTED",
          loanId: "LOAN-001",
          occurredAt: Date.now(),
        })
        .apply({
          type: "LOAN_ACTIVATED",
          loanId: "LOAN-001",
          disbursementAccountId: "ACC-001",
          occurredAt: Date.now(),
        });

      expect(() =>
        loan.apply({
          type: "HARDSHIP_EXITED",
          loanId: "LOAN-001",
          reason: "Test",
          occurredAt: Date.now(),
        })
      ).toThrow(HardshipExitWithoutEntryError);
    });
  });

  describe("Loan Restructure", () => {
    it("updates interest rate on restructure", () => {
      const facts: LoanFact[] = [
        {
          type: "LOAN_OFFERED",
          loanId: "LOAN-001",
          borrowerAccountId: "ACC-001",
          principal: BigInt(100000),
          interestRate: 0.05,
          termMonths: 360,
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_ACCEPTED",
          loanId: "LOAN-001",
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_ACTIVATED",
          loanId: "LOAN-001",
          disbursementAccountId: "ACC-001",
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_RESTRUCTURED",
          loanId: "LOAN-001",
          newInterestRate: 0.03,
          reason: "Hardship arrangement",
          approvedBy: "OPS-001",
          occurredAt: Date.now(),
        },
      ];

      const loan = rebuildFromFacts(facts);

      expect(loan.interestRate).toBe(0.03);
      expect(loan.state).toBe("ACTIVE"); // Restructure doesn't change state
    });

    it("updates term on restructure", () => {
      const facts: LoanFact[] = [
        {
          type: "LOAN_OFFERED",
          loanId: "LOAN-001",
          borrowerAccountId: "ACC-001",
          principal: BigInt(100000),
          interestRate: 0.05,
          termMonths: 360,
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_ACCEPTED",
          loanId: "LOAN-001",
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_ACTIVATED",
          loanId: "LOAN-001",
          disbursementAccountId: "ACC-001",
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_RESTRUCTURED",
          loanId: "LOAN-001",
          newTermMonths: 480,
          reason: "Extended term",
          approvedBy: "OPS-001",
          occurredAt: Date.now(),
        },
      ];

      const loan = rebuildFromFacts(facts);

      expect(loan.termMonths).toBe(480);
    });
  });

  describe("Deterministic Replay", () => {
    it("rebuilds identical state from same facts", () => {
      const facts: LoanFact[] = [
        {
          type: "LOAN_OFFERED",
          loanId: "LOAN-001",
          borrowerAccountId: "ACC-001",
          principal: BigInt(100000),
          interestRate: 0.05,
          termMonths: 360,
          occurredAt: 1700000000000,
        },
        {
          type: "LOAN_ACCEPTED",
          loanId: "LOAN-001",
          occurredAt: 1700000001000,
        },
        {
          type: "LOAN_ACTIVATED",
          loanId: "LOAN-001",
          disbursementAccountId: "ACC-001",
          occurredAt: 1700000002000,
        },
        {
          type: "LOAN_PAYMENT_APPLIED",
          loanId: "LOAN-001",
          amount: BigInt(5000),
          principalPortion: BigInt(4500),
          interestPortion: BigInt(500),
          occurredAt: 1700000003000,
        },
      ];

      const loan1 = rebuildFromFacts(facts);
      const loan2 = rebuildFromFacts(facts);

      expect(loan1.loanId).toBe(loan2.loanId);
      expect(loan1.state).toBe(loan2.state);
      expect(loan1.principal).toBe(loan2.principal);
      expect(loan1.interestRate).toBe(loan2.interestRate);
      expect(loan1.termMonths).toBe(loan2.termMonths);
      expect(loan1.activatedAt).toBe(loan2.activatedAt);
    });

    it("rebuilds state with multiple payments", () => {
      const facts: LoanFact[] = [
        {
          type: "LOAN_OFFERED",
          loanId: "LOAN-001",
          borrowerAccountId: "ACC-001",
          principal: BigInt(100000),
          interestRate: 0.05,
          termMonths: 360,
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_ACCEPTED",
          loanId: "LOAN-001",
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_ACTIVATED",
          loanId: "LOAN-001",
          disbursementAccountId: "ACC-001",
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_PAYMENT_APPLIED",
          loanId: "LOAN-001",
          amount: BigInt(5000),
          principalPortion: BigInt(4500),
          interestPortion: BigInt(500),
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_PAYMENT_APPLIED",
          loanId: "LOAN-001",
          amount: BigInt(5000),
          principalPortion: BigInt(4600),
          interestPortion: BigInt(400),
          occurredAt: Date.now(),
        },
        {
          type: "LOAN_PAYMENT_APPLIED",
          loanId: "LOAN-001",
          amount: BigInt(5000),
          principalPortion: BigInt(4700),
          interestPortion: BigInt(300),
          occurredAt: Date.now(),
        },
      ];

      const loan = rebuildFromFacts(facts);

      expect(loan.state).toBe("ACTIVE");
      expect(loan.loanId).toBe("LOAN-001");
    });
  });
});
