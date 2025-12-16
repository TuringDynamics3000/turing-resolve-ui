import { router, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { paymentFacts, depositFacts, auditFacts, shadowAIAdvisoryFacts } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { generateEvidencePackPDF } from "./evidencePackPDF";

export const evidencePackRouter = router({
  // Get evidence pack data for a payment
  getForPayment: publicProcedure
    .input(z.object({ paymentId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get payment facts
      const pFacts = await db
        .select()
        .from(paymentFacts)
        .where(eq(paymentFacts.paymentId, input.paymentId))
        .orderBy(paymentFacts.sequence);

      // Get deposit facts (no direct paymentId link - would need to join through decisionId)
      // For now, return empty array or query by decisionId if available
      const dFacts: any[] = [];

      // Get audit facts for this payment
      const aFacts = await db
        .select()
        .from(auditFacts)
        .where(
          and(
            eq(auditFacts.targetType, "PAYMENT"),
            eq(auditFacts.targetId, input.paymentId)
          )
        )
        .orderBy(auditFacts.occurredAt);

      // Get Shadow AI advisories for this payment
      const shadowAdvisories = await db
        .select()
        .from(shadowAIAdvisoryFacts)
        .where(
          and(
            eq(shadowAIAdvisoryFacts.entityType, "PAYMENT"),
            eq(shadowAIAdvisoryFacts.entityId, input.paymentId)
          )
        )
        .orderBy(shadowAIAdvisoryFacts.occurredAt);

      return {
        paymentId: input.paymentId,
        paymentFacts: pFacts,
        depositFacts: dFacts,
        auditFacts: aFacts,
        shadowAIAdvisories: shadowAdvisories,
      };
    }),

  // Export evidence pack as PDF (returns base64)
  exportPDF: publicProcedure
    .input(z.object({ paymentId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get all facts
      const pFacts = await db
        .select()
        .from(paymentFacts)
        .where(eq(paymentFacts.paymentId, input.paymentId))
        .orderBy(paymentFacts.sequence);

      // Get deposit facts (no direct paymentId link)
      const dFacts: any[] = [];

      const aFacts = await db
        .select()
        .from(auditFacts)
        .where(
          and(
            eq(auditFacts.targetType, "PAYMENT"),
            eq(auditFacts.targetId, input.paymentId)
          )
        )
        .orderBy(auditFacts.occurredAt);

      const shadowAdvisories = await db
        .select()
        .from(shadowAIAdvisoryFacts)
        .where(
          and(
            eq(shadowAIAdvisoryFacts.entityType, "PAYMENT"),
            eq(shadowAIAdvisoryFacts.entityId, input.paymentId)
          )
        )
        .orderBy(shadowAIAdvisoryFacts.occurredAt);

      // Determine decision based on payment state
      const lastFact = pFacts[pFacts.length - 1];
      const decision = lastFact?.factType || "UNKNOWN";

      // Generate PDF
      const pdfStream = generateEvidencePackPDF({
        decisionId: input.paymentId,
        decision,
        timestamp: lastFact?.occurredAt || new Date(),
        paymentFacts: pFacts,
        depositFacts: dFacts,
        auditFacts: aFacts,
        shadowAIAdvisories: shadowAdvisories,
      });

      // Convert stream to base64
      const chunks: Buffer[] = [];
      return new Promise<{ pdf: string; filename: string }>((resolve, reject) => {
        pdfStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        pdfStream.on("end", () => {
          const buffer = Buffer.concat(chunks);
          const base64 = buffer.toString("base64");
          resolve({
            pdf: base64,
            filename: `evidence-pack-${input.paymentId}.pdf`,
          });
        });
        pdfStream.on("error", reject);
      });
    }),
});
