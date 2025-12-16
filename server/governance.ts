/**
 * Governance Data Module
 * 
 * This module connects to the TuringCore-v3 Governance API
 * to fetch live data for decisions, evidence, modules, and replay proofs.
 */

// ============================================
// TYPES - Mirror TuringCore-v3 structures
// ============================================

export interface PolicyResult {
  policyId: string;
  policyName: string;
  outcome: "ALLOW" | "REVIEW" | "DECLINE";
  reason: string;
}

export interface Decision {
  decisionId: string;
  entityId: string;
  entityType: "LOAN" | "PAYMENT" | "DEPOSIT" | "EXPOSURE";
  outcome: "ALLOW" | "REVIEW" | "DECLINE";
  policiesFired: string[];
  policyResults: PolicyResult[];
  factsHash: string;
  explanation: string;
  createdAt: Date;
}

export interface EvidenceEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface EvidenceManifest {
  factsHash: string;
  decisionHash: string;
  historyHash: string;
  schemaVersion: string;
}

export interface EvidencePack {
  evidenceId: string;
  decisionId: string;
  entityId: string;
  entityType: string;
  state: string;
  facts: Record<string, unknown>;
  eventHistory: EvidenceEvent[];
  replayHash: string;
  manifest: EvidenceManifest;
  createdAt: Date;
}

export interface ModuleStatus {
  moduleId: string;
  name: string;
  status: "GREEN" | "YELLOW" | "RED";
  testsPassing: number;
  testsTotal: number;
  lastVerified: Date;
  surfaceFrozen: boolean;
}

export interface ReplayProof {
  proofId: string;
  moduleName: string;
  testName: string;
  inputHash: string;
  outputHash: string;
  matched: boolean;
  executedAt: Date;
}

export interface SystemSummary {
  totalModules: number;
  allGreen: boolean;
  allFrozen: boolean;
  passingTests: number;
  totalTests: number;
  releaseTag: string;
  decisions: {
    total: number;
    allowed: number;
    reviewed: number;
    declined: number;
  };
}

export interface GovernanceBoundary {
  boundaryId: string;
  name: string;
  description: string;
  enforced: boolean;
  enforcedAt: Date;
}

// ============================================
// API CLIENT - Connect to TuringCore-v3
// ============================================

const API_BASE_URL = process.env.GOVERNANCE_API_URL || "http://localhost:8001";

async function fetchFromAPI<T>(endpoint: string): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return await response.json() as T;
  } catch (error) {
    console.error(`Failed to fetch from ${endpoint}:`, error);
    throw error;
  }
}

// ============================================
// DATA FETCHERS
// ============================================

export async function getDecisions(): Promise<Decision[]> {
  interface APIDecision {
    decision_id: string;
    entity_id: string;
    entity_type: string;
    outcome: string;
    policies_fired: string[];
    policy_results: Array<{
      policy_id: string;
      policy_name: string;
      outcome: string;
      reason: string;
    }>;
    facts_hash: string;
    explanation: string;
    created_at: string;
  }
  
  const data = await fetchFromAPI<APIDecision[]>("/api/decisions");
  
  return data.map(d => ({
    decisionId: d.decision_id,
    entityId: d.entity_id,
    entityType: d.entity_type as Decision["entityType"],
    outcome: d.outcome as Decision["outcome"],
    policiesFired: d.policies_fired,
    policyResults: d.policy_results.map(pr => ({
      policyId: pr.policy_id,
      policyName: pr.policy_name,
      outcome: pr.outcome as PolicyResult["outcome"],
      reason: pr.reason,
    })),
    factsHash: d.facts_hash,
    explanation: d.explanation,
    createdAt: new Date(d.created_at),
  }));
}

export async function getDecision(decisionId: string): Promise<Decision | null> {
  try {
    interface APIDecision {
      decision_id: string;
      entity_id: string;
      entity_type: string;
      outcome: string;
      policies_fired: string[];
      policy_results: Array<{
        policy_id: string;
        policy_name: string;
        outcome: string;
        reason: string;
      }>;
      facts_hash: string;
      explanation: string;
      created_at: string;
    }
    
    const d = await fetchFromAPI<APIDecision>(`/api/decisions/${decisionId}`);
    
    return {
      decisionId: d.decision_id,
      entityId: d.entity_id,
      entityType: d.entity_type as Decision["entityType"],
      outcome: d.outcome as Decision["outcome"],
      policiesFired: d.policies_fired,
      policyResults: d.policy_results.map(pr => ({
        policyId: pr.policy_id,
        policyName: pr.policy_name,
        outcome: pr.outcome as PolicyResult["outcome"],
        reason: pr.reason,
      })),
      factsHash: d.facts_hash,
      explanation: d.explanation,
      createdAt: new Date(d.created_at),
    };
  } catch {
    return null;
  }
}

export async function getEvidencePacks(): Promise<EvidencePack[]> {
  interface APIEvidencePack {
    evidence_id: string;
    decision_id: string;
    entity_id: string;
    entity_type: string;
    state: string;
    facts: Record<string, unknown>;
    event_history: Array<{
      event_id: string;
      event_type: string;
      timestamp: string;
      data: Record<string, unknown>;
    }>;
    replay_hash: string;
    manifest: {
      facts_hash: string;
      decision_hash: string;
      history_hash: string;
      schema_version: string;
    };
    created_at: string;
  }
  
  const data = await fetchFromAPI<APIEvidencePack[]>("/api/evidence");
  
  return data.map(e => ({
    evidenceId: e.evidence_id,
    decisionId: e.decision_id,
    entityId: e.entity_id,
    entityType: e.entity_type,
    state: e.state,
    facts: e.facts,
    eventHistory: e.event_history.map(ev => ({
      eventId: ev.event_id,
      eventType: ev.event_type,
      timestamp: ev.timestamp,
      data: ev.data,
    })),
    replayHash: e.replay_hash,
    manifest: {
      factsHash: e.manifest.facts_hash,
      decisionHash: e.manifest.decision_hash,
      historyHash: e.manifest.history_hash,
      schemaVersion: e.manifest.schema_version,
    },
    createdAt: new Date(e.created_at),
  }));
}

export async function getModules(): Promise<ModuleStatus[]> {
  interface APIModule {
    module_id: string;
    name: string;
    status: string;
    tests_passing: number;
    tests_total: number;
    last_verified: string;
    surface_frozen: boolean;
  }
  
  const data = await fetchFromAPI<APIModule[]>("/api/modules");
  
  return data.map(m => ({
    moduleId: m.module_id,
    name: m.name,
    status: m.status as ModuleStatus["status"],
    testsPassing: m.tests_passing,
    testsTotal: m.tests_total,
    lastVerified: new Date(m.last_verified),
    surfaceFrozen: m.surface_frozen,
  }));
}

export async function getReplayProofs(): Promise<ReplayProof[]> {
  interface APIReplayProof {
    proof_id: string;
    module_name: string;
    test_name: string;
    input_hash: string;
    output_hash: string;
    matched: boolean;
    executed_at: string;
  }
  
  const data = await fetchFromAPI<APIReplayProof[]>("/api/replay-proofs");
  
  return data.map(r => ({
    proofId: r.proof_id,
    moduleName: r.module_name,
    testName: r.test_name,
    inputHash: r.input_hash,
    outputHash: r.output_hash,
    matched: r.matched,
    executedAt: new Date(r.executed_at),
  }));
}

export async function getSystemSummary(): Promise<SystemSummary> {
  interface APISummary {
    total_modules: number;
    all_green: boolean;
    all_frozen: boolean;
    passing_tests: number;
    total_tests: number;
    release_tag: string;
    decisions: {
      total: number;
      allowed: number;
      reviewed: number;
      declined: number;
    };
  }
  
  const data = await fetchFromAPI<APISummary>("/api/summary");
  
  return {
    totalModules: data.total_modules,
    allGreen: data.all_green,
    allFrozen: data.all_frozen,
    passingTests: data.passing_tests,
    totalTests: data.total_tests,
    releaseTag: data.release_tag,
    decisions: data.decisions,
  };
}

// ============================================
// STATIC DATA - Governance boundaries
// ============================================

const NOW = new Date();

export const GOVERNANCE_BOUNDARIES: GovernanceBoundary[] = [
  {
    boundaryId: "BOUND-001",
    name: "No New Execution Domains",
    description: "No new execution domains until customer demands. Current domains: Resolve, Ledger, Lending, Payments, Exposure, Deposits.",
    enforced: true,
    enforcedAt: NOW,
  },
  {
    boundaryId: "BOUND-002",
    name: "No ML Decisions Without Wrappers",
    description: "No ML decisions without Resolve governance wrappers. ML outputs are facts, not decisions.",
    enforced: true,
    enforcedAt: NOW,
  },
  {
    boundaryId: "BOUND-003",
    name: "No Ledger Changes Without Exception",
    description: "No ledger schema or posting logic changes without governance exception approval.",
    enforced: true,
    enforcedAt: NOW,
  },
  {
    boundaryId: "BOUND-004",
    name: "Execution Requires Decision",
    description: "No execution module can change state without a valid decision_id from Resolve.",
    enforced: true,
    enforcedAt: NOW,
  },
];

export const INTERNAL_DECLARATIONS = [
  {
    declarationId: "DECL-001",
    module: "Resolve",
    statement: "Resolve surface is frozen. All future changes require governance exception.",
    declaredAt: NOW,
    declaredBy: "System Governance",
  },
  {
    declarationId: "DECL-002",
    module: "Ledger",
    statement: "Ledger surface is frozen. All future changes require governance exception.",
    declaredAt: NOW,
    declaredBy: "System Governance",
  },
  {
    declarationId: "DECL-003",
    module: "Lending",
    statement: "Lending surface is frozen. All future changes require governance exception.",
    declaredAt: NOW,
    declaredBy: "System Governance",
  },
  {
    declarationId: "DECL-004",
    module: "Payments",
    statement: "Payments surface is frozen. All future changes require governance exception.",
    declaredAt: NOW,
    declaredBy: "System Governance",
  },
  {
    declarationId: "DECL-005",
    module: "Exposure",
    statement: "Exposure surface is frozen (Facts-only). All future changes require governance exception.",
    declaredAt: NOW,
    declaredBy: "System Governance",
  },
  {
    declarationId: "DECL-006",
    module: "Deposits",
    statement: "Deposits surface is frozen (Replacement-Grade). All future changes require governance exception.",
    declaredAt: NOW,
    declaredBy: "System Governance",
  },
];

export const RELEASE_INFO = {
  tag: "v1.0-replacement-ready",
  date: NOW,
  description: "Production-ready release with all 6 modules frozen and GREEN. UltraData/Geniusto deposits can be turned off.",
  commitHash: "abc123def456",
  modules: ["Resolve", "Ledger", "Lending", "Payments", "Exposure", "Deposits"],
};
