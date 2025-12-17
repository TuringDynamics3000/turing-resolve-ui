import { describe, it, expect } from "vitest";
import {
  createRTGSPayment,
  applyRTGSEvent,
  RTGSPaymentState,
  RTGSApprovalRole,
  assertApprovalBeforeSend,
  assertDualControl,
  assertSeparationOfDuties,
  assertRequiredRoles,
  assertApprovalNotExpired,
  ApprovalRecord,
} from "../core/payments/rtgs";

describe("RTGS Invariants", () => {
  const baseEvent = {
    paymentIntentId: "rtgs-test-001",
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

  describe("Approval Invariants", () => {
    it("should enforce no SEND without APPROVED", () => {
      const payment = createRTGSPayment({
        type: "PaymentIntentCreated",
        ...baseEvent,
      });

      expect(() => {
        assertApprovalBeforeSend(RTGSPaymentState.SENT, []);
      }).toThrow("Cannot send RTGS payment without approvals");
    });

    it("should allow SEND with approvals", () => {
      const approvals: ApprovalRecord[] = [
        {
          approverId: "approver-001",
          approverRole: RTGSApprovalRole.FIRST_APPROVER,
          approvedAt: new Date(),
        },
        {
          approverId: "approver-002",
          approverRole: RTGSApprovalRole.SECOND_APPROVER,
          approvedAt: new Date(),
        },
      ];

      expect(() => {
        assertApprovalBeforeSend(RTGSPaymentState.SENT, approvals);
      }).not.toThrow();
    });

    it("should enforce dual-control (minimum 2 approvers)", () => {
      const singleApproval: ApprovalRecord[] = [
        {
          approverId: "approver-001",
          approverRole: RTGSApprovalRole.FIRST_APPROVER,
          approvedAt: new Date(),
        },
      ];

      expect(() => {
        assertDualControl(singleApproval, 2);
      }).toThrow("INVARIANT_VIOLATION");
    });

    it("should reject duplicate approvals", () => {
      const duplicateApprovals: ApprovalRecord[] = [
        {
          approverId: "approver-001",
          approverRole: RTGSApprovalRole.FIRST_APPROVER,
          approvedAt: new Date(),
        },
        {
          approverId: "approver-001", // Same approver
          approverRole: RTGSApprovalRole.SECOND_APPROVER,
          approvedAt: new Date(),
        },
      ];

      expect(() => {
        assertDualControl(duplicateApprovals, 2);
      }).toThrow("All approvers must be unique");
    });

    it("should enforce separation of duties", () => {
      const initiatorId = "user-001";
      const approvalsWithInitiator: ApprovalRecord[] = [
        {
          approverId: "user-001", // Same as initiator
          approverRole: RTGSApprovalRole.FIRST_APPROVER,
          approvedAt: new Date(),
        },
      ];

      expect(() => {
        assertSeparationOfDuties(initiatorId, approvalsWithInitiator);
      }).toThrow("Initiator cannot approve their own payment");
    });

    it("should allow approvals from different users", () => {
      const initiatorId = "user-001";
      const validApprovals: ApprovalRecord[] = [
        {
          approverId: "approver-001",
          approverRole: RTGSApprovalRole.FIRST_APPROVER,
          approvedAt: new Date(),
        },
        {
          approverId: "approver-002",
          approverRole: RTGSApprovalRole.SECOND_APPROVER,
          approvedAt: new Date(),
        },
      ];

      expect(() => {
        assertSeparationOfDuties(initiatorId, validApprovals);
      }).not.toThrow();
    });

    it("should enforce required roles", () => {
      const approvals: ApprovalRecord[] = [
        {
          approverId: "approver-001",
          approverRole: RTGSApprovalRole.FIRST_APPROVER,
          approvedAt: new Date(),
        },
      ];

      const requiredRoles = [
        RTGSApprovalRole.FIRST_APPROVER,
        RTGSApprovalRole.SECOND_APPROVER,
      ];

      expect(() => {
        assertRequiredRoles(approvals, requiredRoles);
      }).toThrow("INVARIANT_VIOLATION");
    });

    it("should validate all required roles present", () => {
      const approvals: ApprovalRecord[] = [
        {
          approverId: "approver-001",
          approverRole: RTGSApprovalRole.FIRST_APPROVER,
          approvedAt: new Date(),
        },
        {
          approverId: "approver-002",
          approverRole: RTGSApprovalRole.SECOND_APPROVER,
          approvedAt: new Date(),
        },
      ];

      const requiredRoles = [
        RTGSApprovalRole.FIRST_APPROVER,
        RTGSApprovalRole.SECOND_APPROVER,
      ];

      expect(() => {
        assertRequiredRoles(approvals, requiredRoles);
      }).not.toThrow();
    });
  });

  describe("Temporal Invariants", () => {
    it("should reject expired approvals", () => {
      const expiredDate = new Date("2024-01-01T00:00:00Z");
      const now = new Date("2025-01-01T00:00:00Z");

      expect(() => {
        assertApprovalNotExpired(expiredDate, now);
      }).toThrow("Approval expired");
    });

    it("should allow non-expired approvals", () => {
      const futureDate = new Date("2026-01-01T00:00:00Z");
      const now = new Date("2025-01-01T00:00:00Z");

      expect(() => {
        assertApprovalNotExpired(futureDate, now);
      }).not.toThrow();
    });
  });
});
