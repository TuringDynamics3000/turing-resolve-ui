/**
 * NPP-Spine Integration Tests
 * 
 * Tests the end-to-end flow from Payments Spine through NPP Adapter.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { schemeAdapterRegistry } from "./core/payments/SchemeAdapterInterface";
import { nppSchemeAdapter } from "./core/payments/adapters/NppSchemeAdapter";
import { paymentsSpine } from "./core/payments/PaymentsSpine";

// ============================================
// SETUP
// ============================================

beforeAll(() => {
  // Register NPP adapter
  if (!schemeAdapterRegistry.has("NPP")) {
    schemeAdapterRegistry.register(nppSchemeAdapter);
  }
});

// ============================================
// INTEGRATION TESTS
// ============================================

describe("NPP-Spine Integration", () => {
  describe("Adapter Registration", () => {
    it("registers NPP adapter in registry", () => {
      expect(schemeAdapterRegistry.has("NPP")).toBe(true);
    });

    it("returns NPP adapter from registry", () => {
      const adapter = schemeAdapterRegistry.get("NPP");
      expect(adapter).toBeDefined();
      expect(adapter?.scheme).toBe("NPP");
    });

    it("lists NPP in registered schemes", () => {
      const schemes = schemeAdapterRegistry.getRegisteredSchemes();
      expect(schemes).toContain("NPP");
    });
  });

  describe("End-to-End Payment Flow", () => {
    it("submits NPP payment through adapter", async () => {
      // 1. Initiate payment
      const initResult = await paymentsSpine.initiatePayment({
        idempotencyKey: `e2e-npp-${Date.now()}`,
        scheme: "NPP",
        type: "CREDIT_TRANSFER",
        priority: "IMMEDIATE",
        amount: 1000,
        currency: "AUD",
        debtor: {
          name: "E2E Debtor",
          accountNumber: "123456789",
          bsb: "062-000",
          country: "AU",
        },
        creditor: {
          name: "E2E Creditor",
          accountNumber: "987654321",
          bsb: "062-001",
          country: "AU",
        },
        endToEndId: `E2E-NPP-${Date.now()}`,
        remittanceInfo: "E2E NPP test",
        requestedExecutionDate: new Date().toISOString().split("T")[0],
        createdBy: "TEST",
      });

      expect(initResult.success).toBe(true);
      expect(initResult.payment?.instruction.scheme).toBe("NPP");

      // 2. Request Resolve decision
      const decisionResult = await paymentsSpine.requestResolveDecision(initResult.payment!.paymentId);
      expect(decisionResult.success).toBe(true);

      // 3. Submit to scheme (only if ALLOW)
      if (decisionResult.outcome === "ALLOW") {
        const submitResult = await paymentsSpine.submitToScheme(initResult.payment!.paymentId);
        
        // Should use NPP adapter
        expect(submitResult.success).toBe(true);
        expect(submitResult.schemeReference).toBeDefined();
        
        // Verify payment status
        const payment = paymentsSpine.getPayment(initResult.payment!.paymentId);
        expect(payment?.status).toBe("SUBMITTED");
      }
    });

    it("handles NPP submission failure gracefully", async () => {
      // Create multiple payments to increase chance of simulated failure
      const results: boolean[] = [];
      
      for (let i = 0; i < 20; i++) {
        const initResult = await paymentsSpine.initiatePayment({
          idempotencyKey: `fail-test-${Date.now()}-${i}`,
          scheme: "NPP",
          type: "CREDIT_TRANSFER",
          priority: "IMMEDIATE",
          amount: 100,
          currency: "AUD",
          debtor: {
            name: "Fail Test Debtor",
            accountNumber: "111222333",
            bsb: "062-000",
            country: "AU",
          },
          creditor: {
            name: "Fail Test Creditor",
            accountNumber: "444555666",
            bsb: "062-001",
            country: "AU",
          },
          endToEndId: `E2E-FAIL-${Date.now()}-${i}`,
          remittanceInfo: "Failure test",
          requestedExecutionDate: new Date().toISOString().split("T")[0],
          createdBy: "TEST",
        });

        if (initResult.success) {
          const decisionResult = await paymentsSpine.requestResolveDecision(initResult.payment!.paymentId);
          
          if (decisionResult.outcome === "ALLOW") {
            const submitResult = await paymentsSpine.submitToScheme(initResult.payment!.paymentId);
            results.push(submitResult.success);
          }
        }
      }

      // Most should succeed (95% success rate in simulation)
      const successRate = results.filter(r => r).length / results.length;
      expect(successRate).toBeGreaterThan(0.8);
    });
  });

  describe("NPP Adapter Direct Tests", () => {
    it("performs health check", async () => {
      const health = await nppSchemeAdapter.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeDefined();
    });

    it("returns statistics", () => {
      const stats = nppSchemeAdapter.getStatistics();
      expect(stats).toBeDefined();
      expect(stats.idempotency).toBeDefined();
      expect(stats.config).toBeDefined();
    });
  });

  describe("Scheme Routing", () => {
    it("routes immediate AUD to NPP", async () => {
      const result = await paymentsSpine.initiatePayment({
        idempotencyKey: `route-test-${Date.now()}`,
        scheme: "BECS", // Will be overridden by routing
        type: "CREDIT_TRANSFER",
        priority: "IMMEDIATE",
        amount: 500,
        currency: "AUD",
        debtor: {
          name: "Route Debtor",
          accountNumber: "123456789",
          bsb: "062-000",
          country: "AU",
        },
        creditor: {
          name: "Route Creditor",
          accountNumber: "987654321",
          bsb: "062-001",
          country: "AU",
        },
        endToEndId: `E2E-ROUTE-${Date.now()}`,
        remittanceInfo: "Routing test",
        requestedExecutionDate: new Date().toISOString().split("T")[0],
        createdBy: "TEST",
      });

      expect(result.success).toBe(true);
      expect(result.payment?.instruction.scheme).toBe("NPP");
    });

    it("routes internal transfers without adapter", async () => {
      const result = await paymentsSpine.initiatePayment({
        idempotencyKey: `internal-test-${Date.now()}`,
        scheme: "NPP",
        type: "CREDIT_TRANSFER",
        priority: "IMMEDIATE",
        amount: 500,
        currency: "AUD",
        debtor: {
          name: "Internal Debtor",
          accountNumber: "123456789",
          bsb: "062-000",
          country: "AU",
        },
        creditor: {
          name: "Internal Creditor",
          accountNumber: "987654321",
          bsb: "062-000", // Same BSB = internal
          country: "AU",
        },
        endToEndId: `E2E-INTERNAL-${Date.now()}`,
        remittanceInfo: "Internal test",
        requestedExecutionDate: new Date().toISOString().split("T")[0],
        createdBy: "TEST",
      });

      expect(result.success).toBe(true);
      expect(result.payment?.instruction.scheme).toBe("INTERNAL");

      // Authorize and submit
      await paymentsSpine.requestResolveDecision(result.payment!.paymentId);
      
      const payment = paymentsSpine.getPayment(result.payment!.paymentId);
      if (payment?.status === "AUTHORIZED") {
        const submitResult = await paymentsSpine.submitToScheme(result.payment!.paymentId);
        expect(submitResult.success).toBe(true);
        expect(submitResult.schemeReference).toMatch(/^INTERNAL-/);
      }
    });
  });

  describe("Callback Handling", () => {
    it("handles NPP status callback", async () => {
      const callbackResult = await nppSchemeAdapter.handleCallback({
        messageId: "MSG-test-123",
        creationDateTime: new Date().toISOString(),
        originalMessageId: "MSG-original-456",
        originalMessageNameId: "pacs.008",
        transactionStatus: "ACSC", // Settled
      });

      // May be ignored if original message unknown
      expect(callbackResult).toBeDefined();
    });

    it("handles NPP payment return", async () => {
      const callbackResult = await nppSchemeAdapter.handleCallback({
        messageId: "MSG-return-123",
        creationDateTime: new Date().toISOString(),
        originalMessageId: "MSG-original-789",
        returnReason: { code: "AC04" }, // Account closed
        returnedAmount: { value: 1000, currency: "AUD" },
        originalTransactionReference: {
          paymentId: {
            instructionId: "INS-123",
            endToEndId: "E2E-123",
          },
          amount: { value: 1000, currency: "AUD" },
          debtor: { name: "Test Debtor" },
          creditor: { name: "Test Creditor" },
        },
      });

      expect(callbackResult).toBeDefined();
    });
  });

  describe("Health Check All Adapters", () => {
    it("performs health check on all registered adapters", async () => {
      const results = await schemeAdapterRegistry.healthCheckAll();
      
      expect(results.NPP).toBeDefined();
      expect(results.NPP.healthy).toBe(true);
    });
  });
});
