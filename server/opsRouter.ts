/**
 * Ops Console Router
 * 
 * Provides tRPC endpoints for the Ops Console:
 * - Decision queue management (pending, active, completed)
 * - Limits catalogue and override workflows
 * - System health monitoring
 */

import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";

// ============================================================================
// Types
// ============================================================================

export type DecisionStatus = 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'DECLINED' | 'ESCALATED' | 'EXPIRED';
export type DecisionType = 'PAYMENT' | 'LENDING' | 'LIMIT_OVERRIDE' | 'ACCOUNT_ACTION' | 'COMPLIANCE';
export type DecisionPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface OpsDecision {
  id: string;
  type: DecisionType;
  status: DecisionStatus;
  priority: DecisionPriority;
  title: string;
  summary: string;
  customerName: string;
  customerId: string;
  amount?: number;
  currency?: string;
  createdAt: Date;
  updatedAt: Date;
  slaDeadline: Date;
  assignedTo?: string;
  policyContext: {
    policyId: string;
    policyName: string;
    version: string;
    outcome: 'REVIEW' | 'ESCALATE';
    reason: string;
  };
  facts: Record<string, unknown>;
  evidencePackId?: string;
}

export interface Limit {
  id: string;
  name: string;
  description: string;
  category: 'TRANSACTION' | 'DAILY' | 'MONTHLY' | 'EXPOSURE' | 'VELOCITY';
  currentValue: number;
  maxValue: number;
  currency: string;
  scope: 'CUSTOMER' | 'PRODUCT' | 'CHANNEL' | 'GLOBAL';
  policyId: string;
  lastUpdated: Date;
}

export interface LimitOverride {
  id: string;
  limitId: string;
  limitName: string;
  customerId: string;
  customerName: string;
  requestedValue: number;
  currentValue: number;
  justification: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'EXPIRED';
  requestedBy: string;
  requestedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  expiresAt: Date;
  decisionId?: string;
}

export interface SystemHealth {
  overall: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  components: {
    name: string;
    status: 'UP' | 'DOWN' | 'DEGRADED';
    latency?: number;
    lastCheck: Date;
    message?: string;
  }[];
  decisionBacklog: {
    total: number;
    pending: number;
    inProgress: number;
    oldestItemAge: number; // minutes
    avgProcessingTime: number; // minutes
  };
  slaBreaches: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    recentBreaches: {
      decisionId: string;
      type: DecisionType;
      breachedAt: Date;
      slaMinutes: number;
      actualMinutes: number;
    }[];
  };
  retryQueue: {
    total: number;
    byType: Record<string, number>;
    oldestRetry: Date | null;
    failureRate: number; // percentage
  };
}

// ============================================================================
// Mock Data Generators
// ============================================================================

const customerNames = [
  'Sarah Mitchell', 'James Chen', 'Emma Wilson', 'Michael Brown', 'Jessica Taylor',
  'David Lee', 'Amanda Garcia', 'Christopher Martinez', 'Nicole Anderson', 'Matthew Thomas',
  'Ashley Jackson', 'Daniel White', 'Stephanie Harris', 'Andrew Martin', 'Jennifer Thompson'
];

const decisionTypes: DecisionType[] = ['PAYMENT', 'LENDING', 'LIMIT_OVERRIDE', 'ACCOUNT_ACTION', 'COMPLIANCE'];
const priorities: DecisionPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

function generateDecisions(count: number, status: DecisionStatus): OpsDecision[] {
  const decisions: OpsDecision[] = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const type = decisionTypes[Math.floor(Math.random() * decisionTypes.length)];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    const customerName = customerNames[Math.floor(Math.random() * customerNames.length)];
    const createdAt = new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000);
    const slaMinutes = priority === 'CRITICAL' ? 15 : priority === 'HIGH' ? 60 : priority === 'MEDIUM' ? 240 : 480;
    
    decisions.push({
      id: `DEC-${String(1000 + i).padStart(6, '0')}`,
      type,
      status,
      priority,
      title: getDecisionTitle(type),
      summary: getDecisionSummary(type, customerName),
      customerName,
      customerId: `CUS-${String(Math.floor(Math.random() * 100000)).padStart(6, '0')}`,
      amount: type === 'PAYMENT' || type === 'LENDING' ? Math.floor(Math.random() * 50000) + 1000 : undefined,
      currency: 'AUD',
      createdAt,
      updatedAt: new Date(createdAt.getTime() + Math.random() * 60 * 60 * 1000),
      slaDeadline: new Date(createdAt.getTime() + slaMinutes * 60 * 1000),
      assignedTo: status === 'IN_PROGRESS' ? 'ops-analyst-1' : undefined,
      policyContext: {
        policyId: `POL-${type.substring(0, 3)}-001`,
        policyName: getPolicyName(type),
        version: 'v1.0.0',
        outcome: priority === 'CRITICAL' || priority === 'HIGH' ? 'ESCALATE' : 'REVIEW',
        reason: getPolicyReason(type)
      },
      facts: {
        requestedAmount: Math.floor(Math.random() * 50000) + 1000,
        currentExposure: Math.floor(Math.random() * 100000),
        riskScore: Math.floor(Math.random() * 100)
      },
      evidencePackId: status !== 'PENDING' ? `EVP-${String(Math.floor(Math.random() * 10000)).padStart(6, '0')}` : undefined
    });
  }
  
  return decisions;
}

function getDecisionTitle(type: DecisionType): string {
  switch (type) {
    case 'PAYMENT': return 'High-value payment requires approval';
    case 'LENDING': return 'Loan application exceeds auto-approval threshold';
    case 'LIMIT_OVERRIDE': return 'Transaction limit increase request';
    case 'ACCOUNT_ACTION': return 'Account action requires review';
    case 'COMPLIANCE': return 'Compliance flag triggered';
  }
}

function getDecisionSummary(type: DecisionType, customer: string): string {
  switch (type) {
    case 'PAYMENT': return `${customer} initiated a payment that exceeds the daily limit threshold`;
    case 'LENDING': return `${customer}'s loan application requires manual credit assessment`;
    case 'LIMIT_OVERRIDE': return `${customer} requested a temporary increase to their transaction limit`;
    case 'ACCOUNT_ACTION': return `Account action for ${customer} flagged for review`;
    case 'COMPLIANCE': return `${customer}'s transaction triggered AML monitoring rules`;
  }
}

function getPolicyName(type: DecisionType): string {
  switch (type) {
    case 'PAYMENT': return 'High-Value Payment Policy';
    case 'LENDING': return 'Credit Assessment Policy';
    case 'LIMIT_OVERRIDE': return 'Limit Override Policy';
    case 'ACCOUNT_ACTION': return 'Account Operations Policy';
    case 'COMPLIANCE': return 'AML/CTF Compliance Policy';
  }
}

function getPolicyReason(type: DecisionType): string {
  switch (type) {
    case 'PAYMENT': return 'Amount exceeds $10,000 daily limit';
    case 'LENDING': return 'DTI ratio above 40% threshold';
    case 'LIMIT_OVERRIDE': return 'Override exceeds 2x current limit';
    case 'ACCOUNT_ACTION': return 'Action requires dual authorization';
    case 'COMPLIANCE': return 'Transaction matches suspicious pattern';
  }
}

// Generate mock data
const pendingDecisions = generateDecisions(12, 'PENDING');
const inProgressDecisions = generateDecisions(5, 'IN_PROGRESS');
const completedDecisions = [
  ...generateDecisions(15, 'APPROVED'),
  ...generateDecisions(8, 'DECLINED'),
  ...generateDecisions(3, 'ESCALATED')
];

const limits: Limit[] = [
  {
    id: 'LIM-001',
    name: 'Single Transaction Limit',
    description: 'Maximum amount for a single transaction',
    category: 'TRANSACTION',
    currentValue: 10000,
    maxValue: 50000,
    currency: 'AUD',
    scope: 'CUSTOMER',
    policyId: 'LIMIT-AU-TXN-001',
    lastUpdated: new Date()
  },
  {
    id: 'LIM-002',
    name: 'Daily Transaction Limit',
    description: 'Maximum total transactions per day',
    category: 'DAILY',
    currentValue: 25000,
    maxValue: 100000,
    currency: 'AUD',
    scope: 'CUSTOMER',
    policyId: 'LIMIT-AU-DAILY-001',
    lastUpdated: new Date()
  },
  {
    id: 'LIM-003',
    name: 'Monthly Exposure Limit',
    description: 'Maximum total exposure per month',
    category: 'MONTHLY',
    currentValue: 150000,
    maxValue: 500000,
    currency: 'AUD',
    scope: 'CUSTOMER',
    policyId: 'LIMIT-AU-TOTAL-001',
    lastUpdated: new Date()
  },
  {
    id: 'LIM-004',
    name: 'Lending Exposure Cap',
    description: 'Maximum lending exposure per customer',
    category: 'EXPOSURE',
    currentValue: 120000,
    maxValue: 300000,
    currency: 'AUD',
    scope: 'CUSTOMER',
    policyId: 'LIMIT-AU-LENDING-001',
    lastUpdated: new Date()
  },
  {
    id: 'LIM-005',
    name: 'Pending Payments Cap',
    description: 'Maximum pending payment amount',
    category: 'EXPOSURE',
    currentValue: 20000,
    maxValue: 50000,
    currency: 'AUD',
    scope: 'CUSTOMER',
    policyId: 'LIMIT-AU-PAYPEND-001',
    lastUpdated: new Date()
  },
  {
    id: 'LIM-006',
    name: 'Transaction Velocity Limit',
    description: 'Maximum transactions per hour',
    category: 'VELOCITY',
    currentValue: 10,
    maxValue: 50,
    currency: 'AUD',
    scope: 'CUSTOMER',
    policyId: 'LIMIT-AU-VEL-001',
    lastUpdated: new Date()
  }
];

const overrideRequests: LimitOverride[] = [
  {
    id: 'OVR-001',
    limitId: 'LIM-001',
    limitName: 'Single Transaction Limit',
    customerId: 'CUS-000123',
    customerName: 'TechCorp Pty Ltd',
    requestedValue: 25000,
    currentValue: 10000,
    justification: 'One-time equipment purchase for office expansion',
    status: 'PENDING',
    requestedBy: 'relationship-manager-1',
    requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  },
  {
    id: 'OVR-002',
    limitId: 'LIM-002',
    limitName: 'Daily Transaction Limit',
    customerId: 'CUS-000456',
    customerName: 'Global Trade Ltd',
    requestedValue: 75000,
    currentValue: 25000,
    justification: 'Quarterly supplier payments due this week',
    status: 'PENDING',
    requestedBy: 'relationship-manager-2',
    requestedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  },
  {
    id: 'OVR-003',
    limitId: 'LIM-003',
    limitName: 'Monthly Exposure Limit',
    customerId: 'CUS-000789',
    customerName: 'Sarah Mitchell',
    requestedValue: 200000,
    currentValue: 150000,
    justification: 'Property settlement requires temporary increase',
    status: 'APPROVED',
    requestedBy: 'branch-manager-1',
    requestedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    reviewedBy: 'ops-supervisor-1',
    reviewedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    decisionId: 'DEC-000998'
  }
];

// ============================================================================
// Router
// ============================================================================

export const opsRouter = router({
  // Decision Queue Endpoints
  getPendingDecisions: publicProcedure
    .input(z.object({
      type: z.enum(['PAYMENT', 'LENDING', 'LIMIT_OVERRIDE', 'ACCOUNT_ACTION', 'COMPLIANCE']).optional(),
      priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0)
    }).optional())
    .query(({ input }) => {
      let filtered = [...pendingDecisions];
      
      if (input?.type) {
        filtered = filtered.filter(d => d.type === input.type);
      }
      if (input?.priority) {
        filtered = filtered.filter(d => d.priority === input.priority);
      }
      
      // Sort by priority (CRITICAL first) then by creation date
      filtered.sort((a, b) => {
        const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
      
      const total = filtered.length;
      const items = filtered.slice(input?.offset ?? 0, (input?.offset ?? 0) + (input?.limit ?? 50));
      
      return {
        items,
        total,
        hasMore: (input?.offset ?? 0) + items.length < total
      };
    }),

  getActiveDecisions: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0)
    }).optional())
    .query(({ input }) => {
      const total = inProgressDecisions.length;
      const items = inProgressDecisions.slice(input?.offset ?? 0, (input?.offset ?? 0) + (input?.limit ?? 50));
      
      return {
        items,
        total,
        hasMore: (input?.offset ?? 0) + items.length < total
      };
    }),

  getCompletedDecisions: publicProcedure
    .input(z.object({
      status: z.enum(['APPROVED', 'DECLINED', 'ESCALATED']).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0)
    }).optional())
    .query(({ input }) => {
      let filtered = [...completedDecisions];
      
      if (input?.status) {
        filtered = filtered.filter(d => d.status === input.status);
      }
      
      // Sort by updated date (most recent first)
      filtered.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      
      const total = filtered.length;
      const items = filtered.slice(input?.offset ?? 0, (input?.offset ?? 0) + (input?.limit ?? 50));
      
      return {
        items,
        total,
        hasMore: (input?.offset ?? 0) + items.length < total
      };
    }),

  getDecisionById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const allDecisions = [...pendingDecisions, ...inProgressDecisions, ...completedDecisions];
      const decision = allDecisions.find(d => d.id === input.id);
      
      if (!decision) {
        throw new Error(`Decision ${input.id} not found`);
      }
      
      return decision;
    }),

  submitDecision: publicProcedure
    .input(z.object({
      decisionId: z.string(),
      action: z.enum(['APPROVE', 'DECLINE', 'ESCALATE']),
      reason: z.string().optional(),
      notes: z.string().optional()
    }))
    .mutation(({ input }) => {
      // In a real implementation, this would update the database and emit events
      const statusMap = {
        APPROVE: 'APPROVED' as const,
        DECLINE: 'DECLINED' as const,
        ESCALATE: 'ESCALATED' as const
      };
      
      return {
        success: true,
        decisionId: input.decisionId,
        newStatus: statusMap[input.action],
        timestamp: new Date(),
        evidencePackId: `EVP-${String(Math.floor(Math.random() * 10000)).padStart(6, '0')}`
      };
    }),

  getDecisionStats: publicProcedure.query(() => {
    const now = new Date();
    const breachedCount = pendingDecisions.filter(d => d.slaDeadline < now).length;
    
    return {
      pending: pendingDecisions.length,
      inProgress: inProgressDecisions.length,
      completedToday: completedDecisions.filter(d => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return d.updatedAt >= today;
      }).length,
      slaBreached: breachedCount,
      avgProcessingTime: 45, // minutes
      byPriority: {
        critical: pendingDecisions.filter(d => d.priority === 'CRITICAL').length,
        high: pendingDecisions.filter(d => d.priority === 'HIGH').length,
        medium: pendingDecisions.filter(d => d.priority === 'MEDIUM').length,
        low: pendingDecisions.filter(d => d.priority === 'LOW').length
      },
      byType: {
        payment: pendingDecisions.filter(d => d.type === 'PAYMENT').length,
        lending: pendingDecisions.filter(d => d.type === 'LENDING').length,
        limitOverride: pendingDecisions.filter(d => d.type === 'LIMIT_OVERRIDE').length,
        accountAction: pendingDecisions.filter(d => d.type === 'ACCOUNT_ACTION').length,
        compliance: pendingDecisions.filter(d => d.type === 'COMPLIANCE').length
      }
    };
  }),

  // Limits & Overrides Endpoints
  getLimits: publicProcedure
    .input(z.object({
      category: z.enum(['TRANSACTION', 'DAILY', 'MONTHLY', 'EXPOSURE', 'VELOCITY']).optional()
    }).optional())
    .query(({ input }) => {
      if (input?.category) {
        return limits.filter(l => l.category === input.category);
      }
      return limits;
    }),

  getLimitById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const limit = limits.find(l => l.id === input.id);
      if (!limit) {
        throw new Error(`Limit ${input.id} not found`);
      }
      return limit;
    }),

  getOverrideRequests: publicProcedure
    .input(z.object({
      status: z.enum(['PENDING', 'APPROVED', 'DECLINED', 'EXPIRED']).optional()
    }).optional())
    .query(({ input }) => {
      if (input?.status) {
        return overrideRequests.filter(o => o.status === input.status);
      }
      return overrideRequests;
    }),

  requestOverride: publicProcedure
    .input(z.object({
      limitId: z.string(),
      customerId: z.string(),
      requestedValue: z.number(),
      justification: z.string(),
      expiresInDays: z.number().min(1).max(90).default(7)
    }))
    .mutation(({ input }) => {
      const limit = limits.find(l => l.id === input.limitId);
      if (!limit) {
        throw new Error(`Limit ${input.limitId} not found`);
      }
      
      const override: LimitOverride = {
        id: `OVR-${String(Math.floor(Math.random() * 10000)).padStart(3, '0')}`,
        limitId: input.limitId,
        limitName: limit.name,
        customerId: input.customerId,
        customerName: 'Customer Name', // Would be looked up
        requestedValue: input.requestedValue,
        currentValue: limit.currentValue,
        justification: input.justification,
        status: 'PENDING',
        requestedBy: 'current-user', // Would come from auth context
        requestedAt: new Date(),
        expiresAt: new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      };
      
      return {
        success: true,
        override,
        decisionId: `DEC-${String(Math.floor(Math.random() * 10000)).padStart(6, '0')}`
      };
    }),

  approveOverride: publicProcedure
    .input(z.object({
      overrideId: z.string(),
      approved: z.boolean(),
      reason: z.string().optional()
    }))
    .mutation(({ input }) => {
      return {
        success: true,
        overrideId: input.overrideId,
        newStatus: input.approved ? 'APPROVED' : 'DECLINED',
        timestamp: new Date()
      };
    }),

  // System Health Endpoints
  getSystemHealth: publicProcedure.query((): SystemHealth => {
    const now = new Date();
    const oldestPending = pendingDecisions.reduce((oldest, d) => 
      d.createdAt < oldest ? d.createdAt : oldest, now);
    const oldestAgeMinutes = Math.floor((now.getTime() - oldestPending.getTime()) / 60000);
    
    const breachedDecisions = pendingDecisions.filter(d => d.slaDeadline < now);
    
    return {
      overall: breachedDecisions.length > 5 ? 'CRITICAL' : breachedDecisions.length > 0 ? 'DEGRADED' : 'HEALTHY',
      components: [
        { name: 'Decision Engine', status: 'UP', latency: 45, lastCheck: now },
        { name: 'Ledger Service', status: 'UP', latency: 23, lastCheck: now },
        { name: 'Policy Engine', status: 'UP', latency: 12, lastCheck: now },
        { name: 'Evidence Store', status: 'UP', latency: 67, lastCheck: now },
        { name: 'Merkle Sealer', status: 'UP', latency: 89, lastCheck: now },
        { name: 'NPP Gateway', status: 'UP', latency: 156, lastCheck: now },
        { name: 'BECS Gateway', status: 'UP', latency: 234, lastCheck: now },
        { name: 'Database', status: 'UP', latency: 8, lastCheck: now }
      ],
      decisionBacklog: {
        total: pendingDecisions.length + inProgressDecisions.length,
        pending: pendingDecisions.length,
        inProgress: inProgressDecisions.length,
        oldestItemAge: oldestAgeMinutes,
        avgProcessingTime: 45
      },
      slaBreaches: {
        total: breachedDecisions.length,
        critical: breachedDecisions.filter(d => d.priority === 'CRITICAL').length,
        high: breachedDecisions.filter(d => d.priority === 'HIGH').length,
        medium: breachedDecisions.filter(d => d.priority === 'MEDIUM').length,
        recentBreaches: breachedDecisions.slice(0, 5).map(d => ({
          decisionId: d.id,
          type: d.type,
          breachedAt: d.slaDeadline,
          slaMinutes: d.priority === 'CRITICAL' ? 15 : d.priority === 'HIGH' ? 60 : 240,
          actualMinutes: Math.floor((now.getTime() - d.createdAt.getTime()) / 60000)
        }))
      },
      retryQueue: {
        total: 3,
        byType: { PAYMENT: 2, LENDING: 1 },
        oldestRetry: new Date(now.getTime() - 30 * 60 * 1000),
        failureRate: 0.5
      }
    };
  }),

  getComponentHealth: publicProcedure
    .input(z.object({ component: z.string() }))
    .query(({ input }) => {
      const healthData: Record<string, { status: string; metrics: Record<string, number> }> = {
        'Decision Engine': {
          status: 'UP',
          metrics: { requestsPerSecond: 45, avgLatency: 45, errorRate: 0.01 }
        },
        'Ledger Service': {
          status: 'UP',
          metrics: { postingsPerSecond: 120, avgLatency: 23, errorRate: 0 }
        },
        'Policy Engine': {
          status: 'UP',
          metrics: { evaluationsPerSecond: 200, avgLatency: 12, cacheHitRate: 0.85 }
        }
      };
      
      return healthData[input.component] ?? { status: 'UNKNOWN', metrics: {} };
    })
});
