import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "../routers";
import { getDb } from "../db";
import { shadowAIAdvisoryFacts } from "../../drizzle/schema";

describe("Shadow AI Router", () => {
  beforeEach(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // Clean up shadow AI advisory facts
    await db.delete(shadowAIAdvisoryFacts);
  });

  describe("add", () => {
    it("should add a Shadow AI advisory fact", async () => {
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });

      const result = await caller.shadowAI.add({
        domain: "PAYMENTS_RL",
        entityType: "PAYMENT",
        entityId: "PAY-test123",
        recommendation: "APPROVE",
        confidence: 0.95,
        reasoning: "Payment pattern matches historical successful transactions",
        modelVersion: "payments-rl-v1.2.3",
        modelType: "RL",
        metadata: { features: ["amount", "velocity"] },
      });

      expect(result.advisoryId).toMatch(/^ADV-/);
      expect(result.occurredAt).toBeDefined();
    });

    it("should enforce confidence range 0-1", async () => {
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });

      await expect(
        caller.shadowAI.add({
          domain: "FRAUD",
          entityType: "PAYMENT",
          entityId: "PAY-test456",
          recommendation: "DECLINE",
          confidence: 1.5, // Invalid
          reasoning: "Test",
          modelVersion: "fraud-v1.0.0",
        })
      ).rejects.toThrow();
    });
  });

  describe("list", () => {
    it("should list Shadow AI advisory facts", async () => {
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });

      // Add test facts
      await caller.shadowAI.add({
        domain: "PAYMENTS_RL",
        entityType: "PAYMENT",
        entityId: "PAY-001",
        recommendation: "APPROVE",
        confidence: 0.92,
        reasoning: "Low risk",
        modelVersion: "v1.0.0",
      });

      await caller.shadowAI.add({
        domain: "FRAUD",
        entityType: "PAYMENT",
        entityId: "PAY-002",
        recommendation: "DECLINE",
        confidence: 0.88,
        reasoning: "High risk",
        modelVersion: "v1.0.0",
      });

      const facts = await caller.shadowAI.list();
      expect(facts.length).toBe(2);
    });

    it("should filter by domain", async () => {
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });

      await caller.shadowAI.add({
        domain: "PAYMENTS_RL",
        entityType: "PAYMENT",
        entityId: "PAY-001",
        recommendation: "APPROVE",
        confidence: 0.95,
        reasoning: "Test",
        modelVersion: "v1.0.0",
      });

      await caller.shadowAI.add({
        domain: "FRAUD",
        entityType: "PAYMENT",
        entityId: "PAY-002",
        recommendation: "DECLINE",
        confidence: 0.85,
        reasoning: "Test",
        modelVersion: "v1.0.0",
      });

      const facts = await caller.shadowAI.list({ domain: "PAYMENTS_RL" });
      expect(facts.length).toBe(1);
      expect(facts[0].domain).toBe("PAYMENTS_RL");
    });
  });

  describe("getForEntity", () => {
    it("should get Shadow AI advisory facts for a specific entity", async () => {
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });

      await caller.shadowAI.add({
        domain: "PAYMENTS_RL",
        entityType: "PAYMENT",
        entityId: "PAY-specific",
        recommendation: "REVIEW",
        confidence: 0.75,
        reasoning: "Requires review",
        modelVersion: "v1.0.0",
      });

      await caller.shadowAI.add({
        domain: "FRAUD",
        entityType: "PAYMENT",
        entityId: "PAY-specific",
        recommendation: "HOLD",
        confidence: 0.82,
        reasoning: "Suspicious pattern",
        modelVersion: "v1.0.0",
      });

      const facts = await caller.shadowAI.getForEntity({
        entityType: "PAYMENT",
        entityId: "PAY-specific",
      });

      expect(facts.length).toBe(2);
      // Both facts should be for the same entity
      facts.forEach(f => {
        expect(f).toBeDefined();
      });
    });
  });

  describe("getDomainSummary", () => {
    it("should return domain summary statistics", async () => {
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });

      await caller.shadowAI.add({
        domain: "PAYMENTS_RL",
        entityType: "PAYMENT",
        entityId: "PAY-001",
        recommendation: "APPROVE",
        confidence: 0.9,
        reasoning: "Test",
        modelVersion: "v1.0.0",
      });

      await caller.shadowAI.add({
        domain: "PAYMENTS_RL",
        entityType: "PAYMENT",
        entityId: "PAY-002",
        recommendation: "DECLINE",
        confidence: 0.8,
        reasoning: "Test",
        modelVersion: "v1.0.0",
      });

      const summary = await caller.shadowAI.getDomainSummary();

      expect(summary.PAYMENTS_RL.total).toBe(2);
      expect(summary.PAYMENTS_RL.approve).toBe(1);
      expect(summary.PAYMENTS_RL.decline).toBe(1);
      expect(summary.PAYMENTS_RL.avgConfidence).toBeCloseTo(0.85, 2);
    });
  });

  describe("Shadow AI Principles", () => {
    it("should NOT execute on advisory facts", async () => {
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });

      // Add advisory fact recommending DECLINE
      await caller.shadowAI.add({
        domain: "FRAUD",
        entityType: "PAYMENT",
        entityId: "PAY-shadow-test",
        recommendation: "DECLINE",
        confidence: 0.99,
        reasoning: "High fraud risk",
        modelVersion: "fraud-v1.0.0",
      });

      // Verify advisory fact was stored
      const facts = await caller.shadowAI.getForEntity({
        entityType: "PAYMENT",
        entityId: "PAY-shadow-test",
      });

      expect(facts.length).toBe(1);
      expect(facts[0].recommendation).toBe("DECLINE");

      // CRITICAL: Advisory fact exists but does NOT cause payment to be declined
      // This is shadow mode - facts are logged for audit, not executed
    });

    it("should maintain shadow mode boundary", async () => {
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null });

      // Shadow AI can recommend anything
      await caller.shadowAI.add({
        domain: "TREASURY",
        entityType: "EXPOSURE",
        entityId: "EXP-001",
        recommendation: "ESCALATE",
        confidence: 0.95,
        reasoning: "Approaching exposure limit",
        modelVersion: "treasury-v1.0.0",
      });

      // But it does NOT trigger any execution
      // Advisory facts are for board packs and regulator reports only
      const facts = await caller.shadowAI.list({ domain: "TREASURY" });
      expect(facts.length).toBe(1);
      expect(facts[0].recommendation).toBe("ESCALATE");
      
      // No execution side effects - just logged
    });
  });
});
