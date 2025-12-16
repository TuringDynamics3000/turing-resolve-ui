/**
 * BECS Operator Actions Tests
 * 
 * These tests verify that BECS operator actions (batch resubmission,
 * manual return processing, batch cancellation) enforce policy gates,
 * state guards, and invariants correctly.
 * 
 * Test Categories:
 * 1. Batch Resubmission Tests
 * 2. Manual Return Processing Tests
 * 3. Batch Cancellation Tests
 * 4. Policy Gate Enforcement
 */

import { describe, it, expect } from "vitest";
import {
  createBECSPayment,
  applyBECSEvent,
  BECSPaymentState,
  BECSReturnCode,
  BECSFailureReason,
} from "../core/payments/becs";
import type { BECSPaymentEvent } from "../core/payments/becs";
import {
  resubmitBatch,
  validateResubmitBatchRequest,
} from "../application/payments/becs/ops/ResubmitBatchHandler";
import {
  processReturn,
  validateProcessReturnRequest,
} from "../application/payments/becs/ops/ProcessReturnHandler";
import {
  cancelBatch,
  validateCancelBatchRequest,
} from "../application/payments/becs/ops/CancelBatchHandler";

describe("BECS Operator Actions", () => {
  describe("Category 1: Batch Resubmission Tests", () => {
    it("should resubmit failed batch with policy approval", async () => {
      // Create a failed payment
      let payment = createBECSPayment({
        type: "PaymentIntentCreated",
        paymentIntentId: "pay_001",
        occurredAt: new Date(),
        amount: 50000n,
        currency: "AUD",
        idempotencyKey: "idem_001",
        fromAccountId: "acc_from",
        toAccountId: "acc_to",
        bsb: "123-456",
        accountNumber: "12345678",
      });

      // Authorize
      payment = applyBECSEvent(payment, {
        type: "PaymentAuthorised",
        paymentIntentId: "pay_001",
        occurredAt: new Date(),
        policyChecksPassed: true,
        fundsEarmarked: 50000n,
      });

      // Batch
      payment = applyBECSEvent(payment, {
        type: "PaymentBatched",
        paymentIntentId: "pay_001",
        occurredAt: new Date(),
        batchId: "batch_001",
        batchDate: "2025-12-17",
        sequenceNumber: 1,
        fundsHeld: 50000n,
      });

      // Fail
      payment = applyBECSEvent(payment, {
        type: "PaymentFailed",
        paymentIntentId: "pay_001",
        occurredAt: new Date(),
        batchId: "batch_001",
        reason: BECSFailureReason.RAIL,
        fundsReleased: 50000n,
      });

      expect(payment.state).toBe(BECSPaymentState.FAILED);

      // Resubmit batch
      const result = await resubmitBatch(payment, {
        batchId: "batch_001",
        operatorId: "op_123",
        reason: "Temporary rail outage resolved",
        policyApproval: true,
      });

      expect(result.success).toBe(true);
      expect(result.newBatchId).toBeDefined();
      expect(result.eventsEmitted).toHaveLength(3); // Authorised, Batched, Submitted
      expect(result.eventsEmitted[0].type).toBe("PaymentAuthorised");
      expect(result.eventsEmitted[1].type).toBe("PaymentBatched");
      expect(result.eventsEmitted[2].type).toBe("BatchSubmitted");
    });

    it("should reject resubmission without policy approval", async () => {
      let payment = createBECSPayment({
        type: "PaymentIntentCreated",
        paymentIntentId: "pay_002",
        occurredAt: new Date(),
        amount: 50000n,
        currency: "AUD",
        idempotencyKey: "idem_002",
        fromAccountId: "acc_from",
        toAccountId: "acc_to",
        bsb: "123-456",
        accountNumber: "12345678",
      });

      payment = applyBECSEvent(payment, {
        type: "PaymentFailed",
        paymentIntentId: "pay_002",
        occurredAt: new Date(),
        batchId: "batch_002",
        reason: BECSFailureReason.RAIL,
        fundsReleased: 50000n,
      });

      const result = await resubmitBatch(payment, {
        batchId: "batch_002",
        operatorId: "op_123",
        reason: "Retry",
        policyApproval: false, // No approval
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("POLICY_DENIED");
    });

    it("should reject resubmission from non-FAILED state", async () => {
      let payment = createBECSPayment({
        type: "PaymentIntentCreated",
        paymentIntentId: "pay_003",
        occurredAt: new Date(),
        amount: 50000n,
        currency: "AUD",
        idempotencyKey: "idem_003",
        fromAccountId: "acc_from",
        toAccountId: "acc_to",
        bsb: "123-456",
        accountNumber: "12345678",
      });

      payment = applyBECSEvent(payment, {
        type: "PaymentAuthorised",
        paymentIntentId: "pay_003",
        occurredAt: new Date(),
        policyChecksPassed: true,
        fundsEarmarked: 50000n,
      });

      const result = await resubmitBatch(payment, {
        batchId: "batch_003",
        operatorId: "op_123",
        reason: "Retry",
        policyApproval: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("INVALID_STATE");
    });
  });

  describe("Category 2: Manual Return Processing Tests", () => {
    it("should process return from CLEARED state with policy approval", async () => {
      let payment = createBECSPayment({
        type: "PaymentIntentCreated",
        paymentIntentId: "pay_004",
        occurredAt: new Date(),
        amount: 50000n,
        currency: "AUD",
        idempotencyKey: "idem_004",
        fromAccountId: "acc_from",
        toAccountId: "acc_to",
        bsb: "123-456",
        accountNumber: "12345678",
      });

      payment = applyBECSEvent(payment, {
        type: "PaymentAuthorised",
        paymentIntentId: "pay_004",
        occurredAt: new Date(),
        policyChecksPassed: true,
        fundsEarmarked: 50000n,
      });

      payment = applyBECSEvent(payment, {
        type: "PaymentBatched",
        paymentIntentId: "pay_004",
        occurredAt: new Date(),
        batchId: "batch_004",
        batchDate: "2025-12-17",
        sequenceNumber: 1,
        fundsHeld: 50000n,
      });

      payment = applyBECSEvent(payment, {
        type: "BatchSubmitted",
        paymentIntentId: "pay_004",
        occurredAt: new Date(),
        batchId: "batch_004",
        fileReference: "file_004",
        declaredTotal: 50000n,
        itemCount: 1,
      });

      payment = applyBECSEvent(payment, {
        type: "PaymentCleared",
        paymentIntentId: "pay_004",
        occurredAt: new Date(),
        batchId: "batch_004",
        clearingDate: "2025-12-18",
        fundsProvisional: 50000n,
      });

      expect(payment.state).toBe(BECSPaymentState.CLEARED);

      const result = await processReturn(payment, {
        paymentIntentId: "pay_004",
        operatorId: "op_123",
        returnCode: BECSReturnCode.INSUFFICIENT_FUNDS,
        returnReason: "Insufficient funds",
        policyApproval: true,
      });

      expect(result.success).toBe(true);
      expect(result.eventsEmitted).toHaveLength(1);
      expect(result.eventsEmitted[0].type).toBe("PaymentReturned");
      expect(result.fundsReversed).toBe(50000n);
    });

    it("should reject return without policy approval", async () => {
      let payment = createBECSPayment({
        type: "PaymentIntentCreated",
        paymentIntentId: "pay_005",
        occurredAt: new Date(),
        amount: 50000n,
        currency: "AUD",
        idempotencyKey: "idem_005",
        fromAccountId: "acc_from",
        toAccountId: "acc_to",
        bsb: "123-456",
        accountNumber: "12345678",
      });

      payment = applyBECSEvent(payment, {
        type: "PaymentAuthorised",
        paymentIntentId: "pay_005",
        occurredAt: new Date(),
        policyChecksPassed: true,
        fundsEarmarked: 50000n,
      });

      payment = applyBECSEvent(payment, {
        type: "PaymentBatched",
        paymentIntentId: "pay_005",
        occurredAt: new Date(),
        batchId: "batch_005",
        batchDate: "2025-12-17",
        sequenceNumber: 1,
        fundsHeld: 50000n,
      });

      payment = applyBECSEvent(payment, {
        type: "BatchSubmitted",
        paymentIntentId: "pay_005",
        occurredAt: new Date(),
        batchId: "batch_005",
        fileReference: "file_005",
        declaredTotal: 50000n,
        itemCount: 1,
      });

      payment = applyBECSEvent(payment, {
        type: "PaymentCleared",
        paymentIntentId: "pay_005",
        occurredAt: new Date(),
        batchId: "batch_005",
        clearingDate: "2025-12-18",
        fundsProvisional: 50000n,
      });

      const result = await processReturn(payment, {
        paymentIntentId: "pay_005",
        operatorId: "op_123",
        returnCode: BECSReturnCode.INSUFFICIENT_FUNDS,
        returnReason: "Insufficient funds",
        policyApproval: false, // No approval
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("POLICY_DENIED");
    });

    it("should reject return from non-CLEARED state", async () => {
      let payment = createBECSPayment({
        type: "PaymentIntentCreated",
        paymentIntentId: "pay_006",
        occurredAt: new Date(),
        amount: 50000n,
        currency: "AUD",
        idempotencyKey: "idem_006",
        fromAccountId: "acc_from",
        toAccountId: "acc_to",
        bsb: "123-456",
        accountNumber: "12345678",
      });

      payment = applyBECSEvent(payment, {
        type: "PaymentAuthorised",
        paymentIntentId: "pay_006",
        occurredAt: new Date(),
        policyChecksPassed: true,
        fundsEarmarked: 50000n,
      });

      const result = await processReturn(payment, {
        paymentIntentId: "pay_006",
        operatorId: "op_123",
        returnCode: BECSReturnCode.INSUFFICIENT_FUNDS,
        returnReason: "Insufficient funds",
        policyApproval: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("INVALID_STATE");
    });
  });

  describe("Category 3: Batch Cancellation Tests", () => {
    it("should cancel batch from BATCHED state with policy approval", async () => {
      let payment = createBECSPayment({
        type: "PaymentIntentCreated",
        paymentIntentId: "pay_007",
        occurredAt: new Date(),
        amount: 50000n,
        currency: "AUD",
        idempotencyKey: "idem_007",
        fromAccountId: "acc_from",
        toAccountId: "acc_to",
        bsb: "123-456",
        accountNumber: "12345678",
      });

      payment = applyBECSEvent(payment, {
        type: "PaymentAuthorised",
        paymentIntentId: "pay_007",
        occurredAt: new Date(),
        policyChecksPassed: true,
        fundsEarmarked: 50000n,
      });

      payment = applyBECSEvent(payment, {
        type: "PaymentBatched",
        paymentIntentId: "pay_007",
        occurredAt: new Date(),
        batchId: "batch_007",
        batchDate: "2025-12-17",
        sequenceNumber: 1,
        fundsHeld: 50000n,
      });

      expect(payment.state).toBe(BECSPaymentState.BATCHED);

      const result = await cancelBatch(payment, {
        batchId: "batch_007",
        operatorId: "op_123",
        reason: "Duplicate batch detected",
        policyApproval: true,
      });

      expect(result.success).toBe(true);
      expect(result.eventsEmitted).toHaveLength(1);
      expect(result.eventsEmitted[0].type).toBe("PaymentFailed");
      expect(result.fundsReleased).toBe(50000n);
    });

    it("should cancel batch from SUBMITTED state with policy approval", async () => {
      let payment = createBECSPayment({
        type: "PaymentIntentCreated",
        paymentIntentId: "pay_008",
        occurredAt: new Date(),
        amount: 50000n,
        currency: "AUD",
        idempotencyKey: "idem_008",
        fromAccountId: "acc_from",
        toAccountId: "acc_to",
        bsb: "123-456",
        accountNumber: "12345678",
      });

      payment = applyBECSEvent(payment, {
        type: "PaymentAuthorised",
        paymentIntentId: "pay_008",
        occurredAt: new Date(),
        policyChecksPassed: true,
        fundsEarmarked: 50000n,
      });

      payment = applyBECSEvent(payment, {
        type: "PaymentBatched",
        paymentIntentId: "pay_008",
        occurredAt: new Date(),
        batchId: "batch_008",
        batchDate: "2025-12-17",
        sequenceNumber: 1,
        fundsHeld: 50000n,
      });

      payment = applyBECSEvent(payment, {
        type: "BatchSubmitted",
        paymentIntentId: "pay_008",
        occurredAt: new Date(),
        batchId: "batch_008",
        fileReference: "file_008",
        declaredTotal: 50000n,
        itemCount: 1,
      });

      expect(payment.state).toBe(BECSPaymentState.SUBMITTED);

      const result = await cancelBatch(payment, {
        batchId: "batch_008",
        operatorId: "op_123",
        reason: "Incorrect batch file",
        policyApproval: true,
      });

      expect(result.success).toBe(true);
      expect(result.eventsEmitted).toHaveLength(1);
      expect(result.eventsEmitted[0].type).toBe("PaymentFailed");
    });

    it("should reject cancellation without policy approval", async () => {
      let payment = createBECSPayment({
        type: "PaymentIntentCreated",
        paymentIntentId: "pay_009",
        occurredAt: new Date(),
        amount: 50000n,
        currency: "AUD",
        idempotencyKey: "idem_009",
        fromAccountId: "acc_from",
        toAccountId: "acc_to",
        bsb: "123-456",
        accountNumber: "12345678",
      });

      payment = applyBECSEvent(payment, {
        type: "PaymentAuthorised",
        paymentIntentId: "pay_009",
        occurredAt: new Date(),
        policyChecksPassed: true,
        fundsEarmarked: 50000n,
      });

      payment = applyBECSEvent(payment, {
        type: "PaymentBatched",
        paymentIntentId: "pay_009",
        occurredAt: new Date(),
        batchId: "batch_009",
        batchDate: "2025-12-17",
        sequenceNumber: 1,
        fundsHeld: 50000n,
      });

      const result = await cancelBatch(payment, {
        batchId: "batch_009",
        operatorId: "op_123",
        reason: "Cancel",
        policyApproval: false, // No approval
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("POLICY_DENIED");
    });

    it("should reject cancellation from CLEARED state", async () => {
      let payment = createBECSPayment({
        type: "PaymentIntentCreated",
        paymentIntentId: "pay_010",
        occurredAt: new Date(),
        amount: 50000n,
        currency: "AUD",
        idempotencyKey: "idem_010",
        fromAccountId: "acc_from",
        toAccountId: "acc_to",
        bsb: "123-456",
        accountNumber: "12345678",
      });

      payment = applyBECSEvent(payment, {
        type: "PaymentAuthorised",
        paymentIntentId: "pay_010",
        occurredAt: new Date(),
        policyChecksPassed: true,
        fundsEarmarked: 50000n,
      });

      payment = applyBECSEvent(payment, {
        type: "PaymentBatched",
        paymentIntentId: "pay_010",
        occurredAt: new Date(),
        batchId: "batch_010",
        batchDate: "2025-12-17",
        sequenceNumber: 1,
        fundsHeld: 50000n,
      });

      payment = applyBECSEvent(payment, {
        type: "BatchSubmitted",
        paymentIntentId: "pay_010",
        occurredAt: new Date(),
        batchId: "batch_010",
        fileReference: "file_010",
        declaredTotal: 50000n,
        itemCount: 1,
      });

      payment = applyBECSEvent(payment, {
        type: "PaymentCleared",
        paymentIntentId: "pay_010",
        occurredAt: new Date(),
        batchId: "batch_010",
        clearingDate: "2025-12-18",
        fundsProvisional: 50000n,
      });

      const result = await cancelBatch(payment, {
        batchId: "batch_010",
        operatorId: "op_123",
        reason: "Cancel",
        policyApproval: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("INVALID_STATE");
    });
  });

  describe("Category 4: Policy Gate Enforcement", () => {
    it("should validate resubmit batch request", () => {
      const valid = validateResubmitBatchRequest({
        batchId: "batch_001",
        operatorId: "op_123",
        reason: "Retry",
        policyApproval: true,
      });

      expect(valid.valid).toBe(true);
      expect(valid.errors).toHaveLength(0);
    });

    it("should reject invalid resubmit batch request", () => {
      const invalid = validateResubmitBatchRequest({
        batchId: "",
        operatorId: "",
        reason: "",
        policyApproval: false,
      });

      expect(invalid.valid).toBe(false);
      expect(invalid.errors.length).toBeGreaterThan(0);
    });

    it("should validate process return request", () => {
      const valid = validateProcessReturnRequest({
        paymentIntentId: "pay_001",
        operatorId: "op_123",
        returnCode: BECSReturnCode.INSUFFICIENT_FUNDS,
        returnReason: "Insufficient funds",
        policyApproval: true,
      });

      expect(valid.valid).toBe(true);
      expect(valid.errors).toHaveLength(0);
    });

    it("should reject invalid process return request", () => {
      const invalid = validateProcessReturnRequest({
        paymentIntentId: "",
        operatorId: "",
        returnCode: "" as any,
        returnReason: "",
        policyApproval: false,
      });

      expect(invalid.valid).toBe(false);
      expect(invalid.errors.length).toBeGreaterThan(0);
    });

    it("should validate cancel batch request", () => {
      const valid = validateCancelBatchRequest({
        batchId: "batch_001",
        operatorId: "op_123",
        reason: "Duplicate",
        policyApproval: true,
      });

      expect(valid.valid).toBe(true);
      expect(valid.errors).toHaveLength(0);
    });

    it("should reject invalid cancel batch request", () => {
      const invalid = validateCancelBatchRequest({
        batchId: "",
        operatorId: "",
        reason: "",
        policyApproval: false,
      });

      expect(invalid.valid).toBe(false);
      expect(invalid.errors.length).toBeGreaterThan(0);
    });
  });
});
