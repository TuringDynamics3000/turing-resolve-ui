/**
 * BECS Replay Guarantee Tests
 * 
 * These tests prove that BECS payment state can be deterministically rebuilt from events.
 * 
 * Key Guarantees:
 * 1. rebuildFromEvents(events) === originalState
 * 2. hash(rebuiltState) === hash(originalState)
 * 3. Same events in same order → identical state
 * 4. Replay is deterministic (multiple replays produce same result)
 * 
 * This is critical for:
 * - Crash recovery
 * - Audit trail verification
 * - Regulator evidence
 */

import { describe, it, expect } from "vitest";
import {
  createBECSPayment,
  applyBECSEvent,
  rebuildBECSFromEvents,
  computeBECSStateHash,
  BECSPaymentState,
  BECSFailureReason,
  BECSReturnCode,
} from "../core/payments/becs";
import type { BECSPaymentEvent } from "../core/payments/becs";

describe("BECS Replay Guarantees", () => {
  it("should replay happy path: CREATED → SETTLED", () => {
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

    // Build state step-by-step
    let payment = createBECSPayment(events[0]);
    const originalHash = computeBECSStateHash(payment);

    for (let i = 1; i < events.length; i++) {
      payment = applyBECSEvent(payment, events[i]);
    }

    expect(payment.state).toBe(BECSPaymentState.SETTLED);

    // Rebuild from events
    const rebuilt = rebuildBECSFromEvents(events);

    // Verify state matches
    expect(rebuilt.state).toBe(payment.state);
    expect(rebuilt.paymentIntentId).toBe(payment.paymentIntentId);
    expect(rebuilt.amount).toBe(payment.amount);
    expect(rebuilt.batchId).toBe(payment.batchId);

    // Verify hash matches
    const rebuiltHash = computeBECSStateHash(rebuilt);
    const finalHash = computeBECSStateHash(payment);
    expect(rebuiltHash).toBe(finalHash);
  });

  it("should replay failure path: CREATED → FAILED", () => {
    const events: BECSPaymentEvent[] = [
      {
        type: "PaymentIntentCreated",
        paymentIntentId: "pay_002",
        occurredAt: new Date("2025-12-17T10:00:00Z"),
        amount: 50000n,
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
        fundsEarmarked: 50000n,
      },
      {
        type: "PaymentBatched",
        paymentIntentId: "pay_002",
        occurredAt: new Date("2025-12-17T16:00:00Z"),
        batchId: "batch_001",
        batchDate: "2025-12-17",
        sequenceNumber: 2,
        fundsHeld: 50000n,
      },
      {
        type: "PaymentFailed",
        paymentIntentId: "pay_002",
        occurredAt: new Date("2025-12-17T17:00:00Z"),
        batchId: "batch_001",
        reason: BECSFailureReason.FILE_REJECTED,
        fundsReleased: 50000n,
      },
    ];

    const rebuilt = rebuildBECSFromEvents(events);

    expect(rebuilt.state).toBe(BECSPaymentState.FAILED);
    expect(rebuilt.batchId).toBe("batch_001");
  });

  it("should replay late return: CLEARED → RETURNED", () => {
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
        sequenceNumber: 3,
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

    const rebuilt = rebuildBECSFromEvents(events);

    expect(rebuilt.state).toBe(BECSPaymentState.RETURNED);
    expect(rebuilt.returnCode).toBe(BECSReturnCode.INSUFFICIENT_FUNDS);
    expect(rebuilt.returnReason).toBe("Insufficient funds");
  });

  it("should replay partial events (intermediate state)", () => {
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
        sequenceNumber: 4,
        fundsHeld: 50000n,
      },
    ];

    // Replay first 2 events → AUTHORISED
    const partial1 = rebuildBECSFromEvents(events.slice(0, 2));
    expect(partial1.state).toBe(BECSPaymentState.AUTHORISED);

    // Replay all 3 events → BATCHED
    const partial2 = rebuildBECSFromEvents(events);
    expect(partial2.state).toBe(BECSPaymentState.BATCHED);
    expect(partial2.batchId).toBe("batch_001");
  });

  it("should produce identical hash on multiple replays", () => {
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

    // Replay 10 times
    const hashes = [];
    for (let i = 0; i < 10; i++) {
      const rebuilt = rebuildBECSFromEvents(events);
      const hash = computeBECSStateHash(rebuilt);
      hashes.push(hash);
    }

    // All hashes should be identical
    const uniqueHashes = new Set(hashes);
    expect(uniqueHashes.size).toBe(1);
  });

  it("should enforce event order determinism", () => {
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
      {
        type: "PaymentBatched",
        paymentIntentId: "pay_006",
        occurredAt: new Date("2025-12-17T16:00:00Z"),
        batchId: "batch_001",
        batchDate: "2025-12-17",
        sequenceNumber: 5,
        fundsHeld: 50000n,
      },
    ];

    const hash1 = computeBECSStateHash(rebuildBECSFromEvents(events));
    const hash2 = computeBECSStateHash(rebuildBECSFromEvents(events));

    // Same events in same order → same hash
    expect(hash1).toBe(hash2);
  });
});
