import { describe, it, expect } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

/**
 * Ops Router Tests
 * 
 * Tests for the Ops Console tRPC endpoints:
 * - Decision queue management
 * - Limits catalogue and overrides
 * - System health monitoring
 */

function createTestContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("opsRouter", () => {
  describe("getPendingDecisions", () => {
    it("should return pending decisions with pagination", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.ops.getPendingDecisions({ limit: 10, offset: 0 });
      
      expect(result).toHaveProperty("items");
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("hasMore");
      expect(Array.isArray(result.items)).toBe(true);
      expect(typeof result.total).toBe("number");
    });

    it("should filter by type when specified", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.ops.getPendingDecisions({ type: "PAYMENT", limit: 50, offset: 0 });
      
      result.items.forEach((item) => {
        expect(item.type).toBe("PAYMENT");
      });
    });

    it("should filter by priority when specified", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.ops.getPendingDecisions({ priority: "CRITICAL", limit: 50, offset: 0 });
      
      result.items.forEach((item) => {
        expect(item.priority).toBe("CRITICAL");
      });
    });
  });

  describe("getActiveDecisions", () => {
    it("should return active (in-progress) decisions", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.ops.getActiveDecisions({ limit: 10, offset: 0 });
      
      expect(result).toHaveProperty("items");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.items)).toBe(true);
    });
  });

  describe("getCompletedDecisions", () => {
    it("should return completed decisions", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.ops.getCompletedDecisions({ limit: 10, offset: 0 });
      
      expect(result).toHaveProperty("items");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.items)).toBe(true);
    });

    it("should filter by status when specified", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.ops.getCompletedDecisions({ status: "APPROVED", limit: 50, offset: 0 });
      
      result.items.forEach((item) => {
        expect(item.status).toBe("APPROVED");
      });
    });
  });

  describe("getDecisionById", () => {
    it("should return a decision by ID", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      // First get a list to find a valid ID
      const list = await caller.ops.getPendingDecisions({ limit: 1, offset: 0 });
      
      if (list.items.length > 0) {
        const decision = await caller.ops.getDecisionById({ id: list.items[0].id });
        
        expect(decision).toHaveProperty("id");
        expect(decision).toHaveProperty("type");
        expect(decision).toHaveProperty("status");
        expect(decision).toHaveProperty("priority");
        expect(decision).toHaveProperty("policyContext");
      }
    });

    it("should throw error for non-existent decision", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      await expect(
        caller.ops.getDecisionById({ id: "NON-EXISTENT-ID" })
      ).rejects.toThrow();
    });
  });

  describe("submitDecision", () => {
    it("should submit an approval decision", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.ops.submitDecision({
        decisionId: "DEC-001000",
        action: "APPROVE",
        reason: "Test approval",
      });
      
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe("APPROVED");
      expect(result).toHaveProperty("evidencePackId");
    });

    it("should submit a decline decision", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.ops.submitDecision({
        decisionId: "DEC-001001",
        action: "DECLINE",
        reason: "Test decline",
      });
      
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe("DECLINED");
    });

    it("should submit an escalate decision", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.ops.submitDecision({
        decisionId: "DEC-001002",
        action: "ESCALATE",
        reason: "Test escalation",
      });
      
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe("ESCALATED");
    });
  });

  describe("getDecisionStats", () => {
    it("should return decision statistics", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const stats = await caller.ops.getDecisionStats();
      
      expect(stats).toHaveProperty("pending");
      expect(stats).toHaveProperty("inProgress");
      expect(stats).toHaveProperty("completedToday");
      expect(stats).toHaveProperty("slaBreached");
      expect(stats).toHaveProperty("avgProcessingTime");
      expect(stats).toHaveProperty("byPriority");
      expect(stats).toHaveProperty("byType");
      
      expect(typeof stats.pending).toBe("number");
      expect(typeof stats.inProgress).toBe("number");
    });
  });

  describe("getLimits", () => {
    it("should return all limits", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const limits = await caller.ops.getLimits();
      
      expect(Array.isArray(limits)).toBe(true);
      expect(limits.length).toBeGreaterThan(0);
      
      limits.forEach((limit) => {
        expect(limit).toHaveProperty("id");
        expect(limit).toHaveProperty("name");
        expect(limit).toHaveProperty("category");
        expect(limit).toHaveProperty("currentValue");
        expect(limit).toHaveProperty("maxValue");
        expect(limit).toHaveProperty("policyId");
      });
    });

    it("should filter by category when specified", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const limits = await caller.ops.getLimits({ category: "TRANSACTION" });
      
      limits.forEach((limit) => {
        expect(limit.category).toBe("TRANSACTION");
      });
    });
  });

  describe("getLimitById", () => {
    it("should return a limit by ID", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const limit = await caller.ops.getLimitById({ id: "LIM-001" });
      
      expect(limit).toHaveProperty("id", "LIM-001");
      expect(limit).toHaveProperty("name");
      expect(limit).toHaveProperty("currentValue");
    });

    it("should throw error for non-existent limit", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      await expect(
        caller.ops.getLimitById({ id: "NON-EXISTENT" })
      ).rejects.toThrow();
    });
  });

  describe("getOverrideRequests", () => {
    it("should return override requests", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const overrides = await caller.ops.getOverrideRequests();
      
      expect(Array.isArray(overrides)).toBe(true);
      
      overrides.forEach((override) => {
        expect(override).toHaveProperty("id");
        expect(override).toHaveProperty("limitId");
        expect(override).toHaveProperty("customerId");
        expect(override).toHaveProperty("requestedValue");
        expect(override).toHaveProperty("status");
      });
    });

    it("should filter by status when specified", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const overrides = await caller.ops.getOverrideRequests({ status: "PENDING" });
      
      overrides.forEach((override) => {
        expect(override.status).toBe("PENDING");
      });
    });
  });

  describe("requestOverride", () => {
    it("should create an override request", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.ops.requestOverride({
        limitId: "LIM-001",
        customerId: "CUS-TEST-001",
        requestedValue: 25000,
        justification: "Test override request",
        expiresInDays: 7,
      });
      
      expect(result.success).toBe(true);
      expect(result).toHaveProperty("override");
      expect(result).toHaveProperty("decisionId");
      expect(result.override.status).toBe("PENDING");
    });

    it("should throw error for non-existent limit", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      await expect(
        caller.ops.requestOverride({
          limitId: "NON-EXISTENT",
          customerId: "CUS-TEST-001",
          requestedValue: 25000,
          justification: "Test",
          expiresInDays: 7,
        })
      ).rejects.toThrow();
    });
  });

  describe("approveOverride", () => {
    it("should approve an override request", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.ops.approveOverride({
        overrideId: "OVR-001",
        approved: true,
        reason: "Test approval",
      });
      
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe("APPROVED");
    });

    it("should decline an override request", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.ops.approveOverride({
        overrideId: "OVR-002",
        approved: false,
        reason: "Test decline",
      });
      
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe("DECLINED");
    });
  });

  describe("getSystemHealth", () => {
    it("should return system health status", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const health = await caller.ops.getSystemHealth();
      
      expect(health).toHaveProperty("overall");
      expect(["HEALTHY", "DEGRADED", "CRITICAL"]).toContain(health.overall);
      
      expect(health).toHaveProperty("components");
      expect(Array.isArray(health.components)).toBe(true);
      
      health.components.forEach((component) => {
        expect(component).toHaveProperty("name");
        expect(component).toHaveProperty("status");
        expect(["UP", "DOWN", "DEGRADED"]).toContain(component.status);
      });
      
      expect(health).toHaveProperty("decisionBacklog");
      expect(health.decisionBacklog).toHaveProperty("total");
      expect(health.decisionBacklog).toHaveProperty("pending");
      expect(health.decisionBacklog).toHaveProperty("inProgress");
      
      expect(health).toHaveProperty("slaBreaches");
      expect(health.slaBreaches).toHaveProperty("total");
      
      expect(health).toHaveProperty("retryQueue");
      expect(health.retryQueue).toHaveProperty("total");
    });
  });

  describe("getComponentHealth", () => {
    it("should return health for a specific component", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const health = await caller.ops.getComponentHealth({ component: "Decision Engine" });
      
      expect(health).toHaveProperty("status");
      expect(health).toHaveProperty("metrics");
    });

    it("should return UNKNOWN for non-existent component", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const health = await caller.ops.getComponentHealth({ component: "Non-Existent" });
      
      expect(health.status).toBe("UNKNOWN");
    });
  });
});
