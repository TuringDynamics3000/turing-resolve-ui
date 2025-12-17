import { describe, it, expect } from "vitest";
import {
  createCardsPayment,
  applyCardsEvent,
  rebuildCardsFromEvents,
  getCardsPaymentHash,
  CardsPaymentEvent,
  CardsPaymentState,
  CardsChargebackReason,
} from "../core/payments/cards";

describe("Cards Replay Guarantee Tests", () => {
  describe("Happy Path Replay", () => {
    it("should deterministically rebuild from auth → capture → settle", () => {
      const events: CardsPaymentEvent[] = [
        {
          type: "PaymentIntentCreated",
          paymentIntentId: "card-replay-001",
          occurredAt: new Date("2024-01-01T10:00:00Z"),
          amount: 100n,
          currency: "AUD",
          cardToken: "tok_test",
          merchantId: "merchant-001",
          idempotencyKey: "idem-001",
        },
        {
          type: "PaymentAuthorised",
          paymentIntentId: "card-replay-001",
          occurredAt: new Date("2024-01-01T10:00:01Z"),
          authCode: "AUTH123",
          authorisedAmount: 100n,
          expiresAt: new Date("2024-01-02T10:00:01Z"),
          holdPlaced: 100n,
        },
        {
          type: "PaymentCaptured",
          paymentIntentId: "card-replay-001",
          occurredAt: new Date("2024-01-01T10:00:02Z"),
          captureAmount: 100n,
          captureSequence: 1,
          totalCaptured: 100n,
        },
        {
          type: "PaymentCleared",
          paymentIntentId: "card-replay-001",
          occurredAt: new Date("2024-01-01T10:00:03Z"),
          clearedAt: new Date("2024-01-01T10:00:03Z"),
          schemeTransactionId: "scheme-001",
          clearedAmount: 100n,
        },
        {
          type: "PaymentSettled",
          paymentIntentId: "card-replay-001",
          occurredAt: new Date("2024-01-01T10:00:04Z"),
          settledAt: new Date("2024-01-01T10:00:04Z"),
          settledAmount: 100n,
          provisional: true,
          fundsTransferred: 100n,
        },
      ];

      // Build incrementally
      let payment = createCardsPayment(events[0]);
      for (let i = 1; i < events.length; i++) {
        payment = applyCardsEvent(payment, events[i]);
      }
      const hash1 = getCardsPaymentHash(payment);

      // Rebuild from scratch
      const rebuilt = rebuildCardsFromEvents(events);
      const hash2 = getCardsPaymentHash(rebuilt);

      // Verify determinism
      expect(hash1).toBe(hash2);
      expect(rebuilt.state).toBe(CardsPaymentState.SETTLED);
      expect(rebuilt.settledAmount).toBe(100n);
    });
  });

  describe("Chargeback Replay", () => {
    it("should deterministically rebuild chargeback flow", () => {
      const events: CardsPaymentEvent[] = [
        {
          type: "PaymentIntentCreated",
          paymentIntentId: "card-chargeback-001",
          occurredAt: new Date("2024-01-01T10:00:00Z"),
          amount: 200n,
          currency: "AUD",
          cardToken: "tok_test",
          merchantId: "merchant-002",
          idempotencyKey: "idem-002",
        },
        {
          type: "PaymentAuthorised",
          paymentIntentId: "card-chargeback-001",
          occurredAt: new Date("2024-01-01T10:00:01Z"),
          authCode: "AUTH456",
          authorisedAmount: 200n,
          expiresAt: new Date("2024-01-02T10:00:01Z"),
          holdPlaced: 200n,
        },
        {
          type: "PaymentCaptured",
          paymentIntentId: "card-chargeback-001",
          occurredAt: new Date("2024-01-01T10:00:02Z"),
          captureAmount: 200n,
          captureSequence: 1,
          totalCaptured: 200n,
        },
        {
          type: "PaymentCleared",
          paymentIntentId: "card-chargeback-001",
          occurredAt: new Date("2024-01-01T10:00:03Z"),
          clearedAt: new Date("2024-01-01T10:00:03Z"),
          schemeTransactionId: "scheme-002",
          clearedAmount: 200n,
        },
        {
          type: "PaymentSettled",
          paymentIntentId: "card-chargeback-001",
          occurredAt: new Date("2024-01-01T10:00:04Z"),
          settledAt: new Date("2024-01-01T10:00:04Z"),
          settledAmount: 200n,
          provisional: true,
          fundsTransferred: 200n,
        },
        {
          type: "PaymentChargeback",
          paymentIntentId: "card-chargeback-001",
          occurredAt: new Date("2024-03-01T10:00:00Z"), // 60 days later
          chargebackReason: CardsChargebackReason.FRAUD,
          chargebackAmount: 200n,
          receivedAt: new Date("2024-03-01T10:00:00Z"),
          responseDeadline: new Date("2024-03-15T10:00:00Z"),
          fundsReversed: 200n,
        },
      ];

      const payment = rebuildCardsFromEvents(events);

      // Verify chargeback state
      expect(payment.state).toBe(CardsPaymentState.CHARGEBACK);
      expect(payment.settledAmount).toBe(200n);
      expect(payment.chargebackAmount).toBe(200n);
      expect(payment.fundsReversed).toBe(200n); // Ledger reversed
    });
  });

  describe("Representment Replay", () => {
    it("should deterministically rebuild representment flow", () => {
      const events: CardsPaymentEvent[] = [
        {
          type: "PaymentIntentCreated",
          paymentIntentId: "card-represent-001",
          occurredAt: new Date("2024-01-01T10:00:00Z"),
          amount: 300n,
          currency: "AUD",
          cardToken: "tok_test",
          merchantId: "merchant-003",
          idempotencyKey: "idem-003",
        },
        {
          type: "PaymentAuthorised",
          paymentIntentId: "card-represent-001",
          occurredAt: new Date("2024-01-01T10:00:01Z"),
          authCode: "AUTH789",
          authorisedAmount: 300n,
          expiresAt: new Date("2024-01-02T10:00:01Z"),
          holdPlaced: 300n,
        },
        {
          type: "PaymentCaptured",
          paymentIntentId: "card-represent-001",
          occurredAt: new Date("2024-01-01T10:00:02Z"),
          captureAmount: 300n,
          captureSequence: 1,
          totalCaptured: 300n,
        },
        {
          type: "PaymentCleared",
          paymentIntentId: "card-represent-001",
          occurredAt: new Date("2024-01-01T10:00:03Z"),
          clearedAt: new Date("2024-01-01T10:00:03Z"),
          schemeTransactionId: "scheme-003",
          clearedAmount: 300n,
        },
        {
          type: "PaymentSettled",
          paymentIntentId: "card-represent-001",
          occurredAt: new Date("2024-01-01T10:00:04Z"),
          settledAt: new Date("2024-01-01T10:00:04Z"),
          settledAmount: 300n,
          provisional: true,
          fundsTransferred: 300n,
        },
        {
          type: "PaymentChargeback",
          paymentIntentId: "card-represent-001",
          occurredAt: new Date("2024-03-01T10:00:00Z"),
          chargebackReason: CardsChargebackReason.GOODS_NOT_RECEIVED,
          chargebackAmount: 300n,
          receivedAt: new Date("2024-03-01T10:00:00Z"),
          responseDeadline: new Date("2024-03-15T10:00:00Z"),
          fundsReversed: 300n,
        },
        {
          type: "PaymentRepresented",
          paymentIntentId: "card-represent-001",
          occurredAt: new Date("2024-03-10T10:00:00Z"),
          representmentEvidence: "evidence-doc-001",
          representedAt: new Date("2024-03-10T10:00:00Z"),
          representmentAmount: 300n,
        },
        {
          type: "PaymentSettled",
          paymentIntentId: "card-represent-001",
          occurredAt: new Date("2024-03-20T10:00:00Z"),
          settledAt: new Date("2024-03-20T10:00:00Z"),
          settledAmount: 300n,
          provisional: true,
          fundsTransferred: 300n,
        },
      ];

      const payment = rebuildCardsFromEvents(events);

      // Verify representment won → re-settled
      expect(payment.state).toBe(CardsPaymentState.SETTLED);
      expect(payment.representedAt).not.toBeNull();
      expect(payment.settledAmount).toBe(300n);
    });
  });

  describe("Long-Tail Replay (90-Day Gap)", () => {
    it("should handle 90-day gap between settlement and chargeback", () => {
      const settledEvents: CardsPaymentEvent[] = [
        {
          type: "PaymentIntentCreated",
          paymentIntentId: "card-longtail-001",
          occurredAt: new Date("2024-01-01T10:00:00Z"),
          amount: 500n,
          currency: "AUD",
          cardToken: "tok_test",
          merchantId: "merchant-004",
          idempotencyKey: "idem-004",
        },
        {
          type: "PaymentAuthorised",
          paymentIntentId: "card-longtail-001",
          occurredAt: new Date("2024-01-01T10:00:01Z"),
          authCode: "AUTH999",
          authorisedAmount: 500n,
          expiresAt: new Date("2024-01-02T10:00:01Z"),
          holdPlaced: 500n,
        },
        {
          type: "PaymentCaptured",
          paymentIntentId: "card-longtail-001",
          occurredAt: new Date("2024-01-01T10:00:02Z"),
          captureAmount: 500n,
          captureSequence: 1,
          totalCaptured: 500n,
        },
        {
          type: "PaymentCleared",
          paymentIntentId: "card-longtail-001",
          occurredAt: new Date("2024-01-01T10:00:03Z"),
          clearedAt: new Date("2024-01-01T10:00:03Z"),
          schemeTransactionId: "scheme-004",
          clearedAmount: 500n,
        },
        {
          type: "PaymentSettled",
          paymentIntentId: "card-longtail-001",
          occurredAt: new Date("2024-01-01T10:00:04Z"),
          settledAt: new Date("2024-01-01T10:00:04Z"),
          settledAmount: 500n,
          provisional: true,
          fundsTransferred: 500n,
        },
      ];

      // Simulate 90-day gap
      const chargebackEvent: CardsPaymentEvent = {
        type: "PaymentChargeback",
        paymentIntentId: "card-longtail-001",
        occurredAt: new Date("2024-04-01T10:00:00Z"), // 90 days later
        chargebackReason: CardsChargebackReason.FRAUD,
        chargebackAmount: 500n,
        receivedAt: new Date("2024-04-01T10:00:00Z"),
        responseDeadline: new Date("2024-04-15T10:00:00Z"),
        fundsReversed: 500n,
      };

      // Rebuild from settled state
      const settledPayment = rebuildCardsFromEvents(settledEvents);
      const settledHash = getCardsPaymentHash(settledPayment);

      // Apply chargeback after 90 days
      const chargedBackPayment = applyCardsEvent(settledPayment, chargebackEvent);
      const chargedBackHash1 = getCardsPaymentHash(chargedBackPayment);

      // Rebuild from full event stream
      const fullEvents = [...settledEvents, chargebackEvent];
      const rebuiltPayment = rebuildCardsFromEvents(fullEvents);
      const chargedBackHash2 = getCardsPaymentHash(rebuiltPayment);

      // Verify determinism
      expect(chargedBackHash1).toBe(chargedBackHash2);
      expect(rebuiltPayment.state).toBe(CardsPaymentState.CHARGEBACK);
      expect(rebuiltPayment.fundsReversed).toBe(500n);
    });
  });

  describe("Partial Capture Replay", () => {
    it("should deterministically rebuild multiple partial captures", () => {
      const events: CardsPaymentEvent[] = [
        {
          type: "PaymentIntentCreated",
          paymentIntentId: "card-partial-001",
          occurredAt: new Date("2024-01-01T10:00:00Z"),
          amount: 1000n,
          currency: "AUD",
          cardToken: "tok_test",
          merchantId: "merchant-005",
          idempotencyKey: "idem-005",
        },
        {
          type: "PaymentAuthorised",
          paymentIntentId: "card-partial-001",
          occurredAt: new Date("2024-01-01T10:00:01Z"),
          authCode: "AUTH111",
          authorisedAmount: 1000n,
          expiresAt: new Date("2024-01-02T10:00:01Z"),
          holdPlaced: 1000n,
        },
        {
          type: "PaymentCaptured",
          paymentIntentId: "card-partial-001",
          occurredAt: new Date("2024-01-01T12:00:00Z"),
          captureAmount: 400n,
          captureSequence: 1,
          totalCaptured: 400n,
        },
        {
          type: "PaymentCaptured",
          paymentIntentId: "card-partial-001",
          occurredAt: new Date("2024-01-01T14:00:00Z"),
          captureAmount: 300n,
          captureSequence: 2,
          totalCaptured: 700n,
        },
        {
          type: "PaymentCaptured",
          paymentIntentId: "card-partial-001",
          occurredAt: new Date("2024-01-01T16:00:00Z"),
          captureAmount: 200n,
          captureSequence: 3,
          totalCaptured: 900n,
        },
      ];

      const payment = rebuildCardsFromEvents(events);

      // Verify multiple partial captures
      expect(payment.authorisedAmount).toBe(1000n);
      expect(payment.totalCaptured).toBe(900n);
      expect(payment.captures.length).toBe(3);
      expect(payment.captures[0].captureAmount).toBe(400n);
      expect(payment.captures[1].captureAmount).toBe(300n);
      expect(payment.captures[2].captureAmount).toBe(200n);
    });
  });
});
