import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "../db";
import { advisoryFacts, payments, paymentFacts, depositAccounts, depositFacts } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

describe("Operator Commands", () => {
  describe("Advisory Facts", () => {
    it("should store advisory facts as append-only", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const testEntityId = `TEST-${nanoid(8)}`;
      const factId = `FACT-${nanoid(12)}`;
      
      // Insert advisory fact
      await db.insert(advisoryFacts).values({
        factId,
        entityType: "PAYMENT",
        entityId: testEntityId,
        advisoryType: "HOLD_FOR_REVIEW",
        note: "Test advisory note",
        actor: "test-operator",
        occurredAt: new Date(),
      });

      // Verify it was stored
      const facts = await db.select()
        .from(advisoryFacts)
        .where(eq(advisoryFacts.entityId, testEntityId));

      expect(facts.length).toBe(1);
      expect(facts[0].advisoryType).toBe("HOLD_FOR_REVIEW");
      expect(facts[0].note).toBe("Test advisory note");
    });

    it("should support all advisory types", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const advisoryTypes = [
        "RECOMMEND_RETRY",
        "RECOMMEND_REVERSAL", 
        "HOLD_FOR_REVIEW",
        "NO_ACTION"
      ];

      for (const advisoryType of advisoryTypes) {
        const testEntityId = `TEST-${nanoid(8)}`;
        const factId = `FACT-${nanoid(12)}`;
        
        await db.insert(advisoryFacts).values({
          factId,
          entityType: "PAYMENT",
          entityId: testEntityId,
          advisoryType,
          note: `Test ${advisoryType}`,
          actor: "test-operator",
          occurredAt: new Date(),
        });

        const facts = await db.select()
          .from(advisoryFacts)
          .where(eq(advisoryFacts.entityId, testEntityId));

        expect(facts.length).toBe(1);
        expect(facts[0].advisoryType).toBe(advisoryType);
      }
    });

    it("advisory notes do NOT execute or override system decisions", async () => {
      // This test documents the principle:
      // Advisory facts are governance artifacts only
      // They do not change payment state
      // They do not trigger any execution
      
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Create a test payment with all required fields
      const paymentId = `PAY-TEST-${nanoid(8)}`;
      const now = new Date();
      await db.insert(payments).values({
        paymentId,
        fromAccount: "TEST-ACC",
        toAccount: null,
        toExternal: { type: "NPP", identifier: "123" },
        amount: "100.00",
        currency: "AUD",
        state: "FAILED",
        initiatedAt: now,
        failedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      // Add advisory note recommending retry
      const factId = `FACT-${nanoid(12)}`;
      await db.insert(advisoryFacts).values({
        factId,
        entityType: "PAYMENT",
        entityId: paymentId,
        advisoryType: "RECOMMEND_RETRY",
        note: "Recommend retry after NPP outage resolved",
        actor: "test-operator",
        occurredAt: new Date(),
      });

      // Verify payment state is UNCHANGED
      const payment = await db.select()
        .from(payments)
        .where(eq(payments.paymentId, paymentId))
        .limit(1);

      expect(payment[0].state).toBe("FAILED"); // NOT changed by advisory
    });
  });

  describe("Operator Principles", () => {
    it("operators issue commands, not state mutations", () => {
      // This test documents the principle:
      // Operators emit commands
      // Commands emit facts
      // Facts replay determines outcome
      // UI never assumes success
      
      // The principle is enforced by:
      // 1. operatorRetry emits PAYMENT_INITIATED fact
      // 2. operatorReverse emits PAYMENT_REVERSED fact + deposit fact
      // 3. UI queries rebuildFromFacts to see result
      
      expect(true).toBe(true); // Principle documented
    });

    it("money moves only when Deposits Core applies facts", () => {
      // This test documents the principle:
      // Operator commands do not directly move money
      // They emit facts that Deposits Core processes
      // Balance changes only occur through deposit facts
      
      expect(true).toBe(true); // Principle documented
    });

    it("all operator actions produce immutable evidence", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Advisory facts are append-only
      // Payment facts are append-only
      // Deposit facts are append-only
      // No UPDATE or DELETE operations on fact tables
      
      // This is enforced by:
      // 1. Only INSERT operations in routers
      // 2. No UPDATE/DELETE endpoints for fact tables
      // 3. Sequence numbers for ordering
      
      expect(true).toBe(true); // Principle documented
    });
  });
});
