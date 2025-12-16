/**
 * NPP Ops Actions Tests
 * 
 * Verify policy gates and state guards for operator actions
 */

import { describe, it, expect } from "vitest";
import { NPPPaymentState, NPPFailureReason } from "../core/payments/npp";
import {
  retryPayment,
  cancelPayment,
  markFailed,
} from "../application/payments/npp/ops";

describe("NPP Ops Actions", () => {
  describe("retryPayment", () => {
    it("should allow retry from FAILED state with policy approval", () => {
      const result = retryPayment({
        paymentIntentId: "pay_123",
        currentState: NPPPaymentState.FAILED,
        operatorId: "op_456",
        reason: "Temporary rail outage resolved",
        policyApproval: true,
      });

      expect(result.event.type).toBe("PaymentAttemptCreated");
      expect(result.newAttemptId).toMatch(/^att_/);
    });

    it("should allow retry from EXPIRED state with policy approval", () => {
      const result = retryPayment({
        paymentIntentId: "pay_123",
        currentState: NPPPaymentState.EXPIRED,
        operatorId: "op_456",
        reason: "Customer requested retry",
        policyApproval: true,
      });

      expect(result.event.type).toBe("PaymentAttemptCreated");
    });

    it("should reject retry without policy approval", () => {
      expect(() =>
        retryPayment({
          paymentIntentId: "pay_123",
          currentState: NPPPaymentState.FAILED,
          operatorId: "op_456",
          reason: "Retry",
          policyApproval: false,
        })
      ).toThrow("retry requires policy approval");
    });

    it("should reject retry from non-terminal states", () => {
      expect(() =>
        retryPayment({
          paymentIntentId: "pay_123",
          currentState: NPPPaymentState.SENT,
          operatorId: "op_456",
          reason: "Retry",
          policyApproval: true,
        })
      ).toThrow("retry only allowed from FAILED or EXPIRED");
    });
  });

  describe("cancelPayment", () => {
    it("should allow cancel from AUTHORISED state with policy approval", () => {
      const result = cancelPayment({
        paymentIntentId: "pay_123",
        currentState: NPPPaymentState.AUTHORISED,
        operatorId: "op_456",
        reason: "Customer requested cancellation",
        policyApproval: true,
      });

      expect(result.event.type).toBe("PaymentFailed");
      expect(result.event.reason).toBe(NPPFailureReason.CANCELLED);
    });

    it("should reject cancel without policy approval", () => {
      expect(() =>
        cancelPayment({
          paymentIntentId: "pay_123",
          currentState: NPPPaymentState.AUTHORISED,
          operatorId: "op_456",
          reason: "Cancel",
          policyApproval: false,
        })
      ).toThrow("cancel requires policy approval");
    });

    it("should reject cancel from SENT state (too late)", () => {
      expect(() =>
        cancelPayment({
          paymentIntentId: "pay_123",
          currentState: NPPPaymentState.SENT,
          operatorId: "op_456",
          reason: "Cancel",
          policyApproval: true,
        })
      ).toThrow("cancel only allowed from AUTHORISED");
    });
  });

  describe("markFailed", () => {
    it("should allow mark failed from SENT state with policy approval", () => {
      const result = markFailed({
        paymentIntentId: "pay_123",
        currentState: NPPPaymentState.SENT,
        operatorId: "op_456",
        reason: "Rail timeout detected",
        failureReason: NPPFailureReason.RAIL,
        policyApproval: true,
      });

      expect(result.event.type).toBe("PaymentFailed");
      expect(result.event.reason).toBe(NPPFailureReason.RAIL);
    });

    it("should allow mark failed from ACKNOWLEDGED state (late failure)", () => {
      const result = markFailed({
        paymentIntentId: "pay_123",
        currentState: NPPPaymentState.ACKNOWLEDGED,
        operatorId: "op_456",
        reason: "Settlement never arrived",
        failureReason: NPPFailureReason.POST_ACK,
        policyApproval: true,
      });

      expect(result.event.type).toBe("PaymentFailed");
      expect(result.event.reason).toBe(NPPFailureReason.POST_ACK);
    });

    it("should reject mark failed without policy approval", () => {
      expect(() =>
        markFailed({
          paymentIntentId: "pay_123",
          currentState: NPPPaymentState.SENT,
          operatorId: "op_456",
          reason: "Timeout",
          failureReason: NPPFailureReason.RAIL,
          policyApproval: false,
        })
      ).toThrow("mark failed requires policy approval");
    });

    it("should reject mark failed from AUTHORISED state (not sent yet)", () => {
      expect(() =>
        markFailed({
          paymentIntentId: "pay_123",
          currentState: NPPPaymentState.AUTHORISED,
          operatorId: "op_456",
          reason: "Mark failed",
          failureReason: NPPFailureReason.RAIL,
          policyApproval: true,
        })
      ).toThrow("mark failed only allowed from SENT or ACKNOWLEDGED");
    });
  });
});
