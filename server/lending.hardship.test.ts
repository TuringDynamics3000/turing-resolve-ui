/**
 * Lending Core v1 - Hardship Property Tests
 * 
 * Verifies hardship and restructure derivation rules:
 * - Hardship never reduces principal
 * - Exiting hardship restores normal derivation
 * - Restructure does not affect past obligations
 * - Replay with/without hardship yields deterministic result
 */

import { describe, it, expect } from "vitest";
import {
  Loan,
  rebuildFromFacts,
  type LoanFact,
} from "../core/lending";
import { deriveSchedule } from "../core/lending/derivation/deriveSchedule";

describe("Lending Core v1 - Hardship Property Tests", () => {
  describe("Hardship Invariants", () => {
    it("hardship never reduces principal", () => {
      const baseFacts: LoanFact[] = [
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
      ];

      // Loan before hardship
      const loanBeforeHardship = rebuildFromFacts(baseFacts);
      const principalBefore = loanBeforeHardship.principal;

      // Enter hardship
      const factsWithHardship: LoanFact[] = [
        ...baseFacts,
        {
          type: "HARDSHIP_ENTERED",
          loanId: "LOAN-001",
          hardshipType: "PAYMENT_PAUSE",
          reason: "Financial difficulty",
          approvedBy: "OPS-001",
          occurredAt: 1700000003000,
        },
      ];

      const loanAfterHardship = rebuildFromFacts(factsWithHardship);
      const principalAfter = loanAfterHardship.principal;

      // CRITICAL: Hardship must NOT reduce principal
      expect(principalAfter).toBe(principalBefore);
      expect(loanAfterHardship.state).toBe("HARDSHIP");
    });

    it("exiting hardship restores normal derivation", () => {
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
          type: "HARDSHIP_ENTERED",
          loanId: "LOAN-001",
          hardshipType: "PAYMENT_PAUSE",
          reason: "Financial difficulty",
          approvedBy: "OPS-001",
          occurredAt: 1700000003000,
        },
        {
          type: "HARDSHIP_EXITED",
          loanId: "LOAN-001",
          reason: "Financial situation improved",
          occurredAt: 1700000004000,
        },
      ];

      const loan = rebuildFromFacts(facts);

      // After exiting hardship, loan should be ACTIVE
      expect(loan.state).toBe("ACTIVE");

      // Derive schedule - should show normal payments
      const schedule = deriveSchedule(facts);
      expect(schedule).not.toBeNull();
      expect(schedule!.isInHardship).toBe(false);
      expect(schedule!.nextPaymentDue).toBeGreaterThan(0n);
    });

    it("payment pause sets next payment to zero", () => {
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
          type: "HARDSHIP_ENTERED",
          loanId: "LOAN-001",
          hardshipType: "PAYMENT_PAUSE",
          reason: "Financial difficulty",
          approvedBy: "OPS-001",
          occurredAt: 1700000003000,
        },
      ];

      const schedule = deriveSchedule(facts);
      expect(schedule).not.toBeNull();
      expect(schedule!.isInHardship).toBe(true);
      expect(schedule!.hardshipType).toBe("PAYMENT_PAUSE");
      expect(schedule!.nextPaymentDue).toBe(0n); // No payment due during pause
    });

    it("interest-only hardship shows interest-only payments", () => {
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
          type: "HARDSHIP_ENTERED",
          loanId: "LOAN-001",
          hardshipType: "INTEREST_ONLY",
          reason: "Temporary cash flow issue",
          approvedBy: "OPS-001",
          occurredAt: 1700000003000,
        },
      ];

      const schedule = deriveSchedule(facts);
      expect(schedule).not.toBeNull();
      expect(schedule!.isInHardship).toBe(true);
      expect(schedule!.hardshipType).toBe("INTEREST_ONLY");
      
      // Payment should be interest-only (no principal reduction)
      const monthlyInterest = BigInt(Math.floor(Number(100000n) * (0.05 / 12)));
      expect(schedule!.nextPaymentDue).toBeGreaterThan(0n);
      expect(schedule!.nextPaymentDue).toBeLessThanOrEqual(monthlyInterest + 100n); // Allow small rounding
    });
  });

  describe("Restructure Invariants", () => {
    it("restructure does not affect past obligations", () => {
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
          type: "LOAN_RESTRUCTURED",
          loanId: "LOAN-001",
          newInterestRate: 0.03, // Reduced rate
          newTermMonths: 480, // Extended term
          reason: "Hardship arrangement",
          approvedBy: "OPS-001",
          occurredAt: 1700000003000,
        },
      ];

      const loan = rebuildFromFacts(facts);

      // Restructure doesn't change principal
      expect(loan.principal).toBe(BigInt(100000));
      
      // Derive schedule should use new terms
      const schedule = deriveSchedule(facts);
      expect(schedule).not.toBeNull();
      expect(schedule!.currentTerms.interestRate).toBe(0.03);
      expect(schedule!.currentTerms.termMonths).toBe(480);
      expect(schedule!.restructuredAt).toBe(1700000003000);
    });

    it("restructure only affects future payments", () => {
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
        {
          type: "LOAN_RESTRUCTURED",
          loanId: "LOAN-001",
          newInterestRate: 0.03,
          reason: "Hardship arrangement",
          approvedBy: "OPS-001",
          occurredAt: 1700000004000,
        },
      ];

      const loan = rebuildFromFacts(facts);

      // Payment before restructure still applied
      expect(loan.principal).toBe(BigInt(95000)); // 100000 - 5000 (full payment amount)
      
      // Future schedule uses new rate
      const schedule = deriveSchedule(facts);
      expect(schedule).not.toBeNull();
      expect(schedule!.currentTerms.interestRate).toBe(0.03);
    });
  });

  describe("Deterministic Replay", () => {
    it("replay with hardship yields deterministic result", () => {
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
          type: "HARDSHIP_ENTERED",
          loanId: "LOAN-001",
          hardshipType: "REDUCED_PAYMENTS",
          reason: "Financial difficulty",
          approvedBy: "OPS-001",
          occurredAt: 1700000003000,
        },
        {
          type: "LOAN_PAYMENT_APPLIED",
          loanId: "LOAN-001",
          amount: BigInt(2000),
          principalPortion: BigInt(1800),
          interestPortion: BigInt(200),
          occurredAt: 1700000004000,
        },
      ];

      // Replay multiple times
      const loan1 = rebuildFromFacts(facts);
      const loan2 = rebuildFromFacts(facts);
      const loan3 = rebuildFromFacts(facts);

      // All replays must produce identical state
      expect(loan1.principal).toBe(loan2.principal);
      expect(loan2.principal).toBe(loan3.principal);
      expect(loan1.state).toBe(loan2.state);
      expect(loan2.state).toBe(loan3.state);

      // Derived schedule must also be deterministic
      const schedule1 = deriveSchedule(facts);
      const schedule2 = deriveSchedule(facts);
      expect(schedule1!.nextPaymentDue).toBe(schedule2!.nextPaymentDue);
      expect(schedule1!.isInHardship).toBe(schedule2!.isInHardship);
    });
  });
});
