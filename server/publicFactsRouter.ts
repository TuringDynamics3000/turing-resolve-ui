import { z } from "zod";
import { router, publicProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { paymentFacts, depositFacts, auditFacts } from "../drizzle/schema";
import { desc, gte, lte, and, eq } from "drizzle-orm";

/**
 * Public Facts Router - Read-only fact queries for Digital Twin integration
 * 
 * CRITICAL: This router provides read-only access to facts for external systems.
 * - NO mutations allowed
 * - NO state computation
 * - Facts only, in chronological order
 * - Designed for digital twin consumption
 */

export const publicFactsRouter = router({
  /**
   * Query payment facts with optional filtering
   */
  queryPaymentFacts: publicProcedure
    .input(z.object({
      paymentId: z.string().optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      limit: z.number().min(1).max(1000).default(100),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [];

      if (input.paymentId) {
        conditions.push(eq(paymentFacts.paymentId, input.paymentId));
      }
      if (input.fromDate) {
        conditions.push(gte(paymentFacts.occurredAt, new Date(input.fromDate)));
      }
      if (input.toDate) {
        conditions.push(lte(paymentFacts.occurredAt, new Date(input.toDate)));
      }

      const facts = await db.select()
        .from(paymentFacts)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(paymentFacts.occurredAt))
        .limit(input.limit);

      return facts.map(f => ({
        paymentId: f.paymentId,
        factType: f.factType,
        sequence: f.sequence,
        factData: f.factData,
        depositFactId: f.depositFactId,
        depositPostingType: f.depositPostingType,
        decisionId: f.decisionId,
        occurredAt: f.occurredAt.toISOString(),
      }));
    }),

  /**
   * Query deposit facts with optional filtering
   */
  queryDepositFacts: publicProcedure
    .input(z.object({
      accountId: z.string().optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      limit: z.number().min(1).max(1000).default(100),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [];

      if (input.accountId) {
        conditions.push(eq(depositFacts.accountId, input.accountId));
      }
      if (input.fromDate) {
        conditions.push(gte(depositFacts.occurredAt, new Date(input.fromDate)));
      }
      if (input.toDate) {
        conditions.push(lte(depositFacts.occurredAt, new Date(input.toDate)));
      }

      const facts = await db.select()
        .from(depositFacts)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(depositFacts.occurredAt))
        .limit(input.limit);

      return facts.map(f => ({
        factId: f.factId,
        accountId: f.accountId,
        factType: f.factType,
        sequence: f.sequence,
        factData: f.factData,
        decisionId: f.decisionId,
        commandId: f.commandId,
        occurredAt: f.occurredAt.toISOString(),
      }));
    }),

  /**
   * Query audit facts with optional filtering
   */
  queryAuditFacts: publicProcedure
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
   * Get system health for digital twin monitoring
   */
  getSystemHealth: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Count recent facts (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [paymentFactCount] = await db.select()
        .from(paymentFacts)
        .where(gte(paymentFacts.occurredAt, oneDayAgo));

      const [depositFactCount] = await db.select()
        .from(depositFacts)
        .where(gte(depositFacts.occurredAt, oneDayAgo));

      const [auditFactCount] = await db.select()
        .from(auditFacts)
        .where(gte(auditFacts.occurredAt, oneDayAgo));

      return {
        status: "healthy",
        timestamp: new Date().toISOString(),
        factsLast24h: {
          payment: paymentFactCount ? 1 : 0,
          deposit: depositFactCount ? 1 : 0,
          audit: auditFactCount ? 1 : 0,
        },
      };
    }),
});
