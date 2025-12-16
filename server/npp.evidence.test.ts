/**
 * NPP Evidence Pack Tests
 * 
 * Verify evidence pack generation, verification, and export
 */

import { describe, it, expect } from "vitest";
import { NPPPaymentState, NPPFailureReason } from "../core/payments/npp";
import {
  buildNPPEvidencePack,
  verifyNPPEvidencePack,
  exportNPPEvidencePackJSON,
  type PaymentIntent,
  type RailDecision,
  type OpsAction,
} from "../exports/nppEvidencePack";

describe("NPP Evidence Pack", () => {
  const mockPaymentIntent: PaymentIntent = {
    paymentIntentId: "pay_test_123",
    amount: 10000n,
    currency: "AUD",
    fromAccount: "acc_from",
    toAccount: "acc_to",
    reference: "Test payment",
    requestedAt: new Date("2025-01-01T00:00:00Z"),
    requestedBy: "user_123",
  };

  const mockRailDecision: RailDecision = {
    rail: "NPP",
    reason: "Real-time payment required",
    decidedAt: new Date("2025-01-01T00:00:01Z"),
  };

  describe("buildNPPEvidencePack", () => {
    it("should build evidence pack for successful payment", () => {
      const events = [
        {
          type: "PaymentCreated" as const,
          paymentIntentId: "pay_test_123",
          occurredAt: new Date("2025-01-01T00:00:00Z"),
          amount: 10000n,
          currency: "AUD",
        },
        {
          type: "PaymentAuthorised" as const,
          paymentIntentId: "pay_test_123",
          occurredAt: new Date("2025-01-01T00:00:02Z"),
          fundsEarmarked: 10000n,
        },
        {
          type: "PaymentAttemptCreated" as const,
          paymentIntentId: "pay_test_123",
          occurredAt: new Date("2025-01-01T00:00:03Z"),
          attemptId: "att_1",
          attemptNumber: 1,
        },
        {
          type: "PaymentSent" as const,
          paymentIntentId: "pay_test_123",
          occurredAt: new Date("2025-01-01T00:00:04Z"),
          fundsHeld: 10000n,
        },
        {
          type: "PaymentAcknowledged" as const,
          paymentIntentId: "pay_test_123",
          occurredAt: new Date("2025-01-01T00:00:05Z"),
        },
        {
          type: "PaymentSettled" as const,
          paymentIntentId: "pay_test_123",
          occurredAt: new Date("2025-01-01T00:00:06Z"),
          fundsTransferred: 10000n,
        },
      ];

      const pack = buildNPPEvidencePack(
        mockPaymentIntent,
        mockRailDecision,
        events,
        [],
        NPPPaymentState.SETTLED,
        10000n
      );

      expect(pack.packId).toBe("npp-evidence-pay_test_123");
      expect(pack.packVersion).toBe("1.0");
      expect(pack.paymentIntent).toEqual(mockPaymentIntent);
      expect(pack.railDecision).toEqual(mockRailDecision);
      expect(pack.attempts).toHaveLength(1);
      expect(pack.attempts[0].attemptId).toBe("att_1");
      expect(pack.attempts[0].settledAt).toEqual(
        new Date("2025-01-01T00:00:06Z")
      );
      expect(pack.lifecycleEvents).toHaveLength(6);
      expect(pack.finalState.state).toBe(NPPPaymentState.SETTLED);
      expect(pack.finalState.fundsSettled).toBe(10000n);
      expect(pack.replayProof.eventCount).toBe(6);
      expect(pack.replayProof.eventsHash).toBeTruthy();
      expect(pack.replayProof.stateHash).toBeTruthy();
    });

    it("should build evidence pack for failed payment", () => {
      const events = [
        {
          type: "PaymentCreated" as const,
          paymentIntentId: "pay_test_456",
          occurredAt: new Date("2025-01-01T00:00:00Z"),
          amount: 10000n,
          currency: "AUD",
        },
        {
          type: "PaymentAuthorised" as const,
          paymentIntentId: "pay_test_456",
          occurredAt: new Date("2025-01-01T00:00:02Z"),
          fundsEarmarked: 10000n,
        },
        {
          type: "PaymentAttemptCreated" as const,
          paymentIntentId: "pay_test_456",
          occurredAt: new Date("2025-01-01T00:00:03Z"),
          attemptId: "att_1",
          attemptNumber: 1,
        },
        {
          type: "PaymentSent" as const,
          paymentIntentId: "pay_test_456",
          occurredAt: new Date("2025-01-01T00:00:04Z"),
          fundsHeld: 10000n,
        },
        {
          type: "PaymentFailed" as const,
          paymentIntentId: "pay_test_456",
          occurredAt: new Date("2025-01-01T00:00:05Z"),
          reason: NPPFailureReason.RAIL,
          fundsReleased: 10000n,
        },
      ];

      const pack = buildNPPEvidencePack(
        mockPaymentIntent,
        mockRailDecision,
        events,
        [],
        NPPPaymentState.FAILED,
        0n
      );

      expect(pack.finalState.state).toBe(NPPPaymentState.FAILED);
      expect(pack.finalState.fundsSettled).toBe(0n);
      expect(pack.finalState.failureReason).toBe(NPPFailureReason.RAIL);
      expect(pack.attempts[0].failedAt).toEqual(
        new Date("2025-01-01T00:00:05Z")
      );
    });

    it("should include ops actions in evidence pack", () => {
      const events = [
        {
          type: "PaymentCreated" as const,
          paymentIntentId: "pay_test_789",
          occurredAt: new Date("2025-01-01T00:00:00Z"),
          amount: 10000n,
          currency: "AUD",
        },
        {
          type: "PaymentAuthorised" as const,
          paymentIntentId: "pay_test_789",
          occurredAt: new Date("2025-01-01T00:00:02Z"),
          fundsEarmarked: 10000n,
        },
        {
          type: "PaymentFailed" as const,
          paymentIntentId: "pay_test_789",
          occurredAt: new Date("2025-01-01T00:00:03Z"),
          reason: NPPFailureReason.CANCELLED,
          fundsReleased: 10000n,
        },
      ];

      const opsActions: OpsAction[] = [
        {
          actionType: "CANCEL",
          operatorId: "op_123",
          reason: "Customer requested cancellation",
          occurredAt: new Date("2025-01-01T00:00:03Z"),
          policyApproval: true,
          fromState: NPPPaymentState.AUTHORISED,
          eventEmitted: events[2],
        },
      ];

      const pack = buildNPPEvidencePack(
        mockPaymentIntent,
        mockRailDecision,
        events,
        opsActions,
        NPPPaymentState.FAILED,
        0n
      );

      expect(pack.opsActions).toHaveLength(1);
      expect(pack.opsActions[0].actionType).toBe("CANCEL");
      expect(pack.opsActions[0].operatorId).toBe("op_123");
      expect(pack.opsActions[0].policyApproval).toBe(true);
    });
  });

  describe("verifyNPPEvidencePack", () => {
    it("should verify valid evidence pack", () => {
      const events = [
        {
          type: "PaymentCreated" as const,
          paymentIntentId: "pay_test_123",
          occurredAt: new Date("2025-01-01T00:00:00Z"),
          amount: 10000n,
          currency: "AUD",
        },
        {
          type: "PaymentSettled" as const,
          paymentIntentId: "pay_test_123",
          occurredAt: new Date("2025-01-01T00:00:06Z"),
          fundsTransferred: 10000n,
        },
      ];

      const pack = buildNPPEvidencePack(
        mockPaymentIntent,
        mockRailDecision,
        events,
        [],
        NPPPaymentState.SETTLED,
        10000n
      );

      const result = verifyNPPEvidencePack(pack);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect tampered events", () => {
      const events = [
        {
          type: "PaymentCreated" as const,
          paymentIntentId: "pay_test_123",
          occurredAt: new Date("2025-01-01T00:00:00Z"),
          amount: 10000n,
          currency: "AUD",
        },
      ];

      const pack = buildNPPEvidencePack(
        mockPaymentIntent,
        mockRailDecision,
        events,
        [],
        NPPPaymentState.SETTLED,
        10000n
      );

      // Tamper with events
      pack.lifecycleEvents.push({
        type: "PaymentSettled",
        paymentIntentId: "pay_test_123",
        occurredAt: new Date("2025-01-01T00:00:06Z"),
        fundsTransferred: 10000n,
      });

      const result = verifyNPPEvidencePack(pack);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Events hash mismatch - evidence may be tampered");
    });

    it("should reject non-terminal state evidence packs", () => {
      const events = [
        {
          type: "PaymentCreated" as const,
          paymentIntentId: "pay_test_123",
          occurredAt: new Date("2025-01-01T00:00:00Z"),
          amount: 10000n,
          currency: "AUD",
        },
      ];

      const pack = buildNPPEvidencePack(
        mockPaymentIntent,
        mockRailDecision,
        events,
        [],
        NPPPaymentState.AUTHORISED, // Non-terminal state
        0n
      );

      const result = verifyNPPEvidencePack(pack);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("terminal states"))).toBe(true);
    });
  });

  describe("exportNPPEvidencePackJSON", () => {
    it("should export evidence pack to JSON", () => {
      const events = [
        {
          type: "PaymentCreated" as const,
          paymentIntentId: "pay_test_123",
          occurredAt: new Date("2025-01-01T00:00:00Z"),
          amount: 10000n,
          currency: "AUD",
        },
        {
          type: "PaymentSettled" as const,
          paymentIntentId: "pay_test_123",
          occurredAt: new Date("2025-01-01T00:00:06Z"),
          fundsTransferred: 10000n,
        },
      ];

      const pack = buildNPPEvidencePack(
        mockPaymentIntent,
        mockRailDecision,
        events,
        [],
        NPPPaymentState.SETTLED,
        10000n
      );

      const json = exportNPPEvidencePackJSON(pack);

      expect(json).toBeTruthy();
      expect(() => JSON.parse(json)).not.toThrow();

      const parsed = JSON.parse(json);
      expect(parsed.packId).toBe("npp-evidence-pay_test_123");
      expect(parsed.finalState.fundsSettled).toBe("10000"); // BigInt converted to string
    });
  });
});
