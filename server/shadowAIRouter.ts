import { z } from "zod";
import { router, publicProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { shadowAIAdvisoryFacts } from "../drizzle/schema";
import { desc, eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * Shadow AI Router - Handles Shadow AI domain advisory facts
 * 
 * CRITICAL BOUNDARIES:
 * - Shadow mode only (no execution)
 * - Advisory facts are logged for audit
 * - Resolve can see them but does NOT act on them
 * - Used for board packs and regulator reports
 */

export const shadowAIRouter = router({
  /**
   * Add Shadow AI advisory fact
   */
  add: publicProcedure
    .input(z.object({
      domain: z.enum(["PAYMENTS_RL", "FRAUD", "AML", "TREASURY"]),
      entityType: z.enum(["PAYMENT", "DEPOSIT", "LOAN", "EXPOSURE"]),
      entityId: z.string(),
      recommendation: z.enum(["APPROVE", "REVIEW", "DECLINE", "HOLD", "ESCALATE", "NO_ACTION"]),
      confidence: z.number().min(0).max(1),
      reasoning: z.string(),
      modelVersion: z.string(),
      modelType: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const advisoryId = `ADV-${nanoid(16)}`;
      const occurredAt = new Date();

      await db.insert(shadowAIAdvisoryFacts).values({
        advisoryId,
        domain: input.domain,
        entityType: input.entityType,
        entityId: input.entityId,
        recommendation: input.recommendation,
        confidence: input.confidence.toFixed(4),
        reasoning: input.reasoning,
        modelVersion: input.modelVersion,
        modelType: input.modelType,
        metadata: input.metadata,
        occurredAt,
      });

      return {
        advisoryId,
        occurredAt: occurredAt.toISOString(),
      };
    }),

  /**
   * List Shadow AI advisory facts
   */
  list: publicProcedure
    .input(z.object({
      domain: z.enum(["PAYMENTS_RL", "FRAUD", "AML", "TREASURY"]).optional(),
      entityType: z.enum(["PAYMENT", "DEPOSIT", "LOAN", "EXPOSURE"]).optional(),
      entityId: z.string().optional(),
      limit: z.number().min(1).max(1000).default(100),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [];

      if (input?.domain) {
        conditions.push(eq(shadowAIAdvisoryFacts.domain, input.domain));
      }
      if (input?.entityType) {
        conditions.push(eq(shadowAIAdvisoryFacts.entityType, input.entityType));
      }
      if (input?.entityId) {
        conditions.push(eq(shadowAIAdvisoryFacts.entityId, input.entityId));
      }

      const facts = await db.select()
        .from(shadowAIAdvisoryFacts)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(shadowAIAdvisoryFacts.occurredAt))
        .limit(input?.limit || 100);

      return facts.map(f => ({
        advisoryId: f.advisoryId,
        domain: f.domain,
        entityType: f.entityType,
        entityId: f.entityId,
        recommendation: f.recommendation,
        confidence: parseFloat(f.confidence),
        reasoning: f.reasoning,
        modelVersion: f.modelVersion,
        modelType: f.modelType,
        metadata: f.metadata,
        occurredAt: f.occurredAt.toISOString(),
      }));
    }),

  /**
   * Get Shadow AI advisory facts for a specific entity
   */
  getForEntity: publicProcedure
    .input(z.object({
      entityType: z.enum(["PAYMENT", "DEPOSIT", "LOAN", "EXPOSURE"]),
      entityId: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const facts = await db.select()
        .from(shadowAIAdvisoryFacts)
        .where(and(
          eq(shadowAIAdvisoryFacts.entityType, input.entityType),
          eq(shadowAIAdvisoryFacts.entityId, input.entityId)
        ))
        .orderBy(desc(shadowAIAdvisoryFacts.occurredAt));

      return facts.map(f => ({
        advisoryId: f.advisoryId,
        domain: f.domain,
        recommendation: f.recommendation,
        confidence: parseFloat(f.confidence),
        reasoning: f.reasoning,
        modelVersion: f.modelVersion,
        modelType: f.modelType,
        metadata: f.metadata,
        occurredAt: f.occurredAt.toISOString(),
      }));
    }),

  /**
   * Get Shadow AI domain summary (for Risk Brain Reporter)
   */
  getDomainSummary: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const allFacts = await db.select().from(shadowAIAdvisoryFacts);

      const summary = {
        PAYMENTS_RL: { total: 0, approve: 0, review: 0, decline: 0, avgConfidence: 0 },
        FRAUD: { total: 0, approve: 0, review: 0, decline: 0, avgConfidence: 0 },
        AML: { total: 0, approve: 0, review: 0, decline: 0, avgConfidence: 0 },
        TREASURY: { total: 0, approve: 0, review: 0, decline: 0, avgConfidence: 0 },
      };

      for (const fact of allFacts) {
        const domain = fact.domain;
        summary[domain].total++;
        
        if (fact.recommendation === "APPROVE") summary[domain].approve++;
        if (fact.recommendation === "REVIEW") summary[domain].review++;
        if (fact.recommendation === "DECLINE") summary[domain].decline++;
        
        summary[domain].avgConfidence += parseFloat(fact.confidence);
      }

      // Calculate averages
      for (const domain of Object.keys(summary) as Array<keyof typeof summary>) {
        if (summary[domain].total > 0) {
          summary[domain].avgConfidence = summary[domain].avgConfidence / summary[domain].total;
        }
      }

      return summary;
    }),
});
