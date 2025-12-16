import { z } from "zod";
import { router, publicProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { auditFacts } from "../drizzle/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * Audit Router - Append-only audit facts for operator accountability
 * 
 * CRITICAL: Audit facts:
 * - Are append-only (never updated or deleted)
 * - Survive replay
 * - Are exportable for regulator reports
 * - Cover ALL operator actions
 */

export const auditRouter = router({
  /**
   * Record an audit fact for an operator action.
   * This is called internally by other routers when operators perform actions.
   */
  recordAction: publicProcedure
    .input(z.object({
      actor: z.string().min(1),
      actorRole: z.string().min(1),
      actionType: z.enum([
        "KILL_SWITCH_ENABLE",
        "KILL_SWITCH_DISABLE",
        "PAYMENT_RETRY",
        "PAYMENT_REVERSE",
        "ADVISORY_NOTE_ADDED",
        "INCIDENT_ANNOTATION"
      ]),
      targetType: z.enum(["PAYMENT", "ACCOUNT", "ADAPTER", "SYSTEM"]),
      targetId: z.string().min(1),
      reason: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
      result: z.enum(["ACCEPTED", "REJECTED"]),
      resultReason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const factId = `AUDIT-${nanoid(16)}`;
      const now = new Date();

      await db.insert(auditFacts).values({
        factId,
        actor: input.actor,
        actorRole: input.actorRole,
        actionType: input.actionType,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason || null,
        metadata: input.metadata || null,
        result: input.result,
        resultReason: input.resultReason || null,
        occurredAt: now,
      });

      return { factId, occurredAt: now.toISOString() };
    }),

  /**
   * List audit facts with optional filtering.
   */
  list: publicProcedure
    .input(z.object({
      actor: z.string().optional(),
      actionType: z.enum([
        "KILL_SWITCH_ENABLE",
        "KILL_SWITCH_DISABLE",
        "PAYMENT_RETRY",
        "PAYMENT_REVERSE",
        "ADVISORY_NOTE_ADDED",
        "INCIDENT_ANNOTATION"
      ]).optional(),
      targetType: z.enum(["PAYMENT", "ACCOUNT", "ADAPTER", "SYSTEM"]).optional(),
      targetId: z.string().optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      limit: z.number().min(1).max(1000).default(100),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [];

      if (input.actor) {
        conditions.push(eq(auditFacts.actor, input.actor));
      }
      if (input.actionType) {
        conditions.push(eq(auditFacts.actionType, input.actionType));
      }
      if (input.targetType) {
        conditions.push(eq(auditFacts.targetType, input.targetType));
      }
      if (input.targetId) {
        conditions.push(eq(auditFacts.targetId, input.targetId));
      }
      if (input.fromDate) {
        conditions.push(gte(auditFacts.occurredAt, new Date(input.fromDate)));
      }
      if (input.toDate) {
        conditions.push(lte(auditFacts.occurredAt, new Date(input.toDate)));
      }

      const facts = await db.select()
        .from(auditFacts)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(auditFacts.occurredAt))
        .limit(input.limit);

      return facts.map(f => ({
        factId: f.factId,
        actor: f.actor,
        actorRole: f.actorRole,
        actionType: f.actionType,
        targetType: f.targetType,
        targetId: f.targetId,
        reason: f.reason,
        metadata: f.metadata,
        result: f.result,
        resultReason: f.resultReason,
        occurredAt: f.occurredAt.toISOString(),
      }));
    }),

  /**
   * Export audit facts for regulator reports.
   * Returns all facts in a format suitable for compliance reporting.
   */
  export: publicProcedure
    .input(z.object({
      fromDate: z.string(),
      toDate: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const facts = await db.select()
        .from(auditFacts)
        .where(and(
          gte(auditFacts.occurredAt, new Date(input.fromDate)),
          lte(auditFacts.occurredAt, new Date(input.toDate))
        ))
        .orderBy(auditFacts.occurredAt);

      return {
        exportedAt: new Date().toISOString(),
        fromDate: input.fromDate,
        toDate: input.toDate,
        totalRecords: facts.length,
        facts: facts.map(f => ({
          factId: f.factId,
          actor: f.actor,
          actorRole: f.actorRole,
          actionType: f.actionType,
          targetType: f.targetType,
          targetId: f.targetId,
          reason: f.reason,
          result: f.result,
          resultReason: f.resultReason,
          occurredAt: f.occurredAt.toISOString(),
        })),
      };
    }),
});

/**
 * Helper function to emit audit facts from other routers.
 * This ensures consistent audit emission across all operator actions.
 */
export async function emitAuditFact(params: {
  actor: string;
  actorRole: string;
  actionType: "KILL_SWITCH_ENABLE" | "KILL_SWITCH_DISABLE" | "PAYMENT_RETRY" | "PAYMENT_REVERSE" | "ADVISORY_NOTE_ADDED" | "INCIDENT_ANNOTATION";
  targetType: "PAYMENT" | "ACCOUNT" | "ADAPTER" | "SYSTEM";
  targetId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  result: "ACCEPTED" | "REJECTED";
  resultReason?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const factId = `AUDIT-${nanoid(16)}`;
  const now = new Date();

  await db.insert(auditFacts).values({
    factId,
    actor: params.actor,
    actorRole: params.actorRole,
    actionType: params.actionType,
    targetType: params.targetType,
    targetId: params.targetId,
    reason: params.reason || null,
    metadata: params.metadata || null,
    result: params.result,
    resultReason: params.resultReason || null,
    occurredAt: now,
  });

  return { factId, occurredAt: now };
}
