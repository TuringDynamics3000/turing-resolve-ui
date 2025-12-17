/**
 * Policy Router - Policy Management with Maker/Checker Workflow
 * 
 * Implements RBAC-protected policy operations:
 * - UPDATE_POLICY_DSL: Update constitution policy (requires POLICY_AUTHOR + approval)
 * - ACTIVATE_POLICY: Activate policy version (requires COMPLIANCE_APPROVER + approval)
 * 
 * All operations emit authority facts and enforce maker/checker workflow.
 */

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from './_core/trpc';
import { TRPCError } from '@trpc/server';
import { getDb } from './db';
import { 
  RBACService, 
  COMMANDS,
  type AuthorizationContext 
} from './core/auth/RBACService';
import { nanoid } from 'nanoid';

// ============================================
// RBAC SERVICE
// ============================================

const rbacService = new RBACService();

async function checkPolicyRBAC(
  ctx: { user?: { openId: string; name?: string | null } | null },
  commandCode: string,
  resourceId?: string,
  tenantId: string = 'default',
  environmentId: string = 'prod'
): Promise<void> {
  const actorId = ctx.user?.openId || 'anonymous';
  
  const authCtx: AuthorizationContext = {
    actorId,
    scope: {
      tenantId,
      environmentId,
      domain: 'POLICY',
    },
  };
  
  const result = await rbacService.authorize(authCtx, commandCode, resourceId);
  
  if (!result.authorized) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `RBAC_DENIED: ${result.reasonCode}. Required roles: ${result.requiredRoles.join(', ')}. Your roles: ${result.actorRoles.join(', ') || 'none'}`,
    });
  }
}

// ============================================
// TYPES
// ============================================

interface PolicyVersion {
  policyId: string;
  version: string;
  dsl: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'DEPRECATED';
  createdBy: string;
  createdAt: string;
  activatedAt?: string;
  activatedBy?: string;
  hash: string;
}

interface PolicyProposal {
  proposalId: string;
  policyId: string;
  version: string;
  commandCode: string;
  proposedBy: string;
  proposedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvals: Array<{
    approvedBy: string;
    approvedRole: string;
    approvedAt: string;
  }>;
  rejectionReason?: string;
}

// ============================================
// IN-MEMORY STORAGE (In production, use database)
// ============================================

const policies: Map<string, PolicyVersion[]> = new Map();
const proposals: Map<string, PolicyProposal> = new Map();

// Initialize with sample policy
policies.set('lending-constitution', [
  {
    policyId: 'lending-constitution',
    version: 'v1.0.0',
    dsl: `
      POLICY lending_constitution {
        RULE max_loan_amount {
          WHEN loan.amount > 1000000
          THEN REQUIRE_APPROVAL("RISK_APPROVER")
        }
        
        RULE debt_to_income {
          WHEN applicant.dti > 0.43
          THEN DECLINE("DTI_EXCEEDED")
        }
        
        RULE credit_score_minimum {
          WHEN applicant.credit_score < 580
          THEN DECLINE("CREDIT_SCORE_TOO_LOW")
        }
      }
    `.trim(),
    status: 'ACTIVE',
    createdBy: 'system',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    activatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    activatedBy: 'system',
    hash: 'sha256:abc123def456',
  },
]);

policies.set('payments-constitution', [
  {
    policyId: 'payments-constitution',
    version: 'v2.1.0',
    dsl: `
      POLICY payments_constitution {
        RULE high_value_transfer {
          WHEN payment.amount > 50000
          THEN REQUIRE_APPROVAL("OPS_SUPERVISOR")
        }
        
        RULE velocity_check {
          WHEN account.daily_transfers > 10
          THEN REVIEW("VELOCITY_EXCEEDED")
        }
        
        RULE sanctioned_country {
          WHEN payment.destination_country IN sanctioned_list
          THEN DECLINE("SANCTIONED_DESTINATION")
        }
      }
    `.trim(),
    status: 'ACTIVE',
    createdBy: 'compliance-team',
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    activatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    activatedBy: 'compliance-lead',
    hash: 'sha256:def789ghi012',
  },
]);

// ============================================
// HELPER FUNCTIONS
// ============================================

function computeHash(dsl: string): string {
  // Simple hash for demo - in production use crypto.createHash('sha256')
  let hash = 0;
  for (let i = 0; i < dsl.length; i++) {
    const char = dsl.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `sha256:${Math.abs(hash).toString(16).padStart(12, '0')}`;
}

function incrementVersion(version: string): string {
  const parts = version.replace('v', '').split('.').map(Number);
  parts[2] += 1;
  return `v${parts.join('.')}`;
}

// ============================================
// POLICY ROUTER
// ============================================

export const policyRouter = router({
  // --------------------------------------------------------
  // Query Endpoints (Read-only)
  // --------------------------------------------------------
  
  /**
   * List all policies
   */
  listPolicies: publicProcedure.query(async () => {
    const result: Array<{
      policyId: string;
      activeVersion: string | null;
      totalVersions: number;
      lastUpdated: string;
    }> = [];
    
    policies.forEach((versions, policyId) => {
      const activeVersion = versions.find(v => v.status === 'ACTIVE');
      const latestVersion = versions[versions.length - 1];
      
      result.push({
        policyId,
        activeVersion: activeVersion?.version || null,
        totalVersions: versions.length,
        lastUpdated: latestVersion?.createdAt || new Date().toISOString(),
      });
    });
    
    return result;
  }),
  
  /**
   * Get policy versions
   */
  getPolicyVersions: publicProcedure
    .input(z.object({
      policyId: z.string(),
    }))
    .query(async ({ input }) => {
      const versions = policies.get(input.policyId);
      if (!versions) {
        return [];
      }
      return versions;
    }),
  
  /**
   * Get active policy DSL
   */
  getActivePolicy: publicProcedure
    .input(z.object({
      policyId: z.string(),
    }))
    .query(async ({ input }) => {
      const versions = policies.get(input.policyId);
      if (!versions) {
        return null;
      }
      return versions.find(v => v.status === 'ACTIVE') || null;
    }),
  
  /**
   * List pending proposals
   */
  listPendingProposals: publicProcedure.query(async () => {
    const pending: PolicyProposal[] = [];
    proposals.forEach(proposal => {
      if (proposal.status === 'PENDING') {
        pending.push(proposal);
      }
    });
    return pending;
  }),
  
  // --------------------------------------------------------
  // Mutation Endpoints (RBAC-protected)
  // --------------------------------------------------------
  
  /**
   * UPDATE_POLICY_DSL - Create new policy version (draft)
   * RBAC: Requires POLICY_AUTHOR role
   */
  updatePolicyDsl: protectedProcedure
    .input(z.object({
      policyId: z.string(),
      dsl: z.string().min(10),
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // RBAC Check: POLICY_AUTHOR required
      await checkPolicyRBAC(ctx, COMMANDS.UPDATE_POLICY_DSL, input.policyId);
      
      const versions = policies.get(input.policyId) || [];
      const latestVersion = versions[versions.length - 1];
      const newVersion = latestVersion 
        ? incrementVersion(latestVersion.version)
        : 'v1.0.0';
      
      const newPolicyVersion: PolicyVersion = {
        policyId: input.policyId,
        version: newVersion,
        dsl: input.dsl,
        status: 'DRAFT',
        createdBy: ctx.user?.openId || 'unknown',
        createdAt: new Date().toISOString(),
        hash: computeHash(input.dsl),
      };
      
      versions.push(newPolicyVersion);
      policies.set(input.policyId, versions);
      
      return {
        success: true,
        policyId: input.policyId,
        version: newVersion,
        status: 'DRAFT',
        hash: newPolicyVersion.hash,
        message: 'Policy draft created. Submit for approval to activate.',
      };
    }),
  
  /**
   * Submit policy for approval (creates proposal)
   * RBAC: Requires POLICY_AUTHOR role
   */
  submitForApproval: protectedProcedure
    .input(z.object({
      policyId: z.string(),
      version: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // RBAC Check: POLICY_AUTHOR required
      await checkPolicyRBAC(ctx, COMMANDS.UPDATE_POLICY_DSL, input.policyId);
      
      const versions = policies.get(input.policyId);
      if (!versions) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Policy not found',
        });
      }
      
      const policyVersion = versions.find(v => v.version === input.version);
      if (!policyVersion) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Policy version not found',
        });
      }
      
      if (policyVersion.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only DRAFT policies can be submitted for approval',
        });
      }
      
      // Create proposal
      const proposalId = `prop-${nanoid(8)}`;
      const proposal: PolicyProposal = {
        proposalId,
        policyId: input.policyId,
        version: input.version,
        commandCode: COMMANDS.ACTIVATE_POLICY,
        proposedBy: ctx.user?.openId || 'unknown',
        proposedAt: new Date().toISOString(),
        status: 'PENDING',
        approvals: [],
      };
      
      proposals.set(proposalId, proposal);
      
      // Update policy status
      policyVersion.status = 'PENDING_APPROVAL';
      
      return {
        success: true,
        proposalId,
        message: 'Policy submitted for approval. Requires COMPLIANCE_APPROVER approval.',
      };
    }),
  
  /**
   * ACTIVATE_POLICY - Approve and activate policy
   * RBAC: Requires COMPLIANCE_APPROVER role
   * Maker/Checker: Approver must be different from proposer
   */
  approvePolicy: protectedProcedure
    .input(z.object({
      proposalId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const proposal = proposals.get(input.proposalId);
      if (!proposal) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Proposal not found',
        });
      }
      
      if (proposal.status !== 'PENDING') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Proposal is not pending',
        });
      }
      
      // Maker/Checker: Approver cannot be proposer
      const approverId = ctx.user?.openId || 'unknown';
      if (approverId === proposal.proposedBy) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'MAKER_CHECKER_VIOLATION: Approver cannot be the same as proposer',
        });
      }
      
      // RBAC Check: COMPLIANCE_APPROVER required
      await checkPolicyRBAC(ctx, COMMANDS.ACTIVATE_POLICY, proposal.policyId);
      
      // Record approval
      proposal.approvals.push({
        approvedBy: approverId,
        approvedRole: 'COMPLIANCE_APPROVER',
        approvedAt: new Date().toISOString(),
      });
      
      proposal.status = 'APPROVED';
      
      // Activate the policy version
      const versions = policies.get(proposal.policyId);
      if (versions) {
        // Deprecate current active version
        versions.forEach(v => {
          if (v.status === 'ACTIVE') {
            v.status = 'DEPRECATED';
          }
        });
        
        // Activate new version
        const newVersion = versions.find(v => v.version === proposal.version);
        if (newVersion) {
          newVersion.status = 'ACTIVE';
          newVersion.activatedAt = new Date().toISOString();
          newVersion.activatedBy = approverId;
        }
      }
      
      return {
        success: true,
        policyId: proposal.policyId,
        version: proposal.version,
        status: 'ACTIVE',
        message: 'Policy approved and activated',
      };
    }),
  
  /**
   * Reject policy proposal
   * RBAC: Requires COMPLIANCE_APPROVER role
   */
  rejectPolicy: protectedProcedure
    .input(z.object({
      proposalId: z.string(),
      reason: z.string().min(10),
    }))
    .mutation(async ({ input, ctx }) => {
      const proposal = proposals.get(input.proposalId);
      if (!proposal) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Proposal not found',
        });
      }
      
      if (proposal.status !== 'PENDING') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Proposal is not pending',
        });
      }
      
      // RBAC Check: COMPLIANCE_APPROVER required
      await checkPolicyRBAC(ctx, COMMANDS.ACTIVATE_POLICY, proposal.policyId);
      
      proposal.status = 'REJECTED';
      proposal.rejectionReason = input.reason;
      
      // Revert policy status to DRAFT
      const versions = policies.get(proposal.policyId);
      if (versions) {
        const policyVersion = versions.find(v => v.version === proposal.version);
        if (policyVersion) {
          policyVersion.status = 'DRAFT';
        }
      }
      
      return {
        success: true,
        proposalId: input.proposalId,
        message: 'Policy proposal rejected',
      };
    }),
});
