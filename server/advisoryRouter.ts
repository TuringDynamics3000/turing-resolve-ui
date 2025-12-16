/**
 * Advisory Router - Human Advisory Override UI (Non-Executing)
 * 
 * CRITICAL: Advisory facts:
 * - Do NOT affect replay
 * - Do NOT change state
 * - Do NOT emit postings
 * - Are visible, auditable, and permanent
 */

import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { advisoryFacts } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export const advisoryRouter = router({
  /**
   * Add an advisory note to an entity.
   * 
   * Advisory notes do NOT execute or override system decisions.
   * They are governance artifacts for human review.
   */
  add: publicProcedure
    .input(z.object({
      entityType: z.enum(["PAYMENT", "ACCOUNT"]),
      entityId: z.string().min(1),
      advisoryType: z.enum([
        "RECOMMEND_RETRY",
        "RECOMMEND_REVERSAL",
        "HOLD_FOR_REVIEW",
        "NO_ACTION"
      ]),
      note: z.string().min(1),
      actor: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const factId = `ADV-${randomUUID()}`;
      const actor = input.actor || ctx.user?.name || ctx.user?.openId || "system";
      const occurredAt = new Date();

      await db.insert(advisoryFacts).values({
        factId,
        entityType: input.entityType,
        entityId: input.entityId,
        advisoryType: input.advisoryType,
        note: input.note,
        actor,
        occurredAt,
      });

      return {
        factId,
        entityType: input.entityType,
        entityId: input.entityId,
        advisoryType: input.advisoryType,
        note: input.note,
        actor,
        occurredAt: occurredAt.toISOString(),
      };
    }),

  /**
   * List advisory notes for an entity.
   */
  list: publicProcedure
    .input(z.object({
      entityType: z.enum(["PAYMENT", "ACCOUNT"]),
      entityId: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const notes = await db
        .select()
        .from(advisoryFacts)
        .where(
          and(
            eq(advisoryFacts.entityType, input.entityType),
            eq(advisoryFacts.entityId, input.entityId)
          )
        )
        .orderBy(desc(advisoryFacts.occurredAt));

      return notes.map((n: typeof advisoryFacts.$inferSelect) => ({
        id: n.id,
        factId: n.factId,
        entityType: n.entityType,
        entityId: n.entityId,
        advisoryType: n.advisoryType,
        note: n.note,
        actor: n.actor,
        occurredAt: n.occurredAt.toISOString(),
      }));
    }),

  /**
   * List all advisory notes (for admin/audit view).
   */
  listAll: publicProcedure
    .input(z.object({
      limit: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const notes = await db
        .select()
        .from(advisoryFacts)
        .orderBy(desc(advisoryFacts.occurredAt))
        .limit(input?.limit || 100);

      return notes.map((n: typeof advisoryFacts.$inferSelect) => ({
        id: n.id,
        factId: n.factId,
        entityType: n.entityType,
        entityId: n.entityId,
        advisoryType: n.advisoryType,
        note: n.note,
        actor: n.actor,
        occurredAt: n.occurredAt.toISOString(),
      }));
    }),
});
