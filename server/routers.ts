import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getDecisions,
  getDecision,
  getEvidencePacks,
  getModules,
  getReplayProofs,
  getSystemSummary,
  GOVERNANCE_BOUNDARIES,
  INTERNAL_DECLARATIONS,
  RELEASE_INFO,
  type EvidencePack,
} from "./governance";
import {
  createLedgerAccount,
  getLedgerAccount,
  listLedgerAccounts,
  createPosting,
  commitPosting,
  getPosting,
  listPostings,
  reversePosting,
} from "./db";
import { depositsRouter } from "./depositsRouter";
import { paymentsRouter } from "./paymentsRouter";
import { advisoryRouter } from "./advisoryRouter";
import { auditRouter } from "./auditRouter";
import { mlRouter } from "./mlRouter";
import { rbacRouter } from "./rbacRouter";
import { policyRouter } from "./policyRouter";
import { forbiddenRouter } from "./forbiddenRouter";
import { opsRouter } from "./opsRouter";
import { ledgerRouter as glLedgerRouter } from "./ledgerRouter";
import { getSealerStatus, forceSeal, generateEvidencePack, verifyEvidencePack, type EvidencePack as VerifiableEvidencePack } from "./services";

export const appRouter = router({
  system: systemRouter,
  deposits: depositsRouter,
  payments: paymentsRouter,
  advisory: advisoryRouter,
  audit: auditRouter,
  ml: mlRouter,
  rbac: rbacRouter,
  policy: policyRouter,
  forbidden: forbiddenRouter,
  ops: opsRouter, // Ops Console - decisions, limits, health
  gl: glLedgerRouter, // Bank-grade double-entry GL
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
  // MERKLE SEALER API
  // ============================================
  sealer: router({
    // Get sealer status for operator monitoring
    status: publicProcedure.query(() => {
      const status = getSealerStatus();
      return {
        enabled: status.enabled,
        running: status.running,
        isSealing: status.isSealing,
        sealCount: status.sealCount,
        lastSealTime: status.lastSealTime?.toISOString() || null,
        health: status.running ? 'HEALTHY' : 'STOPPED',
      };
    }),

    // Force immediate seal (admin only in production)
    forceSeal: publicProcedure.mutation(async () => {
      await forceSeal();
      return { success: true, message: 'Seal triggered' };
    }),
  }),

  // ============================================
  // EVIDENCE PACK API
  // ============================================
  evidencePacks: router({
    // Generate evidence pack for a decision
    generate: publicProcedure
      .input(z.object({
        decisionId: z.string(),
        includeEvents: z.boolean().optional(),
        includeProofs: z.boolean().optional(),
      }))
      .query(async ({ input }) => {
        const pack = await generateEvidencePack(input.decisionId);
        return pack;
      }),

    // Verify an evidence pack
    verify: publicProcedure
      .input(z.object({
        pack: z.any(), // EvidencePack type
      }))
      .mutation(({ input }) => {
        const result = verifyEvidencePack(input.pack as VerifiableEvidencePack);
        return result;
      }),

    // Get evidence pack by decision ID (alias for generate)
    getByDecisionId: publicProcedure
      .input(z.object({ decisionId: z.string() }))
      .query(async ({ input }) => {
        return await generateEvidencePack(input.decisionId);
      }),
  }),

  // ============================================
  // GOVERNANCE API (TuringCore-v3 Integration)
  // ============================================
  governance: router({
    // System Summary
    getSystemSummary: publicProcedure.query(async () => {
      return await getSystemSummary();
    }),

    // Decisions
    listDecisions: publicProcedure
      .input(z.object({
        entityType: z.enum(["LOAN", "PAYMENT", "DEPOSIT", "EXPOSURE"]).optional(),
        outcome: z.enum(["ALLOW", "REVIEW", "DECLINE"]).optional(),
        limit: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        const decisions = await getDecisions();
        let filtered = decisions;
        
        if (input?.entityType) {
          filtered = filtered.filter(d => d.entityType === input.entityType);
        }
        if (input?.outcome) {
          filtered = filtered.filter(d => d.outcome === input.outcome);
        }
        if (input?.limit) {
          filtered = filtered.slice(0, input.limit);
        }
        
        return filtered;
      }),

    getDecision: publicProcedure
      .input(z.object({ decisionId: z.string() }))
      .query(async ({ input }) => {
        return await getDecision(input.decisionId);
      }),

    // Evidence Packs
    listEvidencePacks: publicProcedure
      .input(z.object({
        entityType: z.string().optional(),
        limit: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        const packs = await getEvidencePacks();
        let filtered = packs;
        
        if (input?.entityType) {
          filtered = filtered.filter(e => e.entityType === input.entityType);
        }
        if (input?.limit) {
          filtered = filtered.slice(0, input.limit);
        }
        
        return filtered;
      }),

    getEvidencePack: publicProcedure
      .input(z.object({ decisionId: z.string() }))
      .query(async ({ input }) => {
        const packs = await getEvidencePacks();
        return packs.find(p => p.decisionId === input.decisionId) || null;
      }),

    // Module Status
    listModules: publicProcedure.query(async () => {
      return await getModules();
    }),

    getModule: publicProcedure
      .input(z.object({ moduleId: z.string() }))
      .query(async ({ input }) => {
        const modules = await getModules();
        return modules.find(m => m.moduleId === input.moduleId) || null;
      }),

    // Governance Boundaries (static data)
    listBoundaries: publicProcedure.query(() => {
      return GOVERNANCE_BOUNDARIES;
    }),

    // Internal Declarations (static data)
    listDeclarations: publicProcedure.query(() => {
      return INTERNAL_DECLARATIONS;
    }),

    // Release Info (static data)
    getReleaseInfo: publicProcedure.query(() => {
      return RELEASE_INFO;
    }),

    // Replay Proofs
    listReplayProofs: publicProcedure
      .input(z.object({ moduleName: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const proofs = await getReplayProofs();
        
        if (input?.moduleName) {
          return proofs.filter(p => p.moduleName.toLowerCase() === input.moduleName!.toLowerCase());
        }
        
        return proofs;
      }),
  }),

  // ============================================
  // LEDGER API (Double-Entry Accounting)
  // ============================================
  ledger: router({
    // GL Operations (from glLedgerRouter)
    ...glLedgerRouter._def.procedures,
    
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

    reversePosting: publicProcedure
      .input(z.object({
        postingId: z.string(),
        reason: z.string(),
        reversedBy: z.string().nullish(),
      }))
      .mutation(async ({ input }) => {
        const result = await reversePosting({
          postingId: input.postingId,
          reason: input.reason,
          reversedBy: input.reversedBy ?? undefined,
        });
        if (!result.success) {
          throw new Error(result.error || "Failed to reverse posting");
        }
        return { success: true, reversalPostingId: result.reversalPostingId };
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
