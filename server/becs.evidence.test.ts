/**
 * BECS Evidence Pack Tests
 * 
 * These tests verify that BECS evidence packs are generated correctly
 * and contain all required information for regulatory compliance.
 * 
 * Test Categories:
 * 1. Evidence Pack Generation
 * 2. Batch Metadata Verification
 * 3. Return Information Verification
 * 4. Cryptographic Proof Verification
 * 5. Invariant Verification
 */

import { describe, it, expect } from "vitest";
import {
  generateBECSEvidencePack,
  exportBECSEvidencePackJSON,
  validateBECSEvidencePack,
} from "../exports/becsEvidencePack";
import { BECSReturnCode, BECSFailureReason } from "../core/payments/becs";
import type { BECSPaymentEvent } from "../core/payments/becs";

describe("BECS Evidence Pack", () => {
  describe("Category 1: Evidence Pack Generation", () => {
    it("should generate evidence pack for happy path", async () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentIntentCreated",
          paymentIntentId: "pay_001",
          occurredAt: new Date("2025-12-17T10:00:00Z"),
          amount: 50000n,
          currency: "AUD",
          idempotencyKey: "idem_001",
          fromAccountId: "acc_from",
          toAccountId: "acc_to",
          bsb: "123-456",
          accountNumber: "12345678",
        },
        {
          type: "PaymentAuthorised",
          paymentIntentId: "pay_001",
          occurredAt: new Date("2025-12-17T10:01:00Z"),
          policyChecksPassed: true,
          fundsEarmarked: 50000n,
        },
        {
          type: "PaymentBatched",
          paymentIntentId: "pay_001",
          occurredAt: new Date("2025-12-17T16:00:00Z"),
          batchId: "batch_001",
          batchDate: "2025-12-17",
          sequenceNumber: 1,
          fundsHeld: 50000n,
        },
        {
          type: "BatchSubmitted",
          paymentIntentId: "pay_001",
          occurredAt: new Date("2025-12-17T17:00:00Z"),
          batchId: "batch_001",
          fileReference: "file_001",
          declaredTotal: 50000n,
          itemCount: 1,
        },
        {
          type: "PaymentCleared",
          paymentIntentId: "pay_001",
          occurredAt: new Date("2025-12-18T09:00:00Z"),
          batchId: "batch_001",
          clearingDate: "2025-12-18",
          fundsProvisional: 50000n,
        },
        {
          type: "PaymentSettled",
          paymentIntentId: "pay_001",
          occurredAt: new Date("2025-12-19T09:00:00Z"),
          batchId: "batch_001",
          settlementRef: "settle_001",
          settlementDate: "2025-12-19",
          fundsTransferred: 50000n,
        },
      ];

      const pack = await generateBECSEvidencePack("pay_001", events);

      expect(pack.paymentIntentId).toBe("pay_001");
      expect(pack.summary.amount).toBe("$500.00");
      expect(pack.summary.currentState).toBe("SETTLED");
      expect(pack.events).toHaveLength(6);
      expect(pack.proof.eventCount).toBe(6);
      expect(pack.proof.replayVerified).toBe(true);
    });

    it("should include batch metadata", async () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentIntentCreated",
          paymentIntentId: "pay_002",
          occurredAt: new Date("2025-12-17T10:00:00Z"),
          amount: 75000n,
          currency: "AUD",
          idempotencyKey: "idem_002",
          fromAccountId: "acc_from",
          toAccountId: "acc_to",
          bsb: "123-456",
          accountNumber: "12345678",
        },
        {
          type: "PaymentAuthorised",
          paymentIntentId: "pay_002",
          occurredAt: new Date("2025-12-17T10:01:00Z"),
          policyChecksPassed: true,
          fundsEarmarked: 75000n,
        },
        {
          type: "PaymentBatched",
          paymentIntentId: "pay_002",
          occurredAt: new Date("2025-12-17T16:00:00Z"),
          batchId: "batch_002",
          batchDate: "2025-12-17",
          sequenceNumber: 5,
          fundsHeld: 75000n,
        },
        {
          type: "BatchSubmitted",
          paymentIntentId: "pay_002",
          occurredAt: new Date("2025-12-17T17:00:00Z"),
          batchId: "batch_002",
          fileReference: "file_002",
          declaredTotal: 75000n,
          itemCount: 1,
        },
      ];

      const pack = await generateBECSEvidencePack("pay_002", events);

      expect(pack.batch.batchId).toBe("batch_002");
      expect(pack.batch.batchDate).toBe("2025-12-17");
      expect(pack.batch.fileReference).toBe("file_002");
      expect(pack.batch.sequenceNumber).toBe(5);
      expect(pack.batch.declaredTotal).toBe("$750.00");
      expect(pack.batch.itemCount).toBe(1);
    });

    it("should include return information for late returns", async () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentIntentCreated",
          paymentIntentId: "pay_003",
          occurredAt: new Date("2025-12-17T10:00:00Z"),
          amount: 50000n,
          currency: "AUD",
          idempotencyKey: "idem_003",
          fromAccountId: "acc_from",
          toAccountId: "acc_to",
          bsb: "123-456",
          accountNumber: "12345678",
        },
        {
          type: "PaymentAuthorised",
          paymentIntentId: "pay_003",
          occurredAt: new Date("2025-12-17T10:01:00Z"),
          policyChecksPassed: true,
          fundsEarmarked: 50000n,
        },
        {
          type: "PaymentBatched",
          paymentIntentId: "pay_003",
          occurredAt: new Date("2025-12-17T16:00:00Z"),
          batchId: "batch_001",
          batchDate: "2025-12-17",
          sequenceNumber: 1,
          fundsHeld: 50000n,
        },
        {
          type: "BatchSubmitted",
          paymentIntentId: "pay_003",
          occurredAt: new Date("2025-12-17T17:00:00Z"),
          batchId: "batch_001",
          fileReference: "file_001",
          declaredTotal: 50000n,
          itemCount: 1,
        },
        {
          type: "PaymentCleared",
          paymentIntentId: "pay_003",
          occurredAt: new Date("2025-12-18T09:00:00Z"),
          batchId: "batch_001",
          clearingDate: "2025-12-18",
          fundsProvisional: 50000n,
        },
        {
          type: "PaymentReturned",
          paymentIntentId: "pay_003",
          occurredAt: new Date("2025-12-20T09:00:00Z"),
          batchId: "batch_001",
          returnCode: BECSReturnCode.INSUFFICIENT_FUNDS,
          returnDate: "2025-12-20",
          returnReason: "Insufficient funds",
          fundsReversed: 50000n,
        },
      ];

      const pack = await generateBECSEvidencePack("pay_003", events);

      expect(pack.return).toBeDefined();
      expect(pack.return?.returnCode).toBe(BECSReturnCode.INSUFFICIENT_FUNDS);
      expect(pack.return?.returnReason).toBe("Insufficient funds");
      expect(pack.return?.returnDate).toBe("2025-12-20");
      expect(pack.return?.fundsReversed).toBe("$500.00");
      expect(pack.return?.daysAfterClearing).toBe(2);
    });

    it("should calculate settlement timeline correctly", async () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentIntentCreated",
          paymentIntentId: "pay_004",
          occurredAt: new Date("2025-12-17T10:00:00Z"),
          amount: 50000n,
          currency: "AUD",
          idempotencyKey: "idem_004",
          fromAccountId: "acc_from",
          toAccountId: "acc_to",
          bsb: "123-456",
          accountNumber: "12345678",
        },
        {
          type: "PaymentAuthorised",
          paymentIntentId: "pay_004",
          occurredAt: new Date("2025-12-17T10:01:00Z"),
          policyChecksPassed: true,
          fundsEarmarked: 50000n,
        },
        {
          type: "PaymentBatched",
          paymentIntentId: "pay_004",
          occurredAt: new Date("2025-12-17T16:00:00Z"),
          batchId: "batch_001",
          batchDate: "2025-12-17",
          sequenceNumber: 1,
          fundsHeld: 50000n,
        },
        {
          type: "BatchSubmitted",
          paymentIntentId: "pay_004",
          occurredAt: new Date("2025-12-17T17:00:00Z"),
          batchId: "batch_001",
          fileReference: "file_001",
          declaredTotal: 50000n,
          itemCount: 1,
        },
        {
          type: "PaymentCleared",
          paymentIntentId: "pay_004",
          occurredAt: new Date("2025-12-18T09:00:00Z"),
          batchId: "batch_001",
          clearingDate: "2025-12-18",
          fundsProvisional: 50000n,
        },
        {
          type: "PaymentSettled",
          paymentIntentId: "pay_004",
          occurredAt: new Date("2025-12-19T09:00:00Z"),
          batchId: "batch_001",
          settlementRef: "settle_001",
          settlementDate: "2025-12-19",
          fundsTransferred: 50000n,
        },
      ];

      const pack = await generateBECSEvidencePack("pay_004", events);

      // Settlement is 2 days after creation (17th 10am → 19th 9am = ~47 hours = 1 day floor)
      expect(pack.timeline.settlementDuration).toBe("T+1");
    });
  });

  describe("Category 2: Cryptographic Proof Verification", () => {
    it("should include SHA-256 state hash", async () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentIntentCreated",
          paymentIntentId: "pay_005",
          occurredAt: new Date("2025-12-17T10:00:00Z"),
          amount: 50000n,
          currency: "AUD",
          idempotencyKey: "idem_005",
          fromAccountId: "acc_from",
          toAccountId: "acc_to",
          bsb: "123-456",
          accountNumber: "12345678",
        },
        {
          type: "PaymentAuthorised",
          paymentIntentId: "pay_005",
          occurredAt: new Date("2025-12-17T10:01:00Z"),
          policyChecksPassed: true,
          fundsEarmarked: 50000n,
        },
      ];

      const pack = await generateBECSEvidencePack("pay_005", events);

      expect(pack.proof.stateHash).toBeDefined();
      expect(pack.proof.stateHash).toHaveLength(64); // SHA-256 hex length
      expect(pack.proof.hashAlgorithm).toBe("SHA-256");
    });

    it("should verify replay produces same state", async () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentIntentCreated",
          paymentIntentId: "pay_006",
          occurredAt: new Date("2025-12-17T10:00:00Z"),
          amount: 50000n,
          currency: "AUD",
          idempotencyKey: "idem_006",
          fromAccountId: "acc_from",
          toAccountId: "acc_to",
          bsb: "123-456",
          accountNumber: "12345678",
        },
        {
          type: "PaymentAuthorised",
          paymentIntentId: "pay_006",
          occurredAt: new Date("2025-12-17T10:01:00Z"),
          policyChecksPassed: true,
          fundsEarmarked: 50000n,
        },
      ];

      const pack = await generateBECSEvidencePack("pay_006", events);

      expect(pack.proof.replayVerified).toBe(true);
    });
  });

  describe("Category 3: Invariant Verification", () => {
    it("should verify batch totals reconcile", async () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentIntentCreated",
          paymentIntentId: "pay_007",
          occurredAt: new Date("2025-12-17T10:00:00Z"),
          amount: 50000n,
          currency: "AUD",
          idempotencyKey: "idem_007",
          fromAccountId: "acc_from",
          toAccountId: "acc_to",
          bsb: "123-456",
          accountNumber: "12345678",
        },
        {
          type: "PaymentAuthorised",
          paymentIntentId: "pay_007",
          occurredAt: new Date("2025-12-17T10:01:00Z"),
          policyChecksPassed: true,
          fundsEarmarked: 50000n,
        },
        {
          type: "PaymentBatched",
          paymentIntentId: "pay_007",
          occurredAt: new Date("2025-12-17T16:00:00Z"),
          batchId: "batch_001",
          batchDate: "2025-12-17",
          sequenceNumber: 1,
          fundsHeld: 50000n,
        },
        {
          type: "BatchSubmitted",
          paymentIntentId: "pay_007",
          occurredAt: new Date("2025-12-17T17:00:00Z"),
          batchId: "batch_001",
          fileReference: "file_001",
          declaredTotal: 50000n,
          itemCount: 1,
        },
      ];

      const pack = await generateBECSEvidencePack("pay_007", events);

      expect(pack.invariants.batchTotalsReconcile).toBe(true);
      expect(pack.invariants.violations).toHaveLength(0);
    });

    it("should detect batch total mismatch", async () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentIntentCreated",
          paymentIntentId: "pay_008",
          occurredAt: new Date("2025-12-17T10:00:00Z"),
          amount: 50000n,
          currency: "AUD",
          idempotencyKey: "idem_008",
          fromAccountId: "acc_from",
          toAccountId: "acc_to",
          bsb: "123-456",
          accountNumber: "12345678",
        },
        {
          type: "PaymentAuthorised",
          paymentIntentId: "pay_008",
          occurredAt: new Date("2025-12-17T10:01:00Z"),
          policyChecksPassed: true,
          fundsEarmarked: 50000n,
        },
        {
          type: "PaymentBatched",
          paymentIntentId: "pay_008",
          occurredAt: new Date("2025-12-17T16:00:00Z"),
          batchId: "batch_001",
          batchDate: "2025-12-17",
          sequenceNumber: 1,
          fundsHeld: 50000n,
        },
        {
          type: "BatchSubmitted",
          paymentIntentId: "pay_008",
          occurredAt: new Date("2025-12-17T17:00:00Z"),
          batchId: "batch_001",
          fileReference: "file_001",
          declaredTotal: 60000n, // Mismatch!
          itemCount: 1,
        },
      ];

      const pack = await generateBECSEvidencePack("pay_008", events);

      expect(pack.invariants.batchTotalsReconcile).toBe(false);
      expect(pack.invariants.violations.length).toBeGreaterThan(0);
      expect(pack.invariants.violations[0]).toContain("Batch total mismatch");
    });

    it("should verify return reverses ledger", async () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentIntentCreated",
          paymentIntentId: "pay_009",
          occurredAt: new Date("2025-12-17T10:00:00Z"),
          amount: 50000n,
          currency: "AUD",
          idempotencyKey: "idem_009",
          fromAccountId: "acc_from",
          toAccountId: "acc_to",
          bsb: "123-456",
          accountNumber: "12345678",
        },
        {
          type: "PaymentAuthorised",
          paymentIntentId: "pay_009",
          occurredAt: new Date("2025-12-17T10:01:00Z"),
          policyChecksPassed: true,
          fundsEarmarked: 50000n,
        },
        {
          type: "PaymentBatched",
          paymentIntentId: "pay_009",
          occurredAt: new Date("2025-12-17T16:00:00Z"),
          batchId: "batch_001",
          batchDate: "2025-12-17",
          sequenceNumber: 1,
          fundsHeld: 50000n,
        },
        {
          type: "BatchSubmitted",
          paymentIntentId: "pay_009",
          occurredAt: new Date("2025-12-17T17:00:00Z"),
          batchId: "batch_001",
          fileReference: "file_001",
          declaredTotal: 50000n,
          itemCount: 1,
        },
        {
          type: "PaymentCleared",
          paymentIntentId: "pay_009",
          occurredAt: new Date("2025-12-18T09:00:00Z"),
          batchId: "batch_001",
          clearingDate: "2025-12-18",
          fundsProvisional: 50000n,
        },
        {
          type: "PaymentReturned",
          paymentIntentId: "pay_009",
          occurredAt: new Date("2025-12-20T09:00:00Z"),
          batchId: "batch_001",
          returnCode: BECSReturnCode.INSUFFICIENT_FUNDS,
          returnDate: "2025-12-20",
          returnReason: "Insufficient funds",
          fundsReversed: 50000n,
        },
      ];

      const pack = await generateBECSEvidencePack("pay_009", events);

      expect(pack.invariants.returnReversesLedger).toBe(true);
      expect(pack.invariants.violations).toHaveLength(0);
    });
  });

  describe("Category 4: Evidence Pack Validation", () => {
    it("should validate valid evidence pack", async () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentIntentCreated",
          paymentIntentId: "pay_010",
          occurredAt: new Date("2025-12-17T10:00:00Z"),
          amount: 50000n,
          currency: "AUD",
          idempotencyKey: "idem_010",
          fromAccountId: "acc_from",
          toAccountId: "acc_to",
          bsb: "123-456",
          accountNumber: "12345678",
        },
        {
          type: "PaymentAuthorised",
          paymentIntentId: "pay_010",
          occurredAt: new Date("2025-12-17T10:01:00Z"),
          policyChecksPassed: true,
          fundsEarmarked: 50000n,
        },
      ];

      const pack = await generateBECSEvidencePack("pay_010", events);
      const validation = validateBECSEvidencePack(pack);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should export evidence pack as JSON", async () => {
      const events: BECSPaymentEvent[] = [
        {
          type: "PaymentIntentCreated",
          paymentIntentId: "pay_011",
          occurredAt: new Date("2025-12-17T10:00:00Z"),
          amount: 50000n,
          currency: "AUD",
          idempotencyKey: "idem_011",
          fromAccountId: "acc_from",
          toAccountId: "acc_to",
          bsb: "123-456",
          accountNumber: "12345678",
        },
        {
          type: "PaymentAuthorised",
          paymentIntentId: "pay_011",
          occurredAt: new Date("2025-12-17T10:01:00Z"),
          policyChecksPassed: true,
          fundsEarmarked: 50000n,
        },
      ];

      const pack = await generateBECSEvidencePack("pay_011", events);
      const json = exportBECSEvidencePackJSON(pack);

      expect(json).toBeDefined();
      expect(json).toContain("pay_011");
      expect(json).toContain("stateHash");
      
      // Verify it's valid JSON
      const parsed = JSON.parse(json);
      expect(parsed.paymentIntentId).toBe("pay_011");
    });
  });
});
