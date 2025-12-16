/**
 * exportsRouter.ts - GL Export tRPC Routes
 * 
 * Provides read-only GL export endpoints for Lending Core.
 */

import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { eq, and, gte, lte } from "drizzle-orm";
import { loanFacts, loans } from "../drizzle/schema";
import { exportLendingGL, exportGlAsCsv, exportGlAsJson, reconcileGlWithLoans } from "../exports/lendingGlExport";
import type { LoanFact } from "../core/lending";

export const exportsRouter = router({
  /**
   * Export Lending GL for a specific period
   * 
   * GET /trpc/exports.lendingGL?period=YYYY-MM
   * 
   * Returns CSV or JSON based on format parameter.
   */
  lendingGL: publicProcedure
    .input(
      z.object({
        period: z.string().optional(), // YYYY-MM format
        format: z.enum(["csv", "json"]).default("json"),
        loanId: z.string().optional(), // Filter by specific loan
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Parse period filter
      let startDate: Date | undefined;
      let endDate: Date | undefined;
      if (input.period) {
        const [year, month] = input.period.split("-").map(Number);
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0, 23, 59, 59);
      }

      // Build query
      let query = db.select().from(loanFacts);

      const filters = [];
      if (input.loanId) {
        filters.push(eq(loanFacts.loanId, input.loanId));
      }
      if (startDate && endDate) {
        filters.push(gte(loanFacts.occurredAt, startDate));
        filters.push(lte(loanFacts.occurredAt, endDate));
      }

      if (filters.length > 0) {
        query = query.where(and(...filters)) as any;
      }

      const facts = await query;

      // Convert to LoanFact objects
      const loanFactObjects: LoanFact[] = facts.map((f: any) => f.factData as LoanFact);

      // Generate GL entries
      const glEntries = exportLendingGL(loanFactObjects);

      // Return in requested format
      if (input.format === "csv") {
        return {
          format: "csv" as const,
          data: exportGlAsCsv(glEntries),
          entryCount: glEntries.length,
        };
      } else {
        return {
          format: "json" as const,
          data: exportGlAsJson(glEntries),
          entries: glEntries,
          entryCount: glEntries.length,
        };
      }
    }),

  /**
   * Reconcile GL export with loan balances
   * 
   * Verifies that GL entries match derived loan state.
   */
  reconcileLendingGL: publicProcedure
    .input(z.object({ period: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get all loan facts
      const facts = await db.select().from(loanFacts);
      const loanFactObjects: LoanFact[] = facts.map((f: any) => f.factData as LoanFact);

      // Get all loans
      const allLoans = await db.select().from(loans);
      const loanBalances = allLoans.map((l: any) => ({
        loanId: l.loanId,
        principal: BigInt(l.principal),
      }));

      // Generate GL entries
      const glEntries = exportLendingGL(loanFactObjects);

      // Reconcile
      const reconciliation = reconcileGlWithLoans(glEntries, loanBalances);

      return {
        isReconciled: reconciliation.isReconciled,
        totalLoans: loanBalances.length,
        totalGlEntries: glEntries.length,
        discrepancies: reconciliation.discrepancies.map((d) => ({
          loanId: d.loanId,
          glBalance: d.glBalance.toString(),
          loanBalance: d.loanBalance.toString(),
          diff: d.diff.toString(),
        })),
      };
    }),
});
