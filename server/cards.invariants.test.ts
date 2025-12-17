import { describe, it, expect } from "vitest";
import {
  createCardsPayment,
  applyCardsEvent,
  CardsPaymentEvent,
  assertAuthAllowed,
  assertCaptureAllowed,
  assertChargebackAllowed,
  assertSettlementProvisional,
  CardsPaymentState,
} from "../core/payments/cards";

describe("Cards Payment Invariants", () => {
  describe("Authorisation Invariants", () => {
    it("should enforce hold ≥ authorised amount", () => {
      expect(() => {
        assertAuthAllowed(100n, 150n); // Attempting 150 with only 100 available
      }).toThrow("Insufficient funds");
    });

    it("should reject zero or negative auth amounts", () => {
      expect(() => {
        assertAuthAllowed(100n, 0n);
      }).toThrow("Invalid auth amount");
      
      expect(() => {
        assertAuthAllowed(100n, -50n);
      }).toThrow("Invalid auth amount");
    });

    it("should allow auth when funds available", () => {
      expect(() => {
        assertAuthAllowed(100n, 50n);
      }).not.toThrow();
    });
  });

  describe("Capture Invariants", () => {
    it("should enforce capture ≤ auth (scheme law)", () => {
      expect(() => {
        assertCaptureAllowed(100n, 0n, 150n); // Attempting 150 with 100 auth
      }).toThrow("Capture exceeds auth");
    });

    it("should allow partial capture", () => {
      expect(() => {
        assertCaptureAllowed(100n, 0n, 50n); // Partial capture
      }).not.toThrow();
    });

    it("should allow multiple partial captures", () => {
      // First capture: 50
      expect(() => {
        assertCaptureAllowed(100n, 0n, 50n);
      }).not.toThrow();
      
      // Second capture: 30 (total 80)
      expect(() => {
        assertCaptureAllowed(100n, 50n, 30n);
      }).not.toThrow();
      
      // Third capture: 25 would exceed (total 105)
      expect(() => {
        assertCaptureAllowed(100n, 80n, 25n);
      }).toThrow("Capture exceeds auth");
    });

    it("should reject zero or negative capture amounts", () => {
      expect(() => {
        assertCaptureAllowed(100n, 0n, 0n);
      }).toThrow("Invalid capture amount");
    });
  });

  describe("Settlement Invariants", () => {
    it("should enforce settlement is always provisional for cards", () => {
      expect(() => {
        assertSettlementProvisional(false);
      }).toThrow("must always be provisional");
    });

    it("should allow provisional settlement", () => {
      expect(() => {
        assertSettlementProvisional(true);
      }).not.toThrow();
    });
  });

  describe("Chargeback Invariants", () => {
    it("should only allow chargeback after settlement", () => {
      expect(() => {
        assertChargebackAllowed(CardsPaymentState.CREATED);
      }).toThrow("only allowed after settlement");
      
      expect(() => {
        assertChargebackAllowed(CardsPaymentState.AUTHORISED);
      }).toThrow("only allowed after settlement");
      
      expect(() => {
        assertChargebackAllowed(CardsPaymentState.CAPTURED);
      }).toThrow("only allowed after settlement");
    });

    it("should allow chargeback from SETTLED state", () => {
      expect(() => {
        assertChargebackAllowed(CardsPaymentState.SETTLED);
      }).not.toThrow();
    });
  });

  describe("Economic Correctness", () => {
    it("should maintain funds conservation through auth → capture → settle", () => {
      const intentEvent: CardsPaymentEvent = {
        type: "PaymentIntentCreated",
        paymentIntentId: "card-001",
        occurredAt: new Date(),
        amount: 100n,
        currency: "AUD",
        cardToken: "tok_test",
        merchantId: "merchant-001",
        idempotencyKey: "idem-001",
      };

      const authEvent: CardsPaymentEvent = {
        type: "PaymentAuthorised",
        paymentIntentId: "card-001",
        occurredAt: new Date(),
        authCode: "AUTH123",
        authorisedAmount: 100n,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        holdPlaced: 100n,
      };

      const captureEvent: CardsPaymentEvent = {
        type: "PaymentCaptured",
        paymentIntentId: "card-001",
        occurredAt: new Date(),
        captureAmount: 100n,
        captureSequence: 1,
        totalCaptured: 100n,
      };

      const clearedEvent: CardsPaymentEvent = {
        type: "PaymentCleared",
        paymentIntentId: "card-001",
        occurredAt: new Date(),
        clearedAt: new Date(),
        schemeTransactionId: "scheme-001",
        clearedAmount: 100n,
      };

      const settledEvent: CardsPaymentEvent = {
        type: "PaymentSettled",
        paymentIntentId: "card-001",
        occurredAt: new Date(),
        settledAt: new Date(),
        settledAmount: 100n,
        provisional: true,
        fundsTransferred: 100n,
      };

      let payment = createCardsPayment(intentEvent);
      payment = applyCardsEvent(payment, authEvent);
      payment = applyCardsEvent(payment, captureEvent);
      payment = applyCardsEvent(payment, clearedEvent);
      payment = applyCardsEvent(payment, settledEvent);

      // Verify funds conservation
      expect(payment.holdPlaced).toBe(100n);
      expect(payment.totalCaptured).toBe(100n);
      expect(payment.settledAmount).toBe(100n);
      expect(payment.state).toBe(CardsPaymentState.SETTLED);
    });

    it("should handle partial capture correctly", () => {
      const intentEvent: CardsPaymentEvent = {
        type: "PaymentIntentCreated",
        paymentIntentId: "card-002",
        occurredAt: new Date(),
        amount: 500n, // Hotel estimated stay
        currency: "AUD",
        cardToken: "tok_test",
        merchantId: "merchant-002",
        idempotencyKey: "idem-002",
      };

      const authEvent: CardsPaymentEvent = {
        type: "PaymentAuthorised",
        paymentIntentId: "card-002",
        occurredAt: new Date(),
        authCode: "AUTH456",
        authorisedAmount: 500n,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        holdPlaced: 500n,
      };

      // Guest checks out early, only $300 charged
      const captureEvent: CardsPaymentEvent = {
        type: "PaymentCaptured",
        paymentIntentId: "card-002",
        occurredAt: new Date(),
        captureAmount: 300n,
        captureSequence: 1,
        totalCaptured: 300n,
      };

      let payment = createCardsPayment(intentEvent);
      payment = applyCardsEvent(payment, authEvent);
      payment = applyCardsEvent(payment, captureEvent);

      // Verify partial capture
      expect(payment.authorisedAmount).toBe(500n);
      expect(payment.totalCaptured).toBe(300n);
      expect(payment.state).toBe(CardsPaymentState.CAPTURED);
    });
  });
});
