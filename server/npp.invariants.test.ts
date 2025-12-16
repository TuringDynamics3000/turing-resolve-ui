/**
 * NPP Invariants Tests - CI-Blocking
 * 
 * These tests enforce all NPP invariants.
 * Any failure = merge blocked.
 */

import { describe, test, expect } from "vitest";
import {
  NPPPaymentState,
  NPPPaymentEventUnion,
  assertLegalTransition,
  assertNotTerminal,
  assertPositiveAmount,
  assertSingleSettlement,
  assertFundsConsistency,
  assertAUDCurrency,
  assertIdempotentIntent,
  assertAckNotSettlement,
  assertExpiryReason,
  checkInvariants,
  IllegalTransitionError,
  InvariantViolationError,
} from "../core/payments/npp";

describe("NPP State Transition Invariants", () => {
  test("legal transitions are allowed", () => {
    expect(() =>
      assertLegalTransition(NPPPaymentState.CREATED, NPPPaymentState.AUTHORISED)
    ).not.toThrow();

    expect(() =>
      assertLegalTransition(NPPPaymentState.AUTHORISED, NPPPaymentState.SENT)
    ).not.toThrow();

    expect(() =>
      assertLegalTransition(NPPPaymentState.SENT, NPPPaymentState.ACKNOWLEDGED)
    ).not.toThrow();

    expect(() =>
      assertLegalTransition(NPPPaymentState.ACKNOWLEDGED, NPPPaymentState.SETTLED)
    ).not.toThrow();
  });

  test("illegal transitions throw IllegalTransitionError", () => {
    expect(() =>
      assertLegalTransition(NPPPaymentState.SETTLED, NPPPaymentState.SENT)
    ).toThrow(IllegalTransitionError);

    expect(() =>
      assertLegalTransition(NPPPaymentState.FAILED, NPPPaymentState.AUTHORISED)
    ).toThrow(IllegalTransitionError);

    expect(() =>
      assertLegalTransition(NPPPaymentState.ACKNOWLEDGED, NPPPaymentState.CREATED)
    ).toThrow(IllegalTransitionError);
  });

  test("terminal states cannot transition", () => {
    expect(() => assertNotTerminal(NPPPaymentState.SETTLED)).toThrow(
      InvariantViolationError
    );

    expect(() => assertNotTerminal(NPPPaymentState.FAILED)).toThrow(
      InvariantViolationError
    );

    expect(() => assertNotTerminal(NPPPaymentState.EXPIRED)).toThrow(
      InvariantViolationError
    );
  });

  test("non-terminal states can transition", () => {
    expect(() => assertNotTerminal(NPPPaymentState.CREATED)).not.toThrow();
    expect(() => assertNotTerminal(NPPPaymentState.AUTHORISED)).not.toThrow();
    expect(() => assertNotTerminal(NPPPaymentState.SENT)).not.toThrow();
    expect(() => assertNotTerminal(NPPPaymentState.ACKNOWLEDGED)).not.toThrow();
  });
});

describe("NPP Economic Invariants", () => {
  test("positive amounts are allowed", () => {
    expect(() => assertPositiveAmount(100n)).not.toThrow();
    expect(() => assertPositiveAmount(1n)).not.toThrow();
  });

  test("zero and negative amounts throw", () => {
    expect(() => assertPositiveAmount(0n)).toThrow(InvariantViolationError);
    expect(() => assertPositiveAmount(-100n)).toThrow(InvariantViolationError);
  });

  test("single settlement is allowed", () => {
    const events: NPPPaymentEventUnion[] = [
      {
        type: "PaymentIntentCreated",
        paymentIntentId: "p1",
        occurredAt: new Date(),
        amount: 100n,
        currency: "AUD",
        idempotencyKey: "ik1",
        fromAccountId: "a1",
        toAccountId: "a2",
      },
      {
        type: "PaymentSettled",
        paymentIntentId: "p1",
        occurredAt: new Date(),
        attemptId: "att1",
        settlementRef: "ref1",
        fundsMoved: 100n,
      },
    ];

    expect(() => assertSingleSettlement(events)).not.toThrow();
  });

  test("multiple settlements throw", () => {
    const events: NPPPaymentEventUnion[] = [
      {
        type: "PaymentSettled",
        paymentIntentId: "p1",
        occurredAt: new Date(),
        attemptId: "att1",
        settlementRef: "ref1",
        fundsMoved: 100n,
      },
      {
        type: "PaymentSettled",
        paymentIntentId: "p1",
        occurredAt: new Date(),
        attemptId: "att2",
        settlementRef: "ref2",
        fundsMoved: 100n,
      },
    ];

    expect(() => assertSingleSettlement(events)).toThrow(InvariantViolationError);
  });

  test("funds consistency enforced", () => {
    expect(() => assertFundsConsistency(100n, 100n)).not.toThrow();

    expect(() => assertFundsConsistency(100n, 50n)).toThrow(
      InvariantViolationError
    );
  });

  test("currency locked to AUD", () => {
    expect(() => assertAUDCurrency("AUD")).not.toThrow();

    expect(() => assertAUDCurrency("USD")).toThrow(InvariantViolationError);
    expect(() => assertAUDCurrency("EUR")).toThrow(InvariantViolationError);
  });
});

describe("NPP Idempotency Invariants", () => {
  test("duplicate idempotency key returns existing", () => {
    const existing = { id: "p1", amount: 100n };
    const result = assertIdempotentIntent(existing, "ik1", "ik1");

    expect(result).toBe(existing);
  });

  test("different idempotency key returns null", () => {
    const existing = { id: "p1", amount: 100n };
    const result = assertIdempotentIntent(existing, "ik2", "ik1");

    expect(result).toBeNull();
  });

  test("no existing returns null", () => {
    const result = assertIdempotentIntent(null, "ik1", undefined);

    expect(result).toBeNull();
  });
});

describe("NPP-Specific Invariants", () => {
  test("ACK can only progress to SETTLED or FAILED", () => {
    const settledEvent: NPPPaymentEventUnion = {
      type: "PaymentSettled",
      paymentIntentId: "p1",
      occurredAt: new Date(),
      attemptId: "att1",
      settlementRef: "ref1",
      fundsMoved: 100n,
    };

    const failedEvent: NPPPaymentEventUnion = {
      type: "PaymentFailed",
      paymentIntentId: "p1",
      occurredAt: new Date(),
      reason: "RAIL",
      fundsReleased: 100n,
    };

    expect(() =>
      assertAckNotSettlement(NPPPaymentState.ACKNOWLEDGED, settledEvent)
    ).not.toThrow();

    expect(() =>
      assertAckNotSettlement(NPPPaymentState.ACKNOWLEDGED, failedEvent)
    ).not.toThrow();
  });

  test("ACK cannot progress to other states", () => {
    const sentEvent: NPPPaymentEventUnion = {
      type: "PaymentSentToRail",
      paymentIntentId: "p1",
      occurredAt: new Date(),
      attemptId: "att1",
      fundsHeld: 100n,
    };

    expect(() =>
      assertAckNotSettlement(NPPPaymentState.ACKNOWLEDGED, sentEvent)
    ).toThrow(InvariantViolationError);
  });

  test("valid expiry reasons allowed", () => {
    expect(() => assertExpiryReason("TIMEOUT")).not.toThrow();
    expect(() => assertExpiryReason("SCHEME_WINDOW_ELAPSED")).not.toThrow();
    expect(() => assertExpiryReason("MANUAL_EXPIRY")).not.toThrow();
    expect(() => assertExpiryReason("POLICY_EXPIRY")).not.toThrow();
  });

  test("invalid expiry reasons throw", () => {
    expect(() => assertExpiryReason("INVALID_REASON")).toThrow(
      InvariantViolationError
    );
  });
});

describe("NPP Composite Invariant Checker", () => {
  test("checkInvariants enforces all rules", () => {
    const createEvent: NPPPaymentEventUnion = {
      type: "PaymentIntentCreated",
      paymentIntentId: "p1",
      occurredAt: new Date(),
      amount: 100n,
      currency: "AUD",
      idempotencyKey: "ik1",
      fromAccountId: "a1",
      toAccountId: "a2",
    };

    const authorisedEvent: NPPPaymentEventUnion = {
      type: "PaymentAuthorised",
      paymentIntentId: "p1",
      occurredAt: new Date(),
      policyChecksPassed: true,
      fundsEarmarked: 100n,
    };

    expect(() =>
      checkInvariants(NPPPaymentState.CREATED, createEvent, [])
    ).not.toThrow();

    expect(() =>
      checkInvariants(NPPPaymentState.CREATED, authorisedEvent, [createEvent])
    ).not.toThrow();
  });

  test("checkInvariants blocks illegal transitions", () => {
    const settledEvent: NPPPaymentEventUnion = {
      type: "PaymentSettled",
      paymentIntentId: "p1",
      occurredAt: new Date(),
      attemptId: "att1",
      settlementRef: "ref1",
      fundsMoved: 100n,
    };

    expect(() =>
      checkInvariants(NPPPaymentState.CREATED, settledEvent, [])
    ).toThrow(IllegalTransitionError);
  });

  test("checkInvariants blocks negative amounts", () => {
    const createEvent: NPPPaymentEventUnion = {
      type: "PaymentIntentCreated",
      paymentIntentId: "p1",
      occurredAt: new Date(),
      amount: -100n,
      currency: "AUD",
      idempotencyKey: "ik1",
      fromAccountId: "a1",
      toAccountId: "a2",
    };

    expect(() =>
      checkInvariants(NPPPaymentState.CREATED, createEvent, [])
    ).toThrow(InvariantViolationError);
  });
});
