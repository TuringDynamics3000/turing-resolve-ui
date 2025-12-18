/**
 * PayID and WebSocket Service Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { payIdService } from "./core/payments/PayIdService";
import { paymentWebSocket } from "./core/payments/PaymentWebSocket";

// ============================================
// PAYID SERVICE TESTS
// ============================================

describe("PayID Service", () => {
  beforeEach(() => {
    payIdService.clearCache();
  });

  describe("Validation", () => {
    it("validates email PayID", () => {
      const result = payIdService.validate("john.smith@example.com");
      
      expect(result.valid).toBe(true);
      expect(result.type).toBe("EMAIL");
      expect(result.normalizedValue).toBe("john.smith@example.com");
    });

    it("validates phone PayID with +61 prefix", () => {
      const result = payIdService.validate("+61412345678");
      
      expect(result.valid).toBe(true);
      expect(result.type).toBe("PHONE");
      expect(result.normalizedValue).toBe("+61412345678");
    });

    it("normalizes phone PayID from 04 format", () => {
      const result = payIdService.validate("0412345678");
      
      expect(result.valid).toBe(true);
      expect(result.type).toBe("PHONE");
      expect(result.normalizedValue).toBe("+61412345678");
    });

    it("validates ABN PayID", () => {
      const result = payIdService.validate("12345678901");
      
      expect(result.valid).toBe(true);
      expect(result.type).toBe("ABN");
      expect(result.normalizedValue).toBe("12345678901");
    });

    it("validates ORG_ID PayID", () => {
      const result = payIdService.validate("TURINGDYN");
      
      expect(result.valid).toBe(true);
      expect(result.type).toBe("ORG_ID");
      expect(result.normalizedValue).toBe("TURINGDYN");
    });

    it("rejects invalid PayID", () => {
      const result = payIdService.validate("xyz"); // Too short for any type
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Lookup", () => {
    it("resolves known email PayID", async () => {
      const result = await payIdService.lookup("john.smith@example.com");
      
      expect(result.success).toBe(true);
      expect(result.resolution?.resolved).toBe(true);
      expect(result.resolution?.name).toBe("JOHN SMITH");
      expect(result.resolution?.bsb).toBe("062-000");
      expect(result.resolution?.accountNumber).toBe("12345678");
    });

    it("resolves known phone PayID", async () => {
      const result = await payIdService.lookup("+61412345678");
      
      expect(result.success).toBe(true);
      expect(result.resolution?.resolved).toBe(true);
      expect(result.resolution?.name).toBe("MOBILE USER");
    });

    it("resolves known ABN PayID", async () => {
      const result = await payIdService.lookup("12345678901");
      
      expect(result.success).toBe(true);
      expect(result.resolution?.resolved).toBe(true);
      expect(result.resolution?.name).toBe("ACME CORPORATION PTY LTD");
    });

    it("returns not found for unknown PayID", async () => {
      const result = await payIdService.lookup("unknown@example.com");
      
      expect(result.success).toBe(false);
      expect(result.resolution?.resolved).toBe(false);
      expect(result.resolution?.errorCode).toBe("PAYID_NOT_FOUND");
    });

    it("caches lookup results", async () => {
      // First lookup
      const result1 = await payIdService.lookup("john.smith@example.com");
      const latency1 = result1.latencyMs;
      
      // Second lookup (should be cached)
      const result2 = await payIdService.lookup("john.smith@example.com");
      const latency2 = result2.latencyMs;
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(latency2).toBeLessThan(latency1); // Cached should be faster
    });
  });

  describe("Registration", () => {
    it("registers new PayID", () => {
      const result = payIdService.registerPayId(
        "new@test.com",
        "NEW USER",
        "062-000",
        "99999999"
      );
      
      expect(result.success).toBe(true);
    });

    it("rejects duplicate PayID", () => {
      const result = payIdService.registerPayId(
        "john.smith@example.com",
        "DUPLICATE",
        "062-000",
        "11111111"
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("already registered");
    });

    it("rejects invalid PayID format", () => {
      const result = payIdService.registerPayId(
        "xyz", // Too short for any type
        "TEST",
        "062-000",
        "11111111"
      );
      
      expect(result.success).toBe(false);
    });
  });
});

// ============================================
// WEBSOCKET SERVICE TESTS
// ============================================

describe("Payment WebSocket Service", () => {
  describe("Client Management", () => {
    it("registers new client", () => {
      const client = paymentWebSocket.registerClient("user-123");
      
      expect(client.clientId).toBeDefined();
      expect(client.userId).toBe("user-123");
      expect(client.subscriptions.size).toBe(0);
    });

    it("unregisters client", () => {
      const client = paymentWebSocket.registerClient();
      const initialCount = paymentWebSocket.getClientCount();
      
      paymentWebSocket.unregisterClient(client.clientId);
      
      expect(paymentWebSocket.getClientCount()).toBe(initialCount - 1);
    });

    it("tracks connected clients", () => {
      const client1 = paymentWebSocket.registerClient();
      const client2 = paymentWebSocket.registerClient();
      
      const clients = paymentWebSocket.getConnectedClients();
      
      expect(clients.some(c => c.clientId === client1.clientId)).toBe(true);
      expect(clients.some(c => c.clientId === client2.clientId)).toBe(true);
      
      // Cleanup
      paymentWebSocket.unregisterClient(client1.clientId);
      paymentWebSocket.unregisterClient(client2.clientId);
    });
  });

  describe("Subscriptions", () => {
    it("subscribes client to payment updates", () => {
      const client = paymentWebSocket.registerClient();
      
      const result = paymentWebSocket.subscribe(client.clientId, "PAY-001");
      
      expect(result).toBe(true);
      expect(client.subscriptions.has("PAY-001")).toBe(true);
      
      // Cleanup
      paymentWebSocket.unregisterClient(client.clientId);
    });

    it("unsubscribes client from payment updates", () => {
      const client = paymentWebSocket.registerClient();
      paymentWebSocket.subscribe(client.clientId, "PAY-001");
      
      const result = paymentWebSocket.unsubscribe(client.clientId, "PAY-001");
      
      expect(result).toBe(true);
      expect(client.subscriptions.has("PAY-001")).toBe(false);
      
      // Cleanup
      paymentWebSocket.unregisterClient(client.clientId);
    });

    it("supports wildcard subscription", () => {
      const client = paymentWebSocket.registerClient();
      
      paymentWebSocket.subscribe(client.clientId, "*");
      
      expect(client.subscriptions.has("*")).toBe(true);
      
      // Cleanup
      paymentWebSocket.unregisterClient(client.clientId);
    });
  });

  describe("Event Emission", () => {
    it("emits payment initiated event", () => {
      const event = paymentWebSocket.paymentInitiated(
        "PAY-TEST-001",
        1000,
        "TEST CREDITOR",
        "TEST-REF"
      );
      
      expect(event.eventId).toBeDefined();
      expect(event.eventType).toBe("PAYMENT_INITIATED");
      expect(event.paymentId).toBe("PAY-TEST-001");
      expect(event.data.amount).toBe(1000);
      expect(event.data.creditorName).toBe("TEST CREDITOR");
    });

    it("emits payment settled event", () => {
      const event = paymentWebSocket.paymentSettled("PAY-TEST-002", "SCHEME-REF-001");
      
      expect(event.eventType).toBe("PAYMENT_SETTLED");
      expect(event.data.status).toBe("SETTLED");
      expect(event.data.schemeReference).toBe("SCHEME-REF-001");
    });

    it("emits payment failed event", () => {
      const event = paymentWebSocket.paymentFailed(
        "PAY-TEST-003",
        "INVALID_ACCOUNT",
        "Account number is invalid"
      );
      
      expect(event.eventType).toBe("PAYMENT_FAILED");
      expect(event.data.errorCode).toBe("INVALID_ACCOUNT");
      expect(event.data.errorMessage).toBe("Account number is invalid");
    });

    it("emits batch events", () => {
      const createEvent = paymentWebSocket.batchCreated("BATCH-TEST-001", 5, 10000);
      const submitEvent = paymentWebSocket.batchSubmitted("BATCH-TEST-001", "BECS-REF-001");
      const settleEvent = paymentWebSocket.batchSettled("BATCH-TEST-001");
      
      expect(createEvent.eventType).toBe("BATCH_CREATED");
      expect(submitEvent.eventType).toBe("BATCH_SUBMITTED");
      expect(settleEvent.eventType).toBe("BATCH_SETTLED");
    });
  });

  describe("Event History", () => {
    it("stores event history", () => {
      const paymentId = `PAY-HIST-${Date.now()}`;
      
      paymentWebSocket.paymentInitiated(paymentId, 500, "HISTORY TEST", "HIST-REF");
      paymentWebSocket.paymentValidated(paymentId);
      paymentWebSocket.paymentSettled(paymentId, "HIST-SCHEME-REF");
      
      const history = paymentWebSocket.getEventHistory(paymentId);
      
      expect(history.length).toBe(3);
      expect(history[0].eventType).toBe("PAYMENT_INITIATED");
      expect(history[2].eventType).toBe("PAYMENT_SETTLED");
    });

    it("filters events for subscribed client", () => {
      const client = paymentWebSocket.registerClient();
      const paymentId = `PAY-FILTER-${Date.now()}`;
      
      paymentWebSocket.subscribe(client.clientId, paymentId);
      
      // Emit events
      paymentWebSocket.paymentInitiated(paymentId, 100, "FILTER TEST", "FILTER-REF");
      paymentWebSocket.paymentInitiated("OTHER-PAY", 200, "OTHER", "OTHER-REF");
      
      const events = paymentWebSocket.getEventsForClient(client.clientId);
      
      // Should only include subscribed payment
      const filteredEvents = events.filter(e => e.paymentId === paymentId);
      expect(filteredEvents.length).toBeGreaterThan(0);
      
      // Cleanup
      paymentWebSocket.unregisterClient(client.clientId);
    });
  });

  describe("Programmatic Subscriptions", () => {
    it("notifies on specific payment events", async () => {
      const paymentId = `PAY-NOTIFY-${Date.now()}`;
      let receivedEvent: unknown = null;
      
      const unsubscribe = paymentWebSocket.onEvent(paymentId, (event) => {
        receivedEvent = event;
      });
      
      paymentWebSocket.paymentInitiated(paymentId, 750, "NOTIFY TEST", "NOTIFY-REF");
      
      expect(receivedEvent).not.toBeNull();
      expect((receivedEvent as { paymentId: string }).paymentId).toBe(paymentId);
      
      unsubscribe();
    });

    it("notifies on all events with wildcard", async () => {
      const events: unknown[] = [];
      
      const unsubscribe = paymentWebSocket.onAllEvents((event) => {
        events.push(event);
      });
      
      paymentWebSocket.paymentInitiated(`PAY-ALL-${Date.now()}`, 100, "ALL TEST 1", "ALL-REF-1");
      paymentWebSocket.batchCreated(`BATCH-ALL-${Date.now()}`, 3, 5000);
      
      expect(events.length).toBeGreaterThanOrEqual(2);
      
      unsubscribe();
    });
  });

  describe("Client Ping", () => {
    it("updates ping time", () => {
      const client = paymentWebSocket.registerClient();
      const initialPing = client.lastPingAt;
      
      // Wait a bit
      const delay = new Promise(resolve => setTimeout(resolve, 10));
      delay.then(() => {
        paymentWebSocket.updatePing(client.clientId);
        expect(client.lastPingAt).not.toBe(initialPing);
        
        // Cleanup
        paymentWebSocket.unregisterClient(client.clientId);
      });
    });
  });
});
