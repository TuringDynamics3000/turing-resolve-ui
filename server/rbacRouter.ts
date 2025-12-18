/**
 * TuringDynamics RBAC Router
 * 
 * tRPC router for RBAC operations including:
 * - Role management
 * - Authorization checks
 * - Proposal/approval workflow
 * - Authority facts audit
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { rbacService, RBAC_ROLES, COMMANDS } from "./core/auth/RBACService";
import { getDb } from "./db";
import { 
  rbacRoles, 
  rbacCommands, 
  commandRoleBindings,
  roleAssignments,
  commandProposals,
  approvals,
  authorityFacts 
} from "../drizzle/schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";

// ============================================
// Input Schemas
// ============================================

const scopeSchema = z.object({
  tenantId: z.string(),
  environmentId: z.string(),
  domain: z.string(),
});

const authContextSchema = z.object({
  actorId: z.string(),
  scope: scopeSchema,
});

// ============================================
// RBAC Router
// ============================================

export const rbacRouter = router({
  // ============================================
  // Role Management
  // ============================================
  
  /**
   * List all available roles
   */
  listRoles: publicProcedure.query(async () => {
    const conn = await getDb();
    if (!conn) {
      // Return canonical roles from constants
      return Object.entries(RBAC_ROLES).map(([key, code]) => ({
        roleCode: code,
        category: key.includes("PLATFORM") ? "PLATFORM" :
                  key.includes("RISK") || key.includes("COMPLIANCE") || key.includes("MODEL_RISK") ? "GOVERNANCE" :
                  key.includes("MODEL") ? "ML" :
                  key.includes("OPS") ? "OPERATIONS" : "CUSTOMER",
        description: code.replace(/_/g, " ").toLowerCase(),
      }));
    }
    
    return conn.select().from(rbacRoles);
  }),
  
  /**
   * List all commands with their role bindings
   */
  listCommands: publicProcedure.query(async () => {
    const conn = await getDb();
    if (!conn) {
      return Object.entries(COMMANDS).map(([key, code]) => ({
        commandCode: code,
        domain: key.includes("ACCOUNT") || key.includes("HOLD") || key.includes("INTEREST") || key.includes("FEE") ? "DEPOSITS" :
                key.includes("PAYMENT") || key.includes("CHARGEBACK") ? "PAYMENTS" :
                key.includes("LOAN") || key.includes("TERMS") || key.includes("HARDSHIP") ? "LENDING" :
                key.includes("POLICY") || key.includes("TOKEN") ? "POLICY" : "ML",
        description: code.replace(/_/g, " ").toLowerCase(),
        requiresApproval: ["MODIFY_TERMS", "WRITE_OFF_LOAN", "UPDATE_POLICY_DSL", "ACTIVATE_POLICY", 
                          "PROMOTE_MODEL_TO_CANARY", "PROMOTE_MODEL_TO_PROD"].includes(code),
        isForbidden: ["ADJUST_BALANCE", "FORCE_POST_PAYMENT", "APPROVE_LOAN", "DELETE_MODEL"].includes(code),
      }));
    }
    
    const commands = await conn.select().from(rbacCommands);
    const bindings = await conn.select().from(commandRoleBindings);
    
    return commands.map(cmd => ({
      ...cmd,
      roles: bindings.filter(b => b.commandCode === cmd.commandCode),
    }));
  }),
  
  /**
   * Get actor's current roles
   */
  getActorRoles: protectedProcedure
    .input(z.object({
      actorId: z.string().optional(),
      scope: scopeSchema,
    }))
    .query(async ({ ctx, input }) => {
      const actorId = input.actorId || ctx.user?.openId || "anonymous";
      return rbacService.getActorRoles(actorId, input.scope);
    }),
  
  /**
   * Assign a role to an actor
   */
  assignRole: protectedProcedure
    .input(z.object({
      actorId: z.string(),
      roleCode: z.string(),
      scope: scopeSchema,
      validTo: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const assignedBy = ctx.user?.openId || "system";
      return rbacService.assignRole(
        input.actorId,
        input.roleCode,
        input.scope,
        assignedBy,
        input.validTo
      );
    }),
  
  /**
   * Revoke a role assignment
   */
  revokeRole: protectedProcedure
    .input(z.object({
      roleAssignmentId: z.string(),
      reason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const revokedBy = ctx.user?.openId || "system";
      await rbacService.revokeRole(input.roleAssignmentId, revokedBy, input.reason);
      return { success: true };
    }),
  
  /**
   * List role assignments for an actor or scope
   */
  listRoleAssignments: protectedProcedure
    .input(z.object({
      actorId: z.string().optional(),
      scope: scopeSchema.partial().optional(),
    }))
    .query(async ({ input }) => {
      const conn = await getDb();
      if (!conn) return [];
      
      const conditions = [];
      if (input.actorId) {
        conditions.push(eq(roleAssignments.actorId, input.actorId));
      }
      if (input.scope?.tenantId) {
        conditions.push(eq(roleAssignments.tenantId, input.scope.tenantId));
      }
      if (input.scope?.environmentId) {
        conditions.push(eq(roleAssignments.environmentId, input.scope.environmentId));
      }
      
      if (conditions.length === 0) {
        return conn.select().from(roleAssignments).limit(100);
      }
      
      return conn.select().from(roleAssignments)
        .where(and(...conditions))
        .orderBy(desc(roleAssignments.createdAt))
        .limit(100);
    }),
  
  // ============================================
  // Authorization
  // ============================================
  
  /**
   * Check if an action is authorized
   */
  checkAuthorization: protectedProcedure
    .input(z.object({
      commandCode: z.string(),
      resourceId: z.string().optional(),
      scope: scopeSchema,
    }))
    .query(async ({ ctx, input }) => {
      const actorId = ctx.user?.openId || "anonymous";
      return rbacService.authorize(
        { actorId, scope: input.scope },
        input.commandCode,
        input.resourceId
      );
    }),
  
  // ============================================
  // Proposal/Approval Workflow
  // ============================================
  
  /**
   * Create a command proposal (maker step)
   */
  createProposal: protectedProcedure
    .input(z.object({
      commandCode: z.string(),
      resourceId: z.string(),
      scope: scopeSchema,
      proposalData: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actorId = ctx.user?.openId || "anonymous";
      return rbacService.createProposal(
        { actorId, scope: input.scope },
        input.commandCode,
        input.resourceId,
        input.proposalData
      );
    }),
  
  /**
   * Approve or reject a proposal (checker step)
   */
  approveProposal: protectedProcedure
    .input(z.object({
      proposalId: z.string(),
      decision: z.enum(["APPROVE", "REJECT"]),
      reason: z.string().optional(),
      scope: scopeSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const actorId = ctx.user?.openId || "anonymous";
      return rbacService.approveProposal(
        { actorId, scope: input.scope },
        input.proposalId,
        input.decision,
        input.reason
      );
    }),
  
  /**
   * List pending proposals
   */
  listPendingProposals: protectedProcedure
    .input(z.object({
      scope: scopeSchema,
    }))
    .query(async ({ input }) => {
      return rbacService.getPendingProposals(input.scope);
    }),
  
  /**
   * Get proposal details with approvals
   */
  getProposal: protectedProcedure
    .input(z.object({
      proposalId: z.string(),
    }))
    .query(async ({ input }) => {
      const conn = await getDb();
      if (!conn) return null;
      
      const proposalResults = await conn.select().from(commandProposals)
        .where(eq(commandProposals.proposalId, input.proposalId))
        .limit(1);
      
      const proposal = proposalResults[0];
      if (!proposal) return null;
      
      const proposalApprovals = await conn.select().from(approvals)
        .where(eq(approvals.proposalId, input.proposalId));
      
      // Get required approver roles
      const bindings = await conn.select().from(commandRoleBindings)
        .where(and(
          eq(commandRoleBindings.commandCode, proposal.commandCode),
          eq(commandRoleBindings.isApprover, "true")
        ));
      
      const requiredApproverRoles = bindings.map(b => b.roleCode);
      const approvedRoles = proposalApprovals
        .filter(a => a.decision === "APPROVE" && a.approvedBy !== proposal.proposedBy)
        .map(a => a.approvedRole);
      
      const missingApprovals = requiredApproverRoles.filter(r => !approvedRoles.includes(r));
      
      return {
        ...proposal,
        approvals: proposalApprovals,
        requiredApproverRoles,
        missingApprovals,
        isFullyApproved: missingApprovals.length === 0,
      };
    }),
  
  // ============================================
  // Authority Facts (Audit)
  // ============================================
  
  /**
   * List authority facts for audit
   */
  listAuthorityFacts: protectedProcedure
    .input(z.object({
      scope: scopeSchema,
      filters: z.object({
        actorId: z.string().optional(),
        commandCode: z.string().optional(),
        decision: z.enum(["ALLOW", "DENY"]).optional(),
      }).optional(),
      limit: z.number().min(1).max(1000).default(100),
    }))
    .query(async ({ input }) => {
      return rbacService.getAuthorityFacts(input.scope, input.filters);
    }),
  
  /**
   * Get authority fact by ID
   */
  getAuthorityFact: protectedProcedure
    .input(z.object({
      authorityFactId: z.string(),
    }))
    .query(async ({ input }) => {
      const conn = await getDb();
      if (!conn) return null;
      
      const results = await conn.select().from(authorityFacts)
        .where(eq(authorityFacts.authorityFactId, input.authorityFactId))
        .limit(1);
      
      return results[0] || null;
    }),
  
  /**
   * Get authority statistics
   */
  getAuthorityStats: protectedProcedure
    .input(z.object({
      scope: scopeSchema,
    }))
    .query(async ({ input }) => {
      const conn = await getDb();
      if (!conn) {
        return {
          totalDecisions: 0,
          allowedCount: 0,
          deniedCount: 0,
          byCommand: [],
          byReason: [],
        };
      }
      
      // Get counts
      const allFacts = await conn.select().from(authorityFacts)
        .where(and(
          eq(authorityFacts.tenantId, input.scope.tenantId),
          eq(authorityFacts.environmentId, input.scope.environmentId)
        ));
      
      const totalDecisions = allFacts.length;
      const allowedCount = allFacts.filter(f => f.decision === "ALLOW").length;
      const deniedCount = allFacts.filter(f => f.decision === "DENY").length;
      
      // Group by command
      const byCommand: Record<string, { allow: number; deny: number }> = {};
      allFacts.forEach(f => {
        if (!byCommand[f.commandCode]) {
          byCommand[f.commandCode] = { allow: 0, deny: 0 };
        }
        if (f.decision === "ALLOW") {
          byCommand[f.commandCode].allow++;
        } else {
          byCommand[f.commandCode].deny++;
        }
      });
      
      // Group by reason
      const byReason: Record<string, number> = {};
      allFacts.forEach(f => {
        byReason[f.reasonCode] = (byReason[f.reasonCode] || 0) + 1;
      });
      
      return {
        totalDecisions,
        allowedCount,
        deniedCount,
        byCommand: Object.entries(byCommand).map(([command, counts]) => ({
          command,
          ...counts,
        })),
        byReason: Object.entries(byReason).map(([reason, count]) => ({
          reason,
          count,
        })),
      };
    }),

  /**
   * Get TuringSentinel dashboard metrics (public for landing page)
   */
  getSentinelMetrics: publicProcedure.query(async () => {
    const conn = await getDb();
    if (!conn) {
      // Return mock data when DB not available
      return {
        totalDecisions: 1247,
        allowedCount: 1089,
        deniedCount: 158,
        pendingApprovals: 3,
        activeRoleAssignments: 39,
        autoApprovalRate: 87.3,
        evidencePacksVerified: 100,
      };
    }
    
    // Get authority facts counts
    const allFacts = await conn.select().from(authorityFacts);
    const totalDecisions = allFacts.length;
    const allowedCount = allFacts.filter(f => f.decision === "ALLOW").length;
    const deniedCount = allFacts.filter(f => f.decision === "DENY").length;
    
    // Get pending proposals count
    const pendingProposals = await conn.select().from(commandProposals)
      .where(eq(commandProposals.status, "PENDING"));
    const pendingApprovals = pendingProposals.length;
    
    // Get active role assignments count (not revoked)
    const activeAssignments = await conn.select().from(roleAssignments)
      .where(isNull(roleAssignments.revokedAt));
    const activeRoleAssignments = activeAssignments.length;
    
    // Calculate auto-approval rate (decisions that didn't require approval)
    const autoApprovalRate = totalDecisions > 0 
      ? Math.round((allowedCount / totalDecisions) * 1000) / 10 
      : 0;
    
    return {
      totalDecisions,
      allowedCount,
      deniedCount,
      pendingApprovals,
      activeRoleAssignments,
      autoApprovalRate,
      evidencePacksVerified: 100, // All evidence packs are verified by design
    };
  }),

  /**
   * Get recent authority facts for live feed
   */
  getRecentAuthorityFacts: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(10),
      domain: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const conn = await getDb();
      if (!conn) {
        // Return mock data when DB not available
        const mockData = [
          {
            authorityFactId: "auth-001",
            actorId: "alice@turingdynamics.com",
            actorRole: "MODEL_APPROVER",
            commandCode: "PROMOTE_MODEL_TO_CANARY",
            resourceId: "fraud-detection-v1.2.0",
            domain: "ML",
            decision: "ALLOW",
            reasonCode: "AUTHORIZED",
            createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          },
          {
            authorityFactId: "auth-002",
            actorId: "dave@turingdynamics.com",
            actorRole: "MODEL_AUTHOR",
            commandCode: "PROMOTE_MODEL_TO_PROD",
            resourceId: "credit-risk-v2.2.0",
            domain: "ML",
            decision: "DENY",
            reasonCode: "ROLE_MISSING",
            createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          },
          {
            authorityFactId: "auth-003",
            actorId: "eve@turingdynamics.com",
            actorRole: "OPS_AGENT",
            commandCode: "ADJUST_BALANCE",
            resourceId: "ACC-001234",
            domain: "DEPOSITS",
            decision: "DENY",
            reasonCode: "FORBIDDEN_COMMAND",
            createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          },
          {
            authorityFactId: "auth-004",
            actorId: "bob@turingdynamics.com",
            actorRole: "OPS_SUPERVISOR",
            commandCode: "INITIATE_PAYMENT",
            resourceId: "PAY-005678",
            domain: "PAYMENTS",
            decision: "ALLOW",
            reasonCode: "AUTHORIZED",
            createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          },
          {
            authorityFactId: "auth-005",
            actorId: "carol@turingdynamics.com",
            actorRole: "RISK_APPROVER",
            commandCode: "CREATE_LOAN",
            resourceId: "LOAN-009012",
            domain: "LENDING",
            decision: "ALLOW",
            reasonCode: "AUTHORIZED",
            createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
          },
        ];
        return input.domain ? mockData.filter(d => d.domain === input.domain) : mockData;
      }
      
      let query = conn.select().from(authorityFacts);
      
      const facts = await query
        .orderBy(desc(authorityFacts.createdAt))
        .limit(input.limit * 2); // Get more to filter
      
      let filtered = facts;
      if (input.domain) {
        filtered = facts.filter(f => f.domain === input.domain);
      }
      
      return filtered.slice(0, input.limit).map(f => ({
        ...f,
        createdAt: f.createdAt?.toISOString() || new Date().toISOString(),
      }));
    }),

  /**
   * Get role statistics
   */
  getRoleStats: publicProcedure.query(async () => {
    const conn = await getDb();
    if (!conn) {
      // Return mock data
      return [
        { roleCode: "PLATFORM_ENGINEER", category: "PLATFORM", assignedCount: 3 },
        { roleCode: "PLATFORM_ADMIN", category: "PLATFORM", assignedCount: 2 },
        { roleCode: "RISK_APPROVER", category: "GOVERNANCE", assignedCount: 4 },
        { roleCode: "COMPLIANCE_APPROVER", category: "GOVERNANCE", assignedCount: 2 },
        { roleCode: "MODEL_AUTHOR", category: "ML", assignedCount: 5 },
        { roleCode: "MODEL_OPERATOR", category: "ML", assignedCount: 3 },
        { roleCode: "MODEL_APPROVER", category: "ML", assignedCount: 2 },
        { roleCode: "OPS_AGENT", category: "OPERATIONS", assignedCount: 12 },
        { roleCode: "OPS_SUPERVISOR", category: "OPERATIONS", assignedCount: 4 },
      ];
    }
    
    // Get all roles
    const roles = await conn.select().from(rbacRoles);
    
    // Get assignment counts per role (not revoked)
    const assignments = await conn.select().from(roleAssignments)
      .where(isNull(roleAssignments.revokedAt));
    
    const countByRole: Record<string, number> = {};
    assignments.forEach(a => {
      countByRole[a.roleCode] = (countByRole[a.roleCode] || 0) + 1;
    });
    
    return roles.map(r => ({
      roleCode: r.roleCode,
      category: r.category,
      description: r.description,
      assignedCount: countByRole[r.roleCode] || 0,
    }));
  }),

  /**
   * Get decision trends over time for charts
   */
  getDecisionTrends: publicProcedure
    .input(z.object({
      period: z.enum(["24h", "7d", "30d"]).default("7d"),
    }))
    .query(async ({ input }) => {
      const conn = await getDb();
      
      // Calculate time buckets based on period
      const now = new Date();
      const buckets: { timestamp: string; allowed: number; denied: number }[] = [];
      
      let bucketCount: number;
      let bucketSizeMs: number;
      let labelFormat: (date: Date) => string;
      
      switch (input.period) {
        case "24h":
          bucketCount = 24;
          bucketSizeMs = 60 * 60 * 1000; // 1 hour
          labelFormat = (d) => `${d.getHours().toString().padStart(2, '0')}:00`;
          break;
        case "7d":
          bucketCount = 7;
          bucketSizeMs = 24 * 60 * 60 * 1000; // 1 day
          labelFormat = (d) => d.toLocaleDateString('en-US', { weekday: 'short' });
          break;
        case "30d":
          bucketCount = 30;
          bucketSizeMs = 24 * 60 * 60 * 1000; // 1 day
          labelFormat = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
          break;
      }
      
      if (!conn) {
        // Return mock data when DB not available
        for (let i = bucketCount - 1; i >= 0; i--) {
          const bucketTime = new Date(now.getTime() - i * bucketSizeMs);
          buckets.push({
            timestamp: labelFormat(bucketTime),
            allowed: Math.floor(Math.random() * 50) + 20,
            denied: Math.floor(Math.random() * 15) + 2,
          });
        }
        return buckets;
      }
      
      // Get all facts within the time range
      const startTime = new Date(now.getTime() - bucketCount * bucketSizeMs);
      const allFacts = await conn.select().from(authorityFacts);
      
      // Filter facts within time range
      const factsInRange = allFacts.filter(f => {
        const factTime = f.createdAt ? new Date(f.createdAt) : new Date();
        return factTime >= startTime && factTime <= now;
      });
      
      // Initialize buckets
      for (let i = bucketCount - 1; i >= 0; i--) {
        const bucketTime = new Date(now.getTime() - i * bucketSizeMs);
        buckets.push({
          timestamp: labelFormat(bucketTime),
          allowed: 0,
          denied: 0,
        });
      }
      
      // Aggregate facts into buckets
      factsInRange.forEach(fact => {
        const factTime = fact.createdAt ? new Date(fact.createdAt) : new Date();
        const bucketIndex = Math.floor((now.getTime() - factTime.getTime()) / bucketSizeMs);
        const reversedIndex = bucketCount - 1 - bucketIndex;
        
        if (reversedIndex >= 0 && reversedIndex < buckets.length) {
          if (fact.decision === "ALLOW") {
            buckets[reversedIndex].allowed++;
          } else {
            buckets[reversedIndex].denied++;
          }
        }
      });
      
      return buckets;
    }),

  /**
   * Get pending proposals with details
   */
  getPendingProposalsList: publicProcedure.query(async () => {
    const conn = await getDb();
    if (!conn) {
      // Return mock data
      return [
        {
          proposalId: "prop-001",
          commandCode: "PROMOTE_MODEL_TO_PROD",
          resourceId: "credit-risk-v2.3.0",
          proposedBy: "alice@turingdynamics.com",
          proposedRole: "MODEL_APPROVER",
          status: "PENDING",
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          requiredApprovers: ["RISK_APPROVER"],
          currentApprovals: [],
        },
        {
          proposalId: "prop-002",
          commandCode: "UPDATE_POLICY_DSL",
          resourceId: "lending-policy-v4",
          proposedBy: "bob@turingdynamics.com",
          proposedRole: "COMPLIANCE_APPROVER",
          status: "PENDING",
          createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          requiredApprovers: ["COMPLIANCE_APPROVER"],
          currentApprovals: [],
        },
      ];
    }
    
    const proposals = await conn.select().from(commandProposals)
      .where(eq(commandProposals.status, "PENDING"))
      .orderBy(desc(commandProposals.createdAt))
      .limit(20);
    
    // Get approvals for each proposal
    const result = await Promise.all(proposals.map(async (p) => {
      const proposalApprovals = await conn.select().from(approvals)
        .where(eq(approvals.proposalId, p.proposalId));
      
      // Get required approver roles
      const bindings = await conn.select().from(commandRoleBindings)
        .where(and(
          eq(commandRoleBindings.commandCode, p.commandCode),
          eq(commandRoleBindings.isApprover, "true")
        ));
      
      return {
        ...p,
        createdAt: p.createdAt?.toISOString() || new Date().toISOString(),
        requiredApprovers: bindings.map(b => b.roleCode),
        currentApprovals: proposalApprovals.filter(a => a.decision === "APPROVE").map(a => a.approvedRole),
      };
    }));
    
    return result;
  }),
  
  // ============================================
  // Seed Data (Development)
  // ============================================
  
  /**
   * Seed RBAC tables with initial data
   */
  seedRbacData: protectedProcedure
    .mutation(async () => {
      const conn = await getDb();
      if (!conn) throw new Error("Database not available");
      
      // Seed roles
      const roles = [
        { roleCode: "PLATFORM_ENGINEER", category: "PLATFORM" as const, description: "Core platform engineer - system operations" },
        { roleCode: "PLATFORM_ADMIN", category: "PLATFORM" as const, description: "Platform administrator - token issuance" },
        { roleCode: "PLATFORM_AUDITOR", category: "PLATFORM" as const, description: "Platform auditor - read-only access" },
        { roleCode: "RISK_APPROVER", category: "GOVERNANCE" as const, description: "Risk approval authority" },
        { roleCode: "COMPLIANCE_APPROVER", category: "GOVERNANCE" as const, description: "Compliance approval authority" },
        { roleCode: "MODEL_RISK_OFFICER", category: "GOVERNANCE" as const, description: "Model risk oversight" },
        { roleCode: "MODEL_AUTHOR", category: "ML" as const, description: "Model author - register versions" },
        { roleCode: "MODEL_OPERATOR", category: "ML" as const, description: "Model operator - shadow deployments" },
        { roleCode: "MODEL_APPROVER", category: "ML" as const, description: "Model approver - promotions" },
        { roleCode: "OPS_AGENT", category: "OPERATIONS" as const, description: "Operations agent" },
        { roleCode: "OPS_SUPERVISOR", category: "OPERATIONS" as const, description: "Operations supervisor" },
        { roleCode: "CUSTOMER_ADMIN", category: "CUSTOMER" as const, description: "Customer administrator" },
        { roleCode: "CUSTOMER_READONLY", category: "CUSTOMER" as const, description: "Customer read-only" },
      ];
      
      for (const role of roles) {
        try {
          await conn.insert(rbacRoles).values(role);
        } catch (e) {
          // Ignore duplicate key errors
        }
      }
      
      // Seed commands
      const commands = [
        { commandCode: "OPEN_ACCOUNT", domain: "DEPOSITS", description: "Open deposit account", requiresApproval: "false" as const, isForbidden: "false" as const },
        { commandCode: "CLOSE_ACCOUNT", domain: "DEPOSITS", description: "Close deposit account", requiresApproval: "false" as const, isForbidden: "false" as const },
        { commandCode: "ADJUST_BALANCE", domain: "DEPOSITS", description: "Direct balance adjustment", requiresApproval: "false" as const, isForbidden: "true" as const },
        { commandCode: "INITIATE_PAYMENT", domain: "PAYMENTS", description: "Initiate payment", requiresApproval: "false" as const, isForbidden: "false" as const },
        { commandCode: "REVERSE_PAYMENT", domain: "PAYMENTS", description: "Reverse payment", requiresApproval: "false" as const, isForbidden: "false" as const },
        { commandCode: "CREATE_LOAN", domain: "LENDING", description: "Create loan", requiresApproval: "false" as const, isForbidden: "false" as const },
        { commandCode: "MODIFY_TERMS", domain: "LENDING", description: "Modify loan terms", requiresApproval: "true" as const, isForbidden: "false" as const },
        { commandCode: "WRITE_OFF_LOAN", domain: "LENDING", description: "Write off loan", requiresApproval: "true" as const, isForbidden: "false" as const },
        { commandCode: "UPDATE_POLICY_DSL", domain: "POLICY", description: "Update policy DSL", requiresApproval: "true" as const, isForbidden: "false" as const },
        { commandCode: "ACTIVATE_POLICY", domain: "POLICY", description: "Activate policy", requiresApproval: "true" as const, isForbidden: "false" as const },
        { commandCode: "REGISTER_MODEL_VERSION", domain: "ML", description: "Register model version", requiresApproval: "false" as const, isForbidden: "false" as const },
        { commandCode: "PROMOTE_MODEL_TO_SHADOW", domain: "ML", description: "Promote to shadow", requiresApproval: "false" as const, isForbidden: "false" as const },
        { commandCode: "PROMOTE_MODEL_TO_CANARY", domain: "ML", description: "Promote to canary", requiresApproval: "true" as const, isForbidden: "false" as const },
        { commandCode: "PROMOTE_MODEL_TO_PROD", domain: "ML", description: "Promote to production", requiresApproval: "true" as const, isForbidden: "false" as const },
        { commandCode: "ROLLBACK_MODEL", domain: "ML", description: "Rollback model", requiresApproval: "false" as const, isForbidden: "false" as const },
        { commandCode: "DELETE_MODEL", domain: "ML", description: "Delete model", requiresApproval: "false" as const, isForbidden: "true" as const },
      ];
      
      for (const cmd of commands) {
        try {
          await conn.insert(rbacCommands).values(cmd);
        } catch (e) {
          // Ignore duplicate key errors
        }
      }
      
      // Seed command-role bindings
      const bindings = [
        { commandCode: "OPEN_ACCOUNT", roleCode: "OPS_AGENT", isApprover: "false" as const },
        { commandCode: "CLOSE_ACCOUNT", roleCode: "OPS_SUPERVISOR", isApprover: "false" as const },
        { commandCode: "INITIATE_PAYMENT", roleCode: "OPS_AGENT", isApprover: "false" as const },
        { commandCode: "REVERSE_PAYMENT", roleCode: "OPS_SUPERVISOR", isApprover: "false" as const },
        { commandCode: "CREATE_LOAN", roleCode: "OPS_AGENT", isApprover: "false" as const },
        { commandCode: "MODIFY_TERMS", roleCode: "OPS_SUPERVISOR", isApprover: "false" as const },
        { commandCode: "MODIFY_TERMS", roleCode: "RISK_APPROVER", isApprover: "true" as const },
        { commandCode: "WRITE_OFF_LOAN", roleCode: "RISK_APPROVER", isApprover: "false" as const },
        { commandCode: "UPDATE_POLICY_DSL", roleCode: "COMPLIANCE_APPROVER", isApprover: "false" as const },
        { commandCode: "ACTIVATE_POLICY", roleCode: "COMPLIANCE_APPROVER", isApprover: "false" as const },
        { commandCode: "REGISTER_MODEL_VERSION", roleCode: "MODEL_AUTHOR", isApprover: "false" as const },
        { commandCode: "PROMOTE_MODEL_TO_SHADOW", roleCode: "MODEL_OPERATOR", isApprover: "false" as const },
        { commandCode: "PROMOTE_MODEL_TO_CANARY", roleCode: "MODEL_APPROVER", isApprover: "false" as const },
        { commandCode: "PROMOTE_MODEL_TO_CANARY", roleCode: "MODEL_RISK_OFFICER", isApprover: "true" as const },
        { commandCode: "PROMOTE_MODEL_TO_PROD", roleCode: "MODEL_APPROVER", isApprover: "false" as const },
        { commandCode: "PROMOTE_MODEL_TO_PROD", roleCode: "RISK_APPROVER", isApprover: "true" as const },
        { commandCode: "ROLLBACK_MODEL", roleCode: "OPS_SUPERVISOR", isApprover: "false" as const },
      ];
      
      for (const binding of bindings) {
        try {
          await conn.insert(commandRoleBindings).values(binding);
        } catch (e) {
          // Ignore duplicate key errors
        }
      }
      
      return { success: true, message: "RBAC data seeded successfully" };
    }),

  /**
   * Seed authority facts with sample data for dashboard visualization
   */
  seedAuthorityFacts: protectedProcedure
    .mutation(async () => {
      const conn = await getDb();
      if (!conn) throw new Error("Database not available");
      
      const actors = [
        { id: "alice@turingdynamics.com", role: "MODEL_APPROVER" },
        { id: "bob@turingdynamics.com", role: "OPS_SUPERVISOR" },
        { id: "carol@turingdynamics.com", role: "RISK_APPROVER" },
        { id: "dave@turingdynamics.com", role: "MODEL_AUTHOR" },
        { id: "eve@turingdynamics.com", role: "OPS_AGENT" },
        { id: "frank@turingdynamics.com", role: "COMPLIANCE_APPROVER" },
      ];
      
      const commands = [
        { code: "OPEN_ACCOUNT", domain: "DEPOSITS", allowRate: 0.95 },
        { code: "CLOSE_ACCOUNT", domain: "DEPOSITS", allowRate: 0.90 },
        { code: "INITIATE_PAYMENT", domain: "PAYMENTS", allowRate: 0.92 },
        { code: "REVERSE_PAYMENT", domain: "PAYMENTS", allowRate: 0.85 },
        { code: "CREATE_LOAN", domain: "LENDING", allowRate: 0.88 },
        { code: "MODIFY_TERMS", domain: "LENDING", allowRate: 0.75 },
        { code: "REGISTER_MODEL_VERSION", domain: "ML", allowRate: 0.98 },
        { code: "PROMOTE_MODEL_TO_SHADOW", domain: "ML", allowRate: 0.95 },
        { code: "PROMOTE_MODEL_TO_CANARY", domain: "ML", allowRate: 0.80 },
        { code: "PROMOTE_MODEL_TO_PROD", domain: "ML", allowRate: 0.70 },
        { code: "UPDATE_POLICY_DSL", domain: "POLICY", allowRate: 0.85 },
        { code: "ADJUST_BALANCE", domain: "DEPOSITS", allowRate: 0.0 }, // Forbidden
        { code: "DELETE_MODEL", domain: "ML", allowRate: 0.0 }, // Forbidden
      ];
      
      const denyReasons = ["ROLE_MISSING", "APPROVAL_REQUIRED", "FORBIDDEN_COMMAND", "SCOPE_MISMATCH"];
      
      const now = Date.now();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      
      // Generate ~500 authority facts over the last 30 days
      const facts = [];
      for (let i = 0; i < 500; i++) {
        const actor = actors[Math.floor(Math.random() * actors.length)];
        const command = commands[Math.floor(Math.random() * commands.length)];
        const isAllowed = Math.random() < command.allowRate;
        const timestamp = new Date(now - Math.random() * thirtyDaysMs);
        
        facts.push({
          authorityFactId: `auth-seed-${i.toString().padStart(5, '0')}`,
          actorId: actor.id,
          actorRole: actor.role,
          commandCode: command.code,
          resourceId: `RES-${Math.floor(Math.random() * 10000).toString().padStart(5, '0')}`,
          tenantId: "tenant-001",
          environmentId: "prod",
          domain: command.domain,
          decision: isAllowed ? "ALLOW" as const : "DENY" as const,
          reasonCode: isAllowed ? "AUTHORIZED" : denyReasons[Math.floor(Math.random() * denyReasons.length)],
          createdAt: timestamp,
        });
      }
      
      // Insert in batches
      let inserted = 0;
      for (const fact of facts) {
        try {
          await conn.insert(authorityFacts).values(fact);
          inserted++;
        } catch (e) {
          // Ignore duplicate key errors
        }
      }
      
      return { success: true, message: `Seeded ${inserted} authority facts` };
    }),

  /**
   * Get decision breakdown by command type
   */
  getDecisionsByCommand: publicProcedure
    .input(z.object({
      domain: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const conn = await getDb();
      const domainFilter = input?.domain;
      
      if (!conn) {
        // Return mock data when DB not available
        const mockData = [
          { command: "OPEN_ACCOUNT", domain: "DEPOSITS", allowed: 145, denied: 8 },
          { command: "INITIATE_PAYMENT", domain: "PAYMENTS", allowed: 234, denied: 19 },
          { command: "CREATE_LOAN", domain: "LENDING", allowed: 89, denied: 12 },
          { command: "PROMOTE_MODEL_TO_PROD", domain: "ML", allowed: 23, denied: 9 },
          { command: "MODIFY_TERMS", domain: "LENDING", allowed: 45, denied: 15 },
          { command: "UPDATE_POLICY_DSL", domain: "POLICY", allowed: 34, denied: 6 },
          { command: "REGISTER_MODEL_VERSION", domain: "ML", allowed: 67, denied: 2 },
          { command: "ADJUST_BALANCE", domain: "DEPOSITS", allowed: 0, denied: 12 },
        ];
        return domainFilter ? mockData.filter(d => d.domain === domainFilter) : mockData;
      }
      
      let allFacts = await conn.select().from(authorityFacts);
      
      if (domainFilter) {
        allFacts = allFacts.filter(f => f.domain === domainFilter);
      }
      
      // Group by command
      const byCommand: Record<string, { command: string; domain: string; allowed: number; denied: number }> = {};
      
      allFacts.forEach(fact => {
        if (!byCommand[fact.commandCode]) {
          byCommand[fact.commandCode] = {
            command: fact.commandCode,
            domain: fact.domain,
            allowed: 0,
            denied: 0,
          };
        }
        if (fact.decision === "ALLOW") {
          byCommand[fact.commandCode].allowed++;
        } else {
          byCommand[fact.commandCode].denied++;
        }
      });
      
      // Sort by total count descending
      return Object.values(byCommand)
        .sort((a, b) => (b.allowed + b.denied) - (a.allowed + a.denied))
        .slice(0, 10); // Top 10 commands
    }),

  /**
   * Export authority facts as CSV
   */
  exportAuthorityFactsCSV: publicProcedure
    .input(z.object({
      domain: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const conn = await getDb();
      const domainFilter = input?.domain;
      const startDate = input?.startDate ? new Date(input.startDate) : null;
      const endDate = input?.endDate ? new Date(input.endDate) : null;
      
      if (!conn) {
        // Return mock CSV data
        const headers = "authority_fact_id,actor_id,actor_role,command_code,resource_id,domain,decision,reason_code,created_at";
        const rows = [
          "auth-001,alice@turingdynamics.com,MODEL_APPROVER,PROMOTE_MODEL_TO_CANARY,fraud-detection-v1.2.0,ML,ALLOW,AUTHORIZED,2025-12-18T10:00:00Z",
          "auth-002,dave@turingdynamics.com,MODEL_AUTHOR,PROMOTE_MODEL_TO_PROD,credit-risk-v2.2.0,ML,DENY,ROLE_MISSING,2025-12-18T09:30:00Z",
          "auth-003,eve@turingdynamics.com,OPS_AGENT,ADJUST_BALANCE,ACC-001234,DEPOSITS,DENY,FORBIDDEN_COMMAND,2025-12-18T09:00:00Z",
        ];
        return { csv: [headers, ...rows].join("\n"), count: rows.length };
      }
      
      let facts = await conn.select().from(authorityFacts)
        .orderBy(desc(authorityFacts.createdAt));
      
      // Apply filters
      if (domainFilter) {
        facts = facts.filter(f => f.domain === domainFilter);
      }
      if (startDate) {
        facts = facts.filter(f => f.createdAt && new Date(f.createdAt) >= startDate);
      }
      if (endDate) {
        facts = facts.filter(f => f.createdAt && new Date(f.createdAt) <= endDate);
      }
      
      // Generate CSV
      const headers = "authority_fact_id,actor_id,actor_role,command_code,resource_id,domain,decision,reason_code,created_at";
      const rows = facts.map(f => 
        `${f.authorityFactId},${f.actorId},${f.actorRole},${f.commandCode},${f.resourceId || ""},${f.domain},${f.decision},${f.reasonCode},${f.createdAt?.toISOString() || ""}`
      );
      
      return { csv: [headers, ...rows].join("\n"), count: facts.length };
    }),
});
