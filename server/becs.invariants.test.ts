/**
 * BECS Invariant Tests
 * 
 * These tests verify that BECS-specific invariants hold across all payment scenarios.
 * 
 * Test Categories:
 * 1. Batch Integrity Invariants
 * 2. Return Handling Invariants
 * 3. State Transition Invariants
 * 4. Economic Invariants
 */

import { describe, it, expect } from "vitest";
import {
  createBECSPayment,
  applyBECSEvent,
  BECSPaymentState,
  BECSFailureReason,
  BECSReturnCode,
  assertBatchTotalsReconcile,
  assertBatchFileIntegrity,
  assertReturnOnlyFromCleared,
  assertSingleReturn,
  assertReturnReversesLedger,
  assertSingleBECSSettlement,
  assertBECSFundsConservation,
} from "../core/payments/becs";
import type { BECSPaymentEvent } from "../core/payments/becs";

describe("BECS Invariants", () => {
  // Helper to create a basic payment intent
  const createIntent = (paymentIntentId: string): BECSPaymentEvent => ({
    type: "PaymentIntentCreated",
    paymentIntentId,
    occurredAt: new Date(),
    amount: 50000n,
    currency: "AUD",
    idempotencyKey: `idem_${paymentIntentId}`,
    fromAccountId: "acc_from",
    toAccountId: "acc_to",
    bsb: "123-456",
    accountNumber: "12345678",
  });

  describe("Category 1: Batch Integrity Invariants", () => {
    it("should enforce batch totals reconcile", () => {
      const batchEvents: BECSPaymentEvent[] = [
        {
          type: "PaymentBatched",
          paymentIntentId: "pay_001",
          occurredAt: new Date(),
          batchId: "batch_001",
          batchDate: "2025-12-17",
          sequenceNumber: 1,
          fundsHeld: 50000n,
        },
        {
          type: "PaymentBatched",
          paymentIntentId: "pay_002",
          occurredAt: new Date(),
          batchId: "batch_001",
          batchDate: "2025-12-17",
          sequenceNumber: 2,
          fundsHeld: 75000n,
        },
      ];

      const declaredTotal = 125000n;

      expect(() =>
        assertBatchTotalsReconcile(batchEvents, declaredTotal)
      ).not.toThrow();
    });

    it("should reject batch total mismatch", () => {
      const batchEvents: BECSPaymentEvent[] = [
        {
          type: "PaymentBatched",
          paymentIntentId: "pay_001",
          occurredAt: new Date(),
          batchId: "batch_001",
          batchDate: "2025-12-17",
          sequenceNumber: 1,
          fundsHeld: 50000n,
        },
      ];

      const declaredTotal = 60000n; // Mismatch!

      expect(() =>
        assertBatchTotalsReconcile(batchEvents, declaredTotal)
      ).toThrow("INVARIANT_VIOLATION: Batch total mismatch");
    });

    it("should enforce batch file integrity (same batch ID)", () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentBatched",
          paymentIntentId: "pay_001",
          occurredAt: new Date(),
          batchId: "batch_001",
          batchDate: "2025-12-17",
          sequenceNumber: 1,
          fundsHeld: 50000n,
        },
        {
          type: "PaymentBatched",
          paymentIntentId: "pay_002",
          occurredAt: new Date(),
          batchId: "batch_001",
          batchDate: "2025-12-17",
          sequenceNumber: 2,
          fundsHeld: 75000n,
        },
      ];

      expect(() => assertBatchFileIntegrity(events)).not.toThrow();
    });

    it("should reject batch ID mismatch", () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentBatched",
          paymentIntentId: "pay_001",
          occurredAt: new Date(),
          batchId: "batch_001",
          batchDate: "2025-12-17",
          sequenceNumber: 1,
          fundsHeld: 50000n,
        },
        {
          type: "PaymentBatched",
          paymentIntentId: "pay_002",
          occurredAt: new Date(),
          batchId: "batch_002", // Different batch ID!
          batchDate: "2025-12-17",
          sequenceNumber: 2,
          fundsHeld: 75000n,
        },
      ];

      expect(() => assertBatchFileIntegrity(events)).toThrow(
        "INVARIANT_VIOLATION: Batch ID mismatch"
      );
    });
  });

  describe("Category 2: Return Handling Invariants", () => {
    it("should allow return only from CLEARED state", () => {
      expect(() =>
        assertReturnOnlyFromCleared(BECSPaymentState.CLEARED)
      ).not.toThrow();
    });

    it("should reject return from non-CLEARED state", () => {
      expect(() =>
        assertReturnOnlyFromCleared(BECSPaymentState.SETTLED)
      ).toThrow("INVARIANT_VIOLATION: Return only allowed from CLEARED state");
    });

    it("should enforce single return", () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentReturned",
          paymentIntentId: "pay_001",
          occurredAt: new Date(),
          batchId: "batch_001",
          returnCode: BECSReturnCode.INSUFFICIENT_FUNDS,
          returnDate: "2025-12-20",
          returnReason: "Insufficient funds",
          fundsReversed: 50000n,
        },
      ];

      expect(() => assertSingleReturn(events)).not.toThrow();
    });

    it("should reject multiple returns", () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentReturned",
          paymentIntentId: "pay_001",
          occurredAt: new Date(),
          batchId: "batch_001",
          returnCode: BECSReturnCode.INSUFFICIENT_FUNDS,
          returnDate: "2025-12-20",
          returnReason: "Insufficient funds",
          fundsReversed: 50000n,
        },
        {
          type: "PaymentReturned",
          paymentIntentId: "pay_001",
          occurredAt: new Date(),
          batchId: "batch_001",
          returnCode: BECSReturnCode.ACCOUNT_CLOSED,
          returnDate: "2025-12-21",
          returnReason: "Account closed",
          fundsReversed: 50000n,
        },
      ];

      expect(() => assertSingleReturn(events)).toThrow(
        "INVARIANT_VIOLATION: Multiple return events detected"
      );
    });

    it("should enforce return reverses ledger", () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentCleared",
          paymentIntentId: "pay_001",
          occurredAt: new Date(),
          batchId: "batch_001",
          clearingDate: "2025-12-18",
          fundsProvisional: 50000n,
        },
        {
          type: "PaymentReturned",
          paymentIntentId: "pay_001",
          occurredAt: new Date(),
          batchId: "batch_001",
          returnCode: BECSReturnCode.INSUFFICIENT_FUNDS,
          returnDate: "2025-12-20",
          returnReason: "Insufficient funds",
          fundsReversed: 50000n,
        },
      ];

      expect(() => assertReturnReversesLedger(events)).not.toThrow();
    });

    it("should reject return amount mismatch", () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentCleared",
          paymentIntentId: "pay_001",
          occurredAt: new Date(),
          batchId: "batch_001",
          clearingDate: "2025-12-18",
          fundsProvisional: 50000n,
        },
        {
          type: "PaymentReturned",
          paymentIntentId: "pay_001",
          occurredAt: new Date(),
          batchId: "batch_001",
          returnCode: BECSReturnCode.INSUFFICIENT_FUNDS,
          returnDate: "2025-12-20",
          returnReason: "Insufficient funds",
          fundsReversed: 40000n, // Mismatch!
        },
      ];

      expect(() => assertReturnReversesLedger(events)).toThrow(
        "INVARIANT_VIOLATION: Return amount mismatch"
      );
    });
  });

  describe("Category 3: Economic Invariants", () => {
    it("should enforce single settlement", () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentSettled",
          paymentIntentId: "pay_001",
          occurredAt: new Date(),
          batchId: "batch_001",
          settlementRef: "settle_001",
          settlementDate: "2025-12-19",
          fundsTransferred: 50000n,
        },
      ];

      expect(() => assertSingleBECSSettlement(events)).not.toThrow();
    });

    it("should reject multiple settlements", () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentSettled",
          paymentIntentId: "pay_001",
          occurredAt: new Date(),
          batchId: "batch_001",
          settlementRef: "settle_001",
          settlementDate: "2025-12-19",
          fundsTransferred: 50000n,
        },
        {
          type: "PaymentSettled",
          paymentIntentId: "pay_001",
          occurredAt: new Date(),
          batchId: "batch_001",
          settlementRef: "settle_002",
          settlementDate: "2025-12-20",
          fundsTransferred: 50000n,
        },
      ];

      expect(() => assertSingleBECSSettlement(events)).toThrow(
        "INVARIANT_VIOLATION: Multiple settlement events detected"
      );
    });

    it("should enforce funds conservation (happy path)", () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentAuthorised",
          paymentIntentId: "pay_001",
          occurredAt: new Date(),
          policyChecksPassed: true,
          fundsEarmarked: 50000n,
        },
        {
          type: "PaymentSettled",
          paymentIntentId: "pay_001",
          occurredAt: new Date(),
          batchId: "batch_001",
          settlementRef: "settle_001",
          settlementDate: "2025-12-19",
          fundsTransferred: 50000n,
        },
      ];

      expect(() => assertBECSFundsConservation(events)).not.toThrow();
    });

    it("should enforce funds conservation (failure path)", () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentAuthorised",
          paymentIntentId: "pay_001",
          occurredAt: new Date(),
          policyChecksPassed: true,
          fundsEarmarked: 50000n,
        },
        {
          type: "PaymentFailed",
          paymentIntentId: "pay_001",
          occurredAt: new Date(),
          batchId: "batch_001",
          reason: BECSFailureReason.FILE_REJECTED,
          fundsReleased: 50000n,
        },
      ];

      expect(() => assertBECSFundsConservation(events)).not.toThrow();
    });

    it("should enforce funds conservation (return path)", () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentAuthorised",
          paymentIntentId: "pay_001",
          occurredAt: new Date(),
          policyChecksPassed: true,
          fundsEarmarked: 50000n,
        },
        {
          type: "PaymentReturned",
          paymentIntentId: "pay_001",
          occurredAt: new Date(),
          batchId: "batch_001",
          returnCode: BECSReturnCode.INSUFFICIENT_FUNDS,
          returnDate: "2025-12-20",
          returnReason: "Insufficient funds",
          fundsReversed: 50000n,
        },
      ];

      expect(() => assertBECSFundsConservation(events)).not.toThrow();
    });

    it("should reject funds conservation violation", () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentAuthorised",
          paymentIntentId: "pay_001",
          occurredAt: new Date(),
          policyChecksPassed: true,
          fundsEarmarked: 50000n,
        },
        {
          type: "PaymentSettled",
          paymentIntentId: "pay_001",
          occurredAt: new Date(),
          batchId: "batch_001",
          settlementRef: "settle_001",
          settlementDate: "2025-12-19",
          fundsTransferred: 60000n, // More than earmarked!
        },
      ];

      expect(() => assertBECSFundsConservation(events)).toThrow(
        "INVARIANT_VIOLATION: Funds conservation violated"
      );
    });
  });
});
