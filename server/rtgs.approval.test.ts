import { describe, it, expect } from "vitest";
import {
  createRTGSPayment,
  applyRTGSEvent,
  RTGSPaymentState,
  RTGSApprovalRole,
} from "../core/payments/rtgs";
import {
  grantApproval,
  GrantApprovalRequest,
} from "../application/payments/rtgs/approval/GrantApprovalHandler";
import {
  rejectApproval,
  RejectApprovalRequest,
} from "../application/payments/rtgs/approval/RejectApprovalHandler";

describe("RTGS Approval Workflow", () => {
  const baseEvent = {
    paymentIntentId: "rtgs-approval-001",
    occurredAt: new Date("2025-01-01T00:00:00Z"),
    amount: 500000000n, // $5M
    currency: "AUD",
    idempotencyKey: "idempotency-001",
    fromAccountId: "acc-001",
    toAccountId: "acc-002",
    bsb: "062-000",
    accountNumber: "12345678",
    initiatorId: "user-001",
    initiatorRole: RTGSApprovalRole.INITIATOR,
  };

  describe("Grant Approval", () => {
    it("should grant first approval", async () => {
      let payment = createRTGSPayment({
        type: "PaymentIntentCreated",
        ...baseEvent,
      });

      // Move to PENDING_APPROVAL
      payment = applyRTGSEvent(payment, {
        type: "ApprovalRequested",
        paymentIntentId: payment.paymentIntentId,
        occurredAt: new Date("2025-01-01T00:01:00Z"),
        requiredApprovers: 2,
        requiredRoles: [RTGSApprovalRole.FIRST_APPROVER, RTGSApprovalRole.SECOND_APPROVER],
        approvalThreshold: 500000000n,
        expiresAt: new Date("2025-01-02T00:00:00Z"),
      });

      const request: GrantApprovalRequest = {
        approverId: "approver-001",
        approverRole: RTGSApprovalRole.FIRST_APPROVER,
        approvalReason: "Verified payment details",
        policyApproval: true,
      };

      const result = await grantApproval(payment, request);

      expect(result.success).toBe(true);
      expect(result.eventsEmitted).toHaveLength(1);
      expect(result.eventsEmitted[0].type).toBe("ApprovalGranted");
      expect(result.dualControlMet).toBe(false); // Only 1 of 2 approvals
    });

    it("should grant second approval and verify dual-control", async () => {
      let payment = createRTGSPayment({
        type: "PaymentIntentCreated",
        ...baseEvent,
      });

      // Move to PENDING_APPROVAL
      payment = applyRTGSEvent(payment, {
        type: "ApprovalRequested",
        paymentIntentId: payment.paymentIntentId,
        occurredAt: new Date("2025-01-01T00:01:00Z"),
        requiredApprovers: 2,
        requiredRoles: [RTGSApprovalRole.FIRST_APPROVER, RTGSApprovalRole.SECOND_APPROVER],
        approvalThreshold: 500000000n,
        expiresAt: new Date("2025-01-02T00:00:00Z"),
      });

      // First approval
      payment = applyRTGSEvent(payment, {
        type: "ApprovalGranted",
        paymentIntentId: payment.paymentIntentId,
        occurredAt: new Date("2025-01-01T00:02:00Z"),
        approverId: "approver-001",
        approverRole: RTGSApprovalRole.FIRST_APPROVER,
        approvalSequence: 1,
      });

      // Second approval
      const request: GrantApprovalRequest = {
        approverId: "approver-002",
        approverRole: RTGSApprovalRole.SECOND_APPROVER,
        approvalReason: "Verified payment details",
        policyApproval: true,
      };

      const result = await grantApproval(payment, request);

      expect(result.success).toBe(true);
      expect(result.eventsEmitted).toHaveLength(2); // ApprovalGranted + DualControlVerified
      expect(result.eventsEmitted[0].type).toBe("ApprovalGranted");
      expect(result.eventsEmitted[1].type).toBe("DualControlVerified");
      expect(result.dualControlMet).toBe(true);
    });

    it("should reject approval from initiator (separation of duties)", async () => {
      let payment = createRTGSPayment({
        type: "PaymentIntentCreated",
        ...baseEvent,
      });

      // Move to PENDING_APPROVAL
      payment = applyRTGSEvent(payment, {
        type: "ApprovalRequested",
        paymentIntentId: payment.paymentIntentId,
        occurredAt: new Date("2025-01-01T00:01:00Z"),
        requiredApprovers: 2,
        requiredRoles: [RTGSApprovalRole.FIRST_APPROVER, RTGSApprovalRole.SECOND_APPROVER],
        approvalThreshold: 500000000n,
        expiresAt: new Date("2025-01-02T00:00:00Z"),
      });

      const request: GrantApprovalRequest = {
        approverId: "user-001", // Same as initiator
        approverRole: RTGSApprovalRole.FIRST_APPROVER,
        approvalReason: "Verified payment details",
        policyApproval: true,
      };

      const result = await grantApproval(payment, request);

      expect(result.success).toBe(false);
      expect(result.error).toContain("separation of duties");
    });

    it("should reject duplicate approval", async () => {
      let payment = createRTGSPayment({
        type: "PaymentIntentCreated",
        ...baseEvent,
      });

      // Move to PENDING_APPROVAL
      payment = applyRTGSEvent(payment, {
        type: "ApprovalRequested",
        paymentIntentId: payment.paymentIntentId,
        occurredAt: new Date("2025-01-01T00:01:00Z"),
        requiredApprovers: 2,
        requiredRoles: [RTGSApprovalRole.FIRST_APPROVER, RTGSApprovalRole.SECOND_APPROVER],
        approvalThreshold: 500000000n,
        expiresAt: new Date("2025-01-02T00:00:00Z"),
      });

      // First approval
      payment = applyRTGSEvent(payment, {
        type: "ApprovalGranted",
        paymentIntentId: payment.paymentIntentId,
        occurredAt: new Date("2025-01-01T00:02:00Z"),
        approverId: "approver-001",
        approverRole: RTGSApprovalRole.FIRST_APPROVER,
        approvalSequence: 1,
      });

      // Try to approve again
      const request: GrantApprovalRequest = {
        approverId: "approver-001", // Same approver
        approverRole: RTGSApprovalRole.FIRST_APPROVER,
        approvalReason: "Verified payment details",
        policyApproval: true,
      };

      const result = await grantApproval(payment, request);

      expect(result.success).toBe(false);
      expect(result.error).toContain("DUPLICATE_APPROVAL");
    });
  });

  describe("Reject Approval", () => {
    it("should reject approval with reason", async () => {
      let payment = createRTGSPayment({
        type: "PaymentIntentCreated",
        ...baseEvent,
      });

      // Move to PENDING_APPROVAL
      payment = applyRTGSEvent(payment, {
        type: "ApprovalRequested",
        paymentIntentId: payment.paymentIntentId,
        occurredAt: new Date("2025-01-01T00:01:00Z"),
        requiredApprovers: 2,
        requiredRoles: [RTGSApprovalRole.FIRST_APPROVER, RTGSApprovalRole.SECOND_APPROVER],
        approvalThreshold: 500000000n,
        expiresAt: new Date("2025-01-02T00:00:00Z"),
      });

      const request: RejectApprovalRequest = {
        rejectedBy: "approver-001",
        rejectorRole: RTGSApprovalRole.FIRST_APPROVER,
        rejectionReason: "Insufficient documentation",
        policyApproval: true,
      };

      const result = await rejectApproval(payment, request);

      expect(result.success).toBe(true);
      expect(result.eventsEmitted).toHaveLength(1);
      expect(result.eventsEmitted[0].type).toBe("ApprovalRejected");
      expect(result.fundsReleased).toBe(payment.fundsEarmarked);
    });

    it("should require rejection reason", async () => {
      let payment = createRTGSPayment({
        type: "PaymentIntentCreated",
        ...baseEvent,
      });

      // Move to PENDING_APPROVAL
      payment = applyRTGSEvent(payment, {
        type: "ApprovalRequested",
        paymentIntentId: payment.paymentIntentId,
        occurredAt: new Date("2025-01-01T00:01:00Z"),
        requiredApprovers: 2,
        requiredRoles: [RTGSApprovalRole.FIRST_APPROVER, RTGSApprovalRole.SECOND_APPROVER],
        approvalThreshold: 500000000n,
        expiresAt: new Date("2025-01-02T00:00:00Z"),
      });

      const request: RejectApprovalRequest = {
        rejectedBy: "approver-001",
        rejectorRole: RTGSApprovalRole.FIRST_APPROVER,
        rejectionReason: "", // Empty reason
        policyApproval: true,
      };

      const result = await rejectApproval(payment, request);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Rejection reason is required");
    });
  });
});
