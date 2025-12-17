import { describe, it, expect } from "vitest";
import {
  createRTGSPayment,
  rebuildRTGSFromEvents,
  getRTGSPaymentHash,
  RTGSPaymentEvent,
  RTGSApprovalRole,
} from "../core/payments/rtgs";

describe("RTGS Replay Guarantee", () => {
  const baseEvent: RTGSPaymentEvent = {
    type: "PaymentIntentCreated",
    paymentIntentId: "rtgs-replay-001",
    occurredAt: new Date("2025-01-01T00:00:00Z"),
    amount: 500000000n,
    currency: "AUD",
    idempotencyKey: "idempotency-001",
    fromAccountId: "acc-001",
    toAccountId: "acc-002",
    bsb: "062-000",
    accountNumber: "12345678",
    initiatorId: "user-001",
    initiatorRole: RTGSApprovalRole.INITIATOR,
  };

  it("should rebuild payment from event stream (happy path)", () => {
    const events: RTGSPaymentEvent[] = [
      baseEvent,
      {
        type: "ApprovalRequested",
        paymentIntentId: baseEvent.paymentIntentId,
        occurredAt: new Date("2025-01-01T00:01:00Z"),
        requiredApprovers: 2,
        requiredRoles: [RTGSApprovalRole.FIRST_APPROVER, RTGSApprovalRole.SECOND_APPROVER],
        approvalThreshold: 500000000n,
        expiresAt: new Date("2025-01-02T00:00:00Z"),
      },
      {
        type: "ApprovalGranted",
        paymentIntentId: baseEvent.paymentIntentId,
        occurredAt: new Date("2025-01-01T00:02:00Z"),
        approverId: "approver-001",
        approverRole: RTGSApprovalRole.FIRST_APPROVER,
        approvalSequence: 1,
      },
      {
        type: "ApprovalGranted",
        paymentIntentId: baseEvent.paymentIntentId,
        occurredAt: new Date("2025-01-01T00:03:00Z"),
        approverId: "approver-002",
        approverRole: RTGSApprovalRole.SECOND_APPROVER,
        approvalSequence: 2,
      },
      {
        type: "DualControlVerified",
        paymentIntentId: baseEvent.paymentIntentId,
        occurredAt: new Date("2025-01-01T00:04:00Z"),
        approvers: [
          {
            approverId: "approver-001",
            approverRole: RTGSApprovalRole.FIRST_APPROVER,
            approvedAt: new Date("2025-01-01T00:02:00Z"),
          },
          {
            approverId: "approver-002",
            approverRole: RTGSApprovalRole.SECOND_APPROVER,
            approvedAt: new Date("2025-01-01T00:03:00Z"),
          },
        ],
        allRequirementsMet: true,
      },
      {
        type: "PaymentAuthorised",
        paymentIntentId: baseEvent.paymentIntentId,
        occurredAt: new Date("2025-01-01T00:04:30Z"),
        policyChecksPassed: true,
        fundsEarmarked: 500000000n,
      },
      {
        type: "PaymentSent",
        paymentIntentId: baseEvent.paymentIntentId,
        occurredAt: new Date("2025-01-01T00:05:00Z"),
        railTransactionId: "rtgs-txn-001",
        sentAt: new Date("2025-01-01T00:05:00Z"),
        fundsDebited: 500000000n,
      },
      {
        type: "PaymentSettled",
        paymentIntentId: baseEvent.paymentIntentId,
        occurredAt: new Date("2025-01-01T00:06:00Z"),
        settledAt: new Date("2025-01-01T00:06:00Z"),
        railConfirmationId: "rtgs-conf-001",
        fundsTransferred: 500000000n,
      },
    ];

    const payment = rebuildRTGSFromEvents(events);

    expect(payment.paymentIntentId).toBe(baseEvent.paymentIntentId);
    expect(payment.state).toBe("SETTLED");
    expect(payment.approvals).toHaveLength(2);
    expect(payment.version).toBe(events.length);
  });

  it("should rebuild payment from rejection path", () => {
    const events: RTGSPaymentEvent[] = [
      baseEvent,
      {
        type: "ApprovalRequested",
        paymentIntentId: baseEvent.paymentIntentId,
        occurredAt: new Date("2025-01-01T00:01:00Z"),
        requiredApprovers: 2,
        requiredRoles: [RTGSApprovalRole.FIRST_APPROVER, RTGSApprovalRole.SECOND_APPROVER],
        approvalThreshold: 500000000n,
        expiresAt: new Date("2025-01-02T00:00:00Z"),
      },
      {
        type: "ApprovalRejected",
        paymentIntentId: baseEvent.paymentIntentId,
        occurredAt: new Date("2025-01-01T00:02:00Z"),
        rejectedBy: "approver-001",
        rejectorRole: RTGSApprovalRole.FIRST_APPROVER,
        rejectionReason: "Insufficient documentation",
      },
    ];

    const payment = rebuildRTGSFromEvents(events);

    expect(payment.state).toBe("REJECTED");
    expect(payment.rejectedAt).toBeDefined();
  });

  it("should produce deterministic replay (same events = same hash)", () => {
    const events: RTGSPaymentEvent[] = [
      baseEvent,
      {
        type: "ApprovalRequested",
        paymentIntentId: baseEvent.paymentIntentId,
        occurredAt: new Date("2025-01-01T00:01:00Z"),
        requiredApprovers: 2,
        requiredRoles: [RTGSApprovalRole.FIRST_APPROVER, RTGSApprovalRole.SECOND_APPROVER],
        approvalThreshold: 500000000n,
        expiresAt: new Date("2025-01-02T00:00:00Z"),
      },
    ];

    const payment1 = rebuildRTGSFromEvents(events);
    const payment2 = rebuildRTGSFromEvents(events);

    const hash1 = getRTGSPaymentHash(payment1);
    const hash2 = getRTGSPaymentHash(payment2);

    expect(hash1).toBe(hash2);
  });

  it("should verify replay after crash simulation", () => {
    const events: RTGSPaymentEvent[] = [
      baseEvent,
      {
        type: "ApprovalRequested",
        paymentIntentId: baseEvent.paymentIntentId,
        occurredAt: new Date("2025-01-01T00:01:00Z"),
        requiredApprovers: 2,
        requiredRoles: [RTGSApprovalRole.FIRST_APPROVER, RTGSApprovalRole.SECOND_APPROVER],
        approvalThreshold: 500000000n,
        expiresAt: new Date("2025-01-02T00:00:00Z"),
      },
      {
        type: "ApprovalGranted",
        paymentIntentId: baseEvent.paymentIntentId,
        occurredAt: new Date("2025-01-01T00:02:00Z"),
        approverId: "approver-001",
        approverRole: RTGSApprovalRole.FIRST_APPROVER,
        approvalSequence: 1,
      },
    ];

    // Build payment normally
    const paymentBeforeCrash = rebuildRTGSFromEvents(events);
    const hashBeforeCrash = getRTGSPaymentHash(paymentBeforeCrash);

    // Simulate crash and rebuild
    const paymentAfterCrash = rebuildRTGSFromEvents(events);
    const hashAfterCrash = getRTGSPaymentHash(paymentAfterCrash);

    expect(hashAfterCrash).toBe(hashBeforeCrash);
    expect(paymentAfterCrash).toEqual(paymentBeforeCrash);
  });
});
