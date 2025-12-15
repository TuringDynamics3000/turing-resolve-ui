import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createLedgerAccount,
  getLedgerAccount,
  listLedgerAccounts,
  createPosting,
  commitPosting,
  getPosting,
  listPostings,
} from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ============================================
  // LEDGER API (Double-Entry Accounting)
  // ============================================
  ledger: router({
    // Account Operations
    createAccount: publicProcedure
      .input(z.object({
        accountType: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
        name: z.string().min(1),
        currency: z.string().length(3).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ input }) => {
        const account = await createLedgerAccount(input);
        if (!account) {
          throw new Error("Failed to create account");
        }
        return account;
      }),

    getAccount: publicProcedure
      .input(z.object({ accountId: z.string() }))
      .query(async ({ input }) => {
        return await getLedgerAccount(input.accountId);
      }),

    listAccounts: publicProcedure
      .query(async () => {
        return await listLedgerAccounts();
      }),

    // Posting Operations (Money Movement)
    createPosting: publicProcedure
      .input(z.object({
        entries: z.array(z.object({
          accountId: z.string(),
          direction: z.enum(["DEBIT", "CREDIT"]),
          amount: z.string(), // Decimal as string for precision
          description: z.string().optional(),
        })).min(2), // At least 2 entries for double-entry
        description: z.string().nullish(),
        decisionId: z.string().nullish(),
        loanId: z.string().nullish(),
        idempotencyKey: z.string().nullish(),
      }))
      .mutation(async ({ input }) => {
        const result = await createPosting({
          ...input,
          description: input.description ?? undefined,
          decisionId: input.decisionId ?? undefined,
          loanId: input.loanId ?? undefined,
          idempotencyKey: input.idempotencyKey ?? undefined,
        });
        if ("error" in result) {
          throw new Error(result.error);
        }
        return result;
      }),

    commitPosting: publicProcedure
      .input(z.object({ postingId: z.string() }))
      .mutation(async ({ input }) => {
        const result = await commitPosting(input.postingId);
        if (!result.success) {
          throw new Error(result.error || "Failed to commit posting");
        }
        return { success: true, postingId: input.postingId };
      }),

    getPosting: publicProcedure
      .input(z.object({ postingId: z.string() }))
      .query(async ({ input }) => {
        return await getPosting(input.postingId);
      }),

    listPostings: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await listPostings(input?.limit);
      }),

    // Convenience: Create and Commit in one call (for simple cases)
    transfer: publicProcedure
      .input(z.object({
        fromAccountId: z.string(),
        toAccountId: z.string(),
        amount: z.string(),
        description: z.string().nullish(),
        decisionId: z.string().nullish(),
        loanId: z.string().nullish(),
        idempotencyKey: z.string().nullish(),
      }))
      .mutation(async ({ input }) => {
        // Create posting
        const postingResult = await createPosting({
          entries: [
            { accountId: input.fromAccountId, direction: "CREDIT", amount: input.amount, description: input.description ?? undefined },
            { accountId: input.toAccountId, direction: "DEBIT", amount: input.amount, description: input.description ?? undefined },
          ],
          description: input.description ?? undefined,
          decisionId: input.decisionId ?? undefined,
          loanId: input.loanId ?? undefined,
          idempotencyKey: input.idempotencyKey ?? undefined,
        });

        if ("error" in postingResult) {
          throw new Error(postingResult.error);
        }

        // Commit posting
        const commitResult = await commitPosting(postingResult.postingId);
        if (!commitResult.success) {
          throw new Error(commitResult.error || "Failed to commit transfer");
        }

        return {
          success: true,
          postingId: postingResult.postingId,
          entries: postingResult.entries,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
