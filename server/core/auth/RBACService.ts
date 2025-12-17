/**
 * TuringDynamics RBAC Service
 * 
 * Production-grade Role-Based Access Control with:
 * - Scope-aware authorization (tenant, environment, domain)
 * - Maker/checker workflow support
 * - Authority fact emission for audit trail
 * 
 * CRITICAL: Every authorization decision emits an authority fact.
 * This is how you prove impossibility, not just permission.
 */

import { getDb } from "../../db";
import { 
  roleAssignments, 
  rbacCommands, 
  commandRoleBindings,
  commandProposals,
  approvals,
  authorityFacts 
} from "../../../drizzle/schema";
import { eq, and, or, lte, gte, isNull, desc } from "drizzle-orm";
import crypto from "crypto";

const uuidv4 = () => crypto.randomUUID();

// ============================================
// Types
// ============================================

export interface AuthorizationScope {
  tenantId: string;
  environmentId: string;  // prod | staging | dev
  domain: string;         // DEPOSITS | PAYMENTS | LENDING | ML | POLICY | OPS | *
}

export interface AuthorizationContext {
  actorId: string;
  scope: AuthorizationScope;
}

export interface AuthorizationResult {
  authorized: boolean;
  reasonCode: string;
  actorRoles: string[];
  requiredRoles: string[];
  missingApprovals: string[];
}

export type ReasonCode = 
  | "AUTHORIZED"
  | "ROLE_MISSING"
  | "APPROVAL_REQUIRED"
  | "FORBIDDEN_COMMAND"
  | "SCOPE_MISMATCH"
  | "EXPIRED_ASSIGNMENT"
  | "COMMAND_NOT_FOUND";

// ============================================
// Canonical Role Taxonomy
// ============================================

export const RBAC_ROLES = {
  // Platform
  PLATFORM_ENGINEER: "PLATFORM_ENGINEER",
  PLATFORM_ADMIN: "PLATFORM_ADMIN",
  PLATFORM_AUDITOR: "PLATFORM_AUDITOR",
  
  // Governance
  RISK_APPROVER: "RISK_APPROVER",
  COMPLIANCE_APPROVER: "COMPLIANCE_APPROVER",
  MODEL_RISK_OFFICER: "MODEL_RISK_OFFICER",
  
  // ML
  MODEL_AUTHOR: "MODEL_AUTHOR",
  MODEL_OPERATOR: "MODEL_OPERATOR",
  MODEL_APPROVER: "MODEL_APPROVER",
  
  // Operations
  OPS_AGENT: "OPS_AGENT",
  OPS_SUPERVISOR: "OPS_SUPERVISOR",
  
  // Customer
  CUSTOMER_ADMIN: "CUSTOMER_ADMIN",
  CUSTOMER_READONLY: "CUSTOMER_READONLY",
} as const;

export type RbacRoleCode = typeof RBAC_ROLES[keyof typeof RBAC_ROLES];

// ============================================
// Command Codes
// ============================================

export const COMMANDS = {
  // Deposits
  OPEN_ACCOUNT: "OPEN_ACCOUNT",
  CLOSE_ACCOUNT: "CLOSE_ACCOUNT",
  POST_INTEREST: "POST_INTEREST",
  APPLY_FEE: "APPLY_FEE",
  WAIVE_FEE: "WAIVE_FEE",
  PLACE_HOLD: "PLACE_HOLD",
  RELEASE_HOLD: "RELEASE_HOLD",
  ADJUST_BALANCE: "ADJUST_BALANCE", // FORBIDDEN
  
  // Payments
  INITIATE_PAYMENT: "INITIATE_PAYMENT",
  CANCEL_PAYMENT: "CANCEL_PAYMENT",
  REVERSE_PAYMENT: "REVERSE_PAYMENT",
  FORCE_POST_PAYMENT: "FORCE_POST_PAYMENT", // FORBIDDEN
  SETTLE_PAYMENT: "SETTLE_PAYMENT",
  APPLY_CHARGEBACK: "APPLY_CHARGEBACK",
  
  // Lending
  CREATE_LOAN: "CREATE_LOAN",
  APPROVE_LOAN: "APPROVE_LOAN", // FORBIDDEN - must go via Resolve
  DISBURSE_LOAN: "DISBURSE_LOAN",
  MODIFY_TERMS: "MODIFY_TERMS",
  APPLY_HARDSHIP: "APPLY_HARDSHIP",
  WRITE_OFF_LOAN: "WRITE_OFF_LOAN",
  
  // Policy
  REGISTER_POLICY: "REGISTER_POLICY",
  UPDATE_POLICY_DSL: "UPDATE_POLICY_DSL",
  ACTIVATE_POLICY: "ACTIVATE_POLICY",
  DEACTIVATE_POLICY: "DEACTIVATE_POLICY",
  ISSUE_AUTH_TOKEN: "ISSUE_AUTH_TOKEN",
  
  // ML
  REGISTER_MODEL_VERSION: "REGISTER_MODEL_VERSION",
  PROMOTE_MODEL_TO_SHADOW: "PROMOTE_MODEL_TO_SHADOW",
  PROMOTE_MODEL_TO_CANARY: "PROMOTE_MODEL_TO_CANARY",
  PROMOTE_MODEL_TO_PROD: "PROMOTE_MODEL_TO_PROD",
  ROLLBACK_MODEL: "ROLLBACK_MODEL",
  DISABLE_MODEL: "DISABLE_MODEL",
  DELETE_MODEL: "DELETE_MODEL", // FORBIDDEN - use RETIRE
} as const;

export type CommandCode = typeof COMMANDS[keyof typeof COMMANDS];

// ============================================
// RBAC Service Class
// ============================================

export class RBACService {
  /**
   * Main authorization check
   * 
   * CRITICAL: This function ALWAYS emits an authority fact,
   * regardless of the outcome.
   */
  async authorize(
    ctx: AuthorizationContext,
    commandCode: string,
    resourceId?: string
  ): Promise<AuthorizationResult> {
    const result = await this.checkAuthorization(ctx, commandCode, resourceId);
    
    // Always emit authority fact
    await this.emitAuthorityFact({
      actorId: ctx.actorId,
      actorRole: result.actorRoles[0] || "UNKNOWN",
      commandCode,
      resourceId,
      scope: ctx.scope,
      decision: result.authorized ? "ALLOW" : "DENY",
      reasonCode: result.reasonCode,
    });
    
    return result;
  }

  /**
   * Check authorization without emitting fact (internal use)
   */
  private async checkAuthorization(
    ctx: AuthorizationContext,
    commandCode: string,
    resourceId?: string
  ): Promise<AuthorizationResult> {
    const conn = await getDb();
    if (!conn) {
      return {
        authorized: false,
        reasonCode: "COMMAND_NOT_FOUND",
        actorRoles: [],
        requiredRoles: [],
        missingApprovals: [],
      };
    }
    
    const now = new Date();
    
    // 1. Check if command exists and is not forbidden
    const commandResults = await conn.select().from(rbacCommands)
      .where(eq(rbacCommands.commandCode, commandCode))
      .limit(1);
    
    const command = commandResults[0];
    
    if (!command) {
      return {
        authorized: false,
        reasonCode: "COMMAND_NOT_FOUND",
        actorRoles: [],
        requiredRoles: [],
        missingApprovals: [],
      };
    }
    
    if (command.isForbidden === "true") {
      return {
        authorized: false,
        reasonCode: "FORBIDDEN_COMMAND",
        actorRoles: [],
        requiredRoles: [],
        missingApprovals: [],
      };
    }
    
    // 2. Get actor's active roles for this scope
    const assignments = await conn.select().from(roleAssignments)
      .where(and(
        eq(roleAssignments.actorId, ctx.actorId),
        eq(roleAssignments.tenantId, ctx.scope.tenantId),
        or(
          eq(roleAssignments.environmentId, ctx.scope.environmentId),
          eq(roleAssignments.environmentId, "*")
        ),
        or(
          eq(roleAssignments.domain, ctx.scope.domain),
          eq(roleAssignments.domain, "*")
        ),
        lte(roleAssignments.validFrom, now),
        or(
          isNull(roleAssignments.validTo),
          gte(roleAssignments.validTo, now)
        ),
        isNull(roleAssignments.revokedAt)
      ));
    
    const actorRoles = assignments.map((a: any) => a.roleCode);
    
    // 3. Get required roles for this command (executors, not approvers)
    const bindings = await conn.select().from(commandRoleBindings)
      .where(and(
        eq(commandRoleBindings.commandCode, commandCode),
        eq(commandRoleBindings.isApprover, "false")
      ));
    
    const requiredRoles = bindings.map((b: any) => b.roleCode);
    
    // 4. Check if actor has at least one required role
    const hasRole = actorRoles.some((r: string) => requiredRoles.includes(r));
    
    if (!hasRole) {
      return {
        authorized: false,
        reasonCode: "ROLE_MISSING",
        actorRoles,
        requiredRoles,
        missingApprovals: [],
      };
    }
    
    // 5. Check approvals if required
    if (command.requiresApproval === "true" && resourceId) {
      const missingApprovals = await this.checkMissingApprovals(
        ctx,
        commandCode,
        resourceId
      );
      
      if (missingApprovals.length > 0) {
        return {
          authorized: false,
          reasonCode: "APPROVAL_REQUIRED",
          actorRoles,
          requiredRoles,
          missingApprovals,
        };
      }
    }
    
    return {
      authorized: true,
      reasonCode: "AUTHORIZED",
      actorRoles,
      requiredRoles,
      missingApprovals: [],
    };
  }

  /**
   * Check which approvals are missing for a command
   */
  private async checkMissingApprovals(
    ctx: AuthorizationContext,
    commandCode: string,
    resourceId: string
  ): Promise<string[]> {
    const conn = await getDb();
    if (!conn) return [];
    
    // Get required approver roles
    const approverBindings = await conn.select().from(commandRoleBindings)
      .where(and(
        eq(commandRoleBindings.commandCode, commandCode),
        eq(commandRoleBindings.isApprover, "true")
      ));
    
    const requiredApproverRoles = approverBindings.map((b: any) => b.roleCode);
    
    if (requiredApproverRoles.length === 0) {
      return [];
    }
    
    // Get pending proposal
    const proposalResults = await conn.select().from(commandProposals)
      .where(and(
        eq(commandProposals.commandCode, commandCode),
        eq(commandProposals.resourceId, resourceId),
        eq(commandProposals.status, "PENDING")
      ))
      .limit(1);
    
    const proposal = proposalResults[0];
    
    if (!proposal) {
      return requiredApproverRoles;
    }
    
    // Get existing approvals
    const existingApprovals = await conn.select().from(approvals)
      .where(and(
        eq(approvals.proposalId, proposal.proposalId),
        eq(approvals.decision, "APPROVE")
      ));
    
    // Filter out approvals from the proposer (proposer cannot approve)
    const validApprovals = existingApprovals.filter(
      (a: any) => a.approvedBy !== proposal.proposedBy
    );
    
    const approvedRoles = validApprovals.map((a: any) => a.approvedRole);
    
    return requiredApproverRoles.filter((r: string) => !approvedRoles.includes(r));
  }

  /**
   * Create a command proposal (maker step)
   */
  async createProposal(
    ctx: AuthorizationContext,
    commandCode: string,
    resourceId: string,
    proposalData?: Record<string, unknown>
  ): Promise<{ proposalId: string }> {
    const conn = await getDb();
    if (!conn) throw new Error("Database not available");
    
    // First authorize the actor can propose this command
    const authResult = await this.checkAuthorization(ctx, commandCode, resourceId);
    
    if (!authResult.authorized && authResult.reasonCode !== "APPROVAL_REQUIRED") {
      throw new Error(`Not authorized to propose: ${authResult.reasonCode}`);
    }
    
    const proposalId = `prop-${uuidv4()}`;
    
    await conn.insert(commandProposals).values({
      proposalId,
      commandCode,
      resourceId,
      proposedBy: ctx.actorId,
      proposedRole: authResult.actorRoles[0] || "UNKNOWN",
      tenantId: ctx.scope.tenantId,
      environmentId: ctx.scope.environmentId,
      domain: ctx.scope.domain,
      proposalData: proposalData || {},
      status: "PENDING",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });
    
    return { proposalId };
  }

  /**
   * Approve a command proposal (checker step)
   */
  async approveProposal(
    ctx: AuthorizationContext,
    proposalId: string,
    decision: "APPROVE" | "REJECT",
    reason?: string
  ): Promise<{ approvalId: string }> {
    const conn = await getDb();
    if (!conn) throw new Error("Database not available");
    
    const proposalResults = await conn.select().from(commandProposals)
      .where(eq(commandProposals.proposalId, proposalId))
      .limit(1);
    
    const proposal = proposalResults[0];
    
    if (!proposal) {
      throw new Error("Proposal not found");
    }
    
    if (proposal.status !== "PENDING") {
      throw new Error(`Proposal is ${proposal.status}, cannot approve`);
    }
    
    // Proposer cannot approve their own proposal
    if (proposal.proposedBy === ctx.actorId) {
      throw new Error("Proposer cannot approve their own proposal");
    }
    
    // Check if actor has approver role for this command
    const approverBindings = await conn.select().from(commandRoleBindings)
      .where(and(
        eq(commandRoleBindings.commandCode, proposal.commandCode),
        eq(commandRoleBindings.isApprover, "true")
      ));
    
    const approverRoles = approverBindings.map((b: any) => b.roleCode);
    
    // Get actor's roles
    const assignmentResults = await conn.select().from(roleAssignments)
      .where(and(
        eq(roleAssignments.actorId, ctx.actorId),
        eq(roleAssignments.tenantId, ctx.scope.tenantId),
        isNull(roleAssignments.revokedAt)
      ));
    
    const actorRoles = assignmentResults.map((a: any) => a.roleCode);
    const matchingApproverRole = actorRoles.find((r: string) => approverRoles.includes(r));
    
    if (!matchingApproverRole) {
      throw new Error("Actor does not have approver role for this command");
    }
    
    const approvalId = `appr-${uuidv4()}`;
    
    await conn.insert(approvals).values({
      approvalId,
      proposalId,
      approvedBy: ctx.actorId,
      approvedRole: matchingApproverRole,
      tenantId: ctx.scope.tenantId,
      environmentId: ctx.scope.environmentId,
      domain: ctx.scope.domain,
      decision,
      reason,
    });
    
    // Emit authority fact for the approval
    await this.emitAuthorityFact({
      actorId: ctx.actorId,
      actorRole: matchingApproverRole,
      commandCode: `APPROVE_${proposal.commandCode}`,
      resourceId: proposal.resourceId,
      scope: ctx.scope,
      decision: "ALLOW",
      reasonCode: "AUTHORIZED",
      proposalId,
    });
    
    // Update proposal status if rejected
    if (decision === "REJECT") {
      await conn.update(commandProposals)
        .set({ status: "REJECTED", resolvedAt: new Date() })
        .where(eq(commandProposals.proposalId, proposalId));
    }
    
    return { approvalId };
  }

  /**
   * Emit an authority fact (append-only audit log)
   */
  async emitAuthorityFact(params: {
    actorId: string;
    actorRole: string;
    commandCode: string;
    resourceId?: string;
    scope: AuthorizationScope;
    decision: "ALLOW" | "DENY";
    reasonCode: string;
    proposalId?: string;
    evidencePackId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const conn = await getDb();
    if (!conn) return `auth-${uuidv4()}`; // Return ID even if DB unavailable
    
    const authorityFactId = `auth-${uuidv4()}`;
    
    await conn.insert(authorityFacts).values({
      authorityFactId,
      actorId: params.actorId,
      actorRole: params.actorRole,
      commandCode: params.commandCode,
      resourceId: params.resourceId,
      tenantId: params.scope.tenantId,
      environmentId: params.scope.environmentId,
      domain: params.scope.domain,
      decision: params.decision,
      reasonCode: params.reasonCode,
      proposalId: params.proposalId,
      evidencePackId: params.evidencePackId,
      metadata: params.metadata || {},
    });
    
    return authorityFactId;
  }

  /**
   * Get actor's roles for a scope
   */
  async getActorRoles(
    actorId: string,
    scope: AuthorizationScope
  ): Promise<string[]> {
    const conn = await getDb();
    if (!conn) return [];
    
    const now = new Date();
    
    const assignments = await conn.select().from(roleAssignments)
      .where(and(
        eq(roleAssignments.actorId, actorId),
        eq(roleAssignments.tenantId, scope.tenantId),
        or(
          eq(roleAssignments.environmentId, scope.environmentId),
          eq(roleAssignments.environmentId, "*")
        ),
        or(
          eq(roleAssignments.domain, scope.domain),
          eq(roleAssignments.domain, "*")
        ),
        lte(roleAssignments.validFrom, now),
        or(
          isNull(roleAssignments.validTo),
          gte(roleAssignments.validTo, now)
        ),
        isNull(roleAssignments.revokedAt)
      ));
    
    return assignments.map((a: any) => a.roleCode);
  }

  /**
   * Assign a role to an actor
   */
  async assignRole(
    actorId: string,
    roleCode: string,
    scope: AuthorizationScope,
    assignedBy: string,
    validTo?: Date
  ): Promise<string> {
    const conn = await getDb();
    if (!conn) throw new Error("Database not available");
    
    const roleAssignmentId = `ra-${uuidv4()}`;
    
    await conn.insert(roleAssignments).values({
      roleAssignmentId,
      actorId,
      roleCode,
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      domain: scope.domain,
      validTo,
      createdBy: assignedBy,
    });
    
    return roleAssignmentId;
  }

  /**
   * Revoke a role assignment
   */
  async revokeRole(
    roleAssignmentId: string,
    revokedBy: string,
    reason: string
  ): Promise<void> {
    const conn = await getDb();
    if (!conn) throw new Error("Database not available");
    
    await conn.update(roleAssignments)
      .set({
        revokedAt: new Date(),
        revokedBy,
        revokeReason: reason,
      })
      .where(eq(roleAssignments.roleAssignmentId, roleAssignmentId));
  }

  /**
   * Get pending proposals for approval
   */
  async getPendingProposals(scope: AuthorizationScope) {
    const conn = await getDb();
    if (!conn) return [];
    
    return conn.select().from(commandProposals)
      .where(and(
        eq(commandProposals.tenantId, scope.tenantId),
        eq(commandProposals.environmentId, scope.environmentId),
        eq(commandProposals.status, "PENDING")
      ))
      .orderBy(desc(commandProposals.createdAt));
  }

  /**
   * Get authority facts for audit
   */
  async getAuthorityFacts(
    scope: AuthorizationScope,
    filters?: {
      actorId?: string;
      commandCode?: string;
      decision?: "ALLOW" | "DENY";
      from?: Date;
      to?: Date;
    }
  ) {
    const conn = await getDb();
    if (!conn) return [];
    
    const conditions = [
      eq(authorityFacts.tenantId, scope.tenantId),
      eq(authorityFacts.environmentId, scope.environmentId),
    ];
    
    if (filters?.actorId) {
      conditions.push(eq(authorityFacts.actorId, filters.actorId));
    }
    if (filters?.commandCode) {
      conditions.push(eq(authorityFacts.commandCode, filters.commandCode));
    }
    if (filters?.decision) {
      conditions.push(eq(authorityFacts.decision, filters.decision));
    }
    
    return conn.select().from(authorityFacts)
      .where(and(...conditions))
      .orderBy(desc(authorityFacts.createdAt))
      .limit(1000);
  }
}

// Export singleton instance
export const rbacService = new RBACService();

// ============================================
// RBAC Guard Decorator
// ============================================

/**
 * RBAC Guard - Wraps command handlers with authorization
 * 
 * Usage:
 * ```
 * const handler = rbacGuard("PROMOTE_MODEL_TO_PROD", "ML")(
 *   async (ctx, modelId) => { ... }
 * );
 * ```
 */
export function rbacGuard<T extends (...args: any[]) => Promise<any>>(
  commandCode: string,
  domain: string
) {
  return (handler: T) => {
    return async (ctx: AuthorizationContext, ...args: Parameters<T>): Promise<ReturnType<T>> => {
      const resourceId = args[0] as string | undefined;
      
      const result = await rbacService.authorize(
        { ...ctx, scope: { ...ctx.scope, domain } },
        commandCode,
        resourceId
      );
      
      if (!result.authorized) {
        throw new Error(`RBAC_DENIED: ${result.reasonCode}`);
      }
      
      return handler(ctx, ...args);
    };
  };
}
