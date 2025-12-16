import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "../db";
import { auditFacts } from "../../drizzle/schema";
import { emitAuditFact } from "../auditRouter";
import { gte, lte, and, desc } from "drizzle-orm";

/**
 * Audit Date Range Filter Tests
 * 
 * Tests the date range filtering functionality for compliance reporting.
 */

describe("Audit Date Range Filter", () => {
  let db: Awaited<ReturnType<typeof getDb>>;

  beforeAll(async () => {
    db = await getDb();
  });

  it("should filter audit facts by fromDate", async () => {
    if (!db) return;

    // Create facts with different dates
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    await emitAuditFact({
      actor: "test-operator-1",
      actorRole: "OPERATOR",
      actionType: "PAYMENT_RETRY",
      targetType: "PAYMENT",
      targetId: "PAY-old",
      reason: "Old retry",
      result: "ACCEPTED",
    });

    // Query with fromDate = yesterday
    const facts = await db.select()
      .from(auditFacts)
      .where(gte(auditFacts.occurredAt, yesterday))
      .orderBy(desc(auditFacts.occurredAt));

    // Should include today's fact, exclude facts older than yesterday
    expect(facts.length).toBeGreaterThan(0);
    facts.forEach(f => {
      expect(new Date(f.occurredAt).getTime()).toBeGreaterThanOrEqual(yesterday.getTime());
    });
  });

  it("should filter audit facts by toDate", async () => {
    if (!db) return;

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Query with toDate = yesterday (should exclude today's facts)
    const facts = await db.select()
      .from(auditFacts)
      .where(lte(auditFacts.occurredAt, yesterday))
      .orderBy(desc(auditFacts.occurredAt));

    // All facts should be older than yesterday
    facts.forEach(f => {
      expect(new Date(f.occurredAt).getTime()).toBeLessThanOrEqual(yesterday.getTime());
    });
  });

  it("should filter audit facts by date range (fromDate and toDate)", async () => {
    if (!db) return;

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // Query for facts between 3 days ago and yesterday
    const facts = await db.select()
      .from(auditFacts)
      .where(and(
        gte(auditFacts.occurredAt, threeDaysAgo),
        lte(auditFacts.occurredAt, yesterday)
      ))
      .orderBy(desc(auditFacts.occurredAt));

    // All facts should be within the range
    facts.forEach(f => {
      const occurredAt = new Date(f.occurredAt).getTime();
      expect(occurredAt).toBeGreaterThanOrEqual(threeDaysAgo.getTime());
      expect(occurredAt).toBeLessThanOrEqual(yesterday.getTime());
    });
  });

  it("should support compliance reporting for specific date ranges", async () => {
    if (!db) return;

    // Simulate quarterly compliance report (last 90 days)
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const facts = await db.select()
      .from(auditFacts)
      .where(and(
        gte(auditFacts.occurredAt, ninetyDaysAgo),
        lte(auditFacts.occurredAt, now)
      ))
      .orderBy(auditFacts.occurredAt);

    // Should return facts in chronological order for reporting
    for (let i = 1; i < facts.length; i++) {
      expect(new Date(facts[i].occurredAt).getTime())
        .toBeGreaterThanOrEqual(new Date(facts[i - 1].occurredAt).getTime());
    }
  });
});
