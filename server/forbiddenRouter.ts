/**
 * Forbidden Commands Router
 * 
 * These commands are STRUCTURALLY FORBIDDEN - they cannot be executed
 * by any role, under any circumstances. This is a compliance requirement.
 * 
 * Every attempt emits an authority fact with decision=DENY and reason=FORBIDDEN_COMMAND.
 * This provides cryptographic proof that these operations are impossible.
 * 
 * Forbidden Commands:
 * - ADJUST_BALANCE: Direct balance manipulation (bypasses ledger)
 * - WRITE_OFF_LOAN: Loan write-off without proper workflow
 * - FORCE_POST_PAYMENT: Payment posting without validation
 * - DELETE_MODEL: Model deletion (models are immutable)
 */

import { z } from 'zod';
import { router, protectedProcedure } from './_core/trpc';
import { TRPCError } from '@trpc/server';
import { 
  RBACService, 
  COMMANDS,
  type AuthorizationContext 
} from './core/auth/RBACService';

// ============================================
// RBAC SERVICE
// ============================================

const rbacService = new RBACService();

/**
 * Emit authority fact for forbidden command attempt
 * Always returns FORBIDDEN - no role can execute these commands
 */
async function emitForbiddenAttempt(
  ctx: { user?: { openId: string; name?: string | null } | null },
  commandCode: string,
  resourceId?: string,
  domain: string = 'OPS'
): Promise<never> {
  const actorId = ctx.user?.openId || 'anonymous';
  
  const authCtx: AuthorizationContext = {
    actorId,
    scope: {
      tenantId: 'default',
      environmentId: 'prod',
      domain,
    },
  };
  
  // This will always fail with FORBIDDEN_COMMAND
  // The RBACService will emit the authority fact
  const result = await rbacService.authorize(authCtx, commandCode, resourceId);
  
  // Even if somehow authorized (shouldn't happen), still deny
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: `FORBIDDEN_COMMAND: ${commandCode} is structurally forbidden. No role can execute this command. This attempt has been logged to the authority facts audit trail.`,
  });
}

// ============================================
// FORBIDDEN COMMANDS ROUTER
// ============================================

export const forbiddenRouter = router({
  /**
   * ADJUST_BALANCE - Direct balance manipulation
   * 
   * FORBIDDEN: This command bypasses the ledger and violates double-entry accounting.
   * All balance changes MUST go through the deposits/payments routers which
   * emit proper facts and maintain audit trails.
   * 
   * Compliance: SOX, PCI-DSS, APRA CPS 234
   */
  adjustBalance: protectedProcedure
    .input(z.object({
      accountId: z.string(),
      amount: z.string(),
      reason: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      await emitForbiddenAttempt(
        ctx, 
        COMMANDS.ADJUST_BALANCE, 
        input.accountId,
        'DEPOSITS'
      );
    }),
  
  /**
   * WRITE_OFF_LOAN - Direct loan write-off
   * 
   * FORBIDDEN: Loan write-offs require a proper workflow with:
   * - Risk assessment
   * - Multiple approvals (maker/checker)
   * - Ledger entries for loss recognition
   * - Regulatory reporting
   * 
   * Use the lending workflow instead.
   * 
   * Compliance: IFRS 9, APRA APS 220
   */
  writeOffLoan: protectedProcedure
    .input(z.object({
      loanId: z.string(),
      amount: z.string(),
      reason: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      await emitForbiddenAttempt(
        ctx, 
        COMMANDS.WRITE_OFF_LOAN, 
        input.loanId,
        'LENDING'
      );
    }),
  
  /**
   * FORCE_POST_PAYMENT - Payment posting without validation
   * 
   * FORBIDDEN: All payments MUST go through the payments router which:
   * - Validates sufficient funds
   * - Checks fraud rules
   * - Enforces velocity limits
   * - Emits proper facts
   * 
   * Compliance: PCI-DSS, AML/CTF
   */
  forcePostPayment: protectedProcedure
    .input(z.object({
      fromAccount: z.string(),
      toAccount: z.string(),
      amount: z.string(),
      reason: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      await emitForbiddenAttempt(
        ctx, 
        COMMANDS.FORCE_POST_PAYMENT, 
        `${input.fromAccount}:${input.toAccount}`,
        'PAYMENTS'
      );
    }),
  
  /**
   * DELETE_MODEL - Model deletion
   * 
   * FORBIDDEN: Models are immutable for audit purposes.
   * - Model versions can be deprecated but never deleted
   * - This ensures reproducibility of past decisions
   * - Required for regulatory model validation
   * 
   * Use model deprecation instead.
   * 
   * Compliance: SR 11-7, APRA CPG 235
   */
  deleteModel: protectedProcedure
    .input(z.object({
      modelId: z.string(),
      version: z.string().optional(),
      reason: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      await emitForbiddenAttempt(
        ctx, 
        COMMANDS.DELETE_MODEL, 
        input.version ? `${input.modelId}:${input.version}` : input.modelId,
        'ML'
      );
    }),
  
  /**
   * Query: List all forbidden commands
   * 
   * Returns the list of structurally forbidden commands with their
   * compliance rationale. This is public information for transparency.
   */
  listForbiddenCommands: protectedProcedure.query(async () => {
    return [
      {
        commandCode: COMMANDS.ADJUST_BALANCE,
        domain: 'DEPOSITS',
        description: 'Direct balance manipulation',
        rationale: 'Bypasses ledger and violates double-entry accounting',
        compliance: ['SOX', 'PCI-DSS', 'APRA CPS 234'],
        alternative: 'Use deposits.credit() or deposits.debit() with proper facts',
      },
      {
        commandCode: COMMANDS.WRITE_OFF_LOAN,
        domain: 'LENDING',
        description: 'Direct loan write-off',
        rationale: 'Requires proper workflow with risk assessment and approvals',
        compliance: ['IFRS 9', 'APRA APS 220'],
        alternative: 'Use lending workflow with maker/checker approval',
      },
      {
        commandCode: COMMANDS.FORCE_POST_PAYMENT,
        domain: 'PAYMENTS',
        description: 'Payment posting without validation',
        rationale: 'Bypasses fraud checks, velocity limits, and fund validation',
        compliance: ['PCI-DSS', 'AML/CTF'],
        alternative: 'Use payments.initiatePayment() with proper validation',
      },
      {
        commandCode: COMMANDS.DELETE_MODEL,
        domain: 'ML',
        description: 'Model deletion',
        rationale: 'Models are immutable for audit and reproducibility',
        compliance: ['SR 11-7', 'APRA CPG 235'],
        alternative: 'Use ml.deprecateModel() to mark as deprecated',
      },
    ];
  }),
});
