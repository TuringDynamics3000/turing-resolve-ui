/**
 * Governance Data Module
 * 
 * This module provides data structures and mock data that mirrors
 * the TuringCore-v3 governance modules (Resolve, Lending, Payments, Deposits, Exposure).
 * 
 * In production, this would call the TuringCore-v3 Python API.
 * For demo purposes, we provide realistic mock data.
 */

import { nanoid } from "nanoid";

// ============================================
// TYPES - Mirror TuringCore-v3 structures
// ============================================

export interface Decision {
  decisionId: string;
  entityId: string;
  entityType: "LOAN" | "PAYMENT" | "DEPOSIT" | "EXPOSURE";
  outcome: "ALLOW" | "REVIEW" | "DECLINE";
  policiesFired: string[];
  factsUsed: Record<string, unknown>[];
  explanation: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
  riskScore: number;
}

export interface EvidencePack {
  evidenceId: string;
  decisionId: string;
  entityId: string;
  entityType: string;
  state: string;
  facts: Record<string, unknown>;
  decisionTrace: {
    decisionId: string;
    outcome: string;
    policies: string[];
    explanation: string;
  };
  eventHistory: Array<{
    eventId: string;
    type: string;
    timestamp: string;
    data?: Record<string, unknown>;
  }>;
  replayHash: string;
  manifest: {
    factsHash: string;
    decisionHash: string;
    historyHash: string;
    schemaVersion: string;
  };
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
  frozenAt?: Date;
}

export interface GovernanceBoundary {
  boundaryId: string;
  name: string;
  description: string;
  enforced: boolean;
  enforcedAt: Date;
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

// ============================================
// MOCK DATA - Realistic TuringCore-v3 data
// ============================================

const NOW = new Date();
const HOUR_AGO = new Date(NOW.getTime() - 60 * 60 * 1000);
const DAY_AGO = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);

// Decisions
export const DECISIONS: Decision[] = [
  {
    decisionId: "DEC-LEND-2024-001",
    entityId: "LOAN-001",
    entityType: "LOAN",
    outcome: "ALLOW",
    policiesFired: ["LEND-AU-EXPOSURE-001", "LEND-AU-INCOME-001", "LEND-AU-CREDIT-001"],
    factsUsed: [
      { type: "borrower.income", value: 120000, currency: "AUD" },
      { type: "loan.amount", value: 50000, currency: "AUD" },
      { type: "borrower.credit_score", value: 750 },
      { type: "exposure.total", value: 45000, currency: "AUD" },
    ],
    explanation: "Loan approved: Income ratio 2.4x (min 2.0x), credit score 750 (min 650), exposure within limits",
    createdAt: HOUR_AGO,
    metadata: { channel: "mobile", branch: "Sydney CBD" },
    riskScore: 15,
  },
  {
    decisionId: "DEC-LEND-2024-002",
    entityId: "LOAN-002",
    entityType: "LOAN",
    outcome: "DECLINE",
    policiesFired: ["LIMIT-AU-TOTAL-001", "LIMIT-AU-LENDING-001"],
    factsUsed: [
      { type: "borrower.income", value: 85000, currency: "AUD" },
      { type: "loan.amount", value: 75000, currency: "AUD" },
      { type: "exposure.total", value: 142000, currency: "AUD" },
      { type: "exposure.lending", value: 118000, currency: "AUD" },
    ],
    explanation: "Loan declined: Total exposure $142k exceeds cap $150k after proposed loan, lending exposure $118k near cap $120k",
    createdAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
    metadata: { channel: "branch", branch: "Melbourne Central" },
    riskScore: 92,
  },
  {
    decisionId: "DEC-PAY-2024-001",
    entityId: "PAY-001",
    entityType: "PAYMENT",
    outcome: "ALLOW",
    policiesFired: ["PAY-AU-BALANCE-001", "PAY-AU-VELOCITY-001"],
    factsUsed: [
      { type: "payment.amount", value: 2500, currency: "AUD" },
      { type: "account.balance", value: 15000, currency: "AUD" },
      { type: "daily_velocity", value: 3500, currency: "AUD" },
    ],
    explanation: "Payment authorized: Sufficient balance, within daily velocity limits",
    createdAt: new Date(NOW.getTime() - 30 * 60 * 1000),
    metadata: { paymentType: "BPAY", biller: "AGL Energy" },
    riskScore: 8,
  },
  {
    decisionId: "DEC-PAY-2024-002",
    entityId: "PAY-002",
    entityType: "PAYMENT",
    outcome: "REVIEW",
    policiesFired: ["PAY-AU-VELOCITY-001", "PAY-AU-PATTERN-001"],
    factsUsed: [
      { type: "payment.amount", value: 15000, currency: "AUD" },
      { type: "account.balance", value: 45000, currency: "AUD" },
      { type: "daily_velocity", value: 18500, currency: "AUD" },
      { type: "pattern.deviation", value: 3.2 },
    ],
    explanation: "Payment flagged for review: Daily velocity $18.5k exceeds threshold $15k, pattern deviation 3.2 std",
    createdAt: new Date(NOW.getTime() - 45 * 60 * 1000),
    metadata: { paymentType: "NPP", recipient: "Unknown Account" },
    riskScore: 72,
  },
  {
    decisionId: "DEC-DEP-2024-001",
    entityId: "DEP-001",
    entityType: "DEPOSIT",
    outcome: "ALLOW",
    policiesFired: ["DEP-AU-KYC-001", "DEP-AU-DORMANCY-001"],
    factsUsed: [
      { type: "account.status", value: "ACTIVE" },
      { type: "kyc.verified", value: true },
      { type: "last_activity_days", value: 15 },
    ],
    explanation: "Withdrawal approved: Account active, KYC verified, recent activity within 90 days",
    createdAt: new Date(NOW.getTime() - 15 * 60 * 1000),
    metadata: { actionType: "WITHDRAWAL", amount: 5000 },
    riskScore: 5,
  },
  {
    decisionId: "DEC-DEP-2024-002",
    entityId: "DEP-002",
    entityType: "DEPOSIT",
    outcome: "DECLINE",
    policiesFired: ["DEP-AU-FREEZE-001", "DEP-AU-LEGAL-001"],
    factsUsed: [
      { type: "account.status", value: "LEGAL_HOLD" },
      { type: "legal_hold.active", value: true },
      { type: "legal_hold.authority", value: "AFP" },
    ],
    explanation: "Withdrawal blocked: Account under legal hold by AFP, no transactions permitted",
    createdAt: new Date(NOW.getTime() - 20 * 60 * 1000),
    metadata: { actionType: "WITHDRAWAL", amount: 50000 },
    riskScore: 99,
  },
  {
    decisionId: "DEC-EXP-2024-001",
    entityId: "CUST-001",
    entityType: "EXPOSURE",
    outcome: "REVIEW",
    policiesFired: ["LIMIT-AU-HIGHVALUE-001"],
    factsUsed: [
      { type: "exposure.total", value: 285000, currency: "AUD" },
      { type: "exposure.lending", value: 180000, currency: "AUD" },
      { type: "exposure.payments_pending", value: 15000, currency: "AUD" },
    ],
    explanation: "High-value customer flagged: Total exposure $285k exceeds escalation threshold $250k",
    createdAt: new Date(NOW.getTime() - 10 * 60 * 1000),
    metadata: { customerId: "CUST-001", segment: "Premium" },
    riskScore: 65,
  },
];

// Evidence Packs
export const EVIDENCE_PACKS: EvidencePack[] = [
  {
    evidenceId: "EVD-LEND-001",
    decisionId: "DEC-LEND-2024-001",
    entityId: "LOAN-001",
    entityType: "LOAN",
    state: "APPROVED",
    facts: {
      "borrower.income": 120000,
      "loan.amount": 50000,
      "borrower.credit_score": 750,
      "borrower.employment_years": 5,
      "borrower.existing_debt": 25000,
      "exposure.total": 45000,
      "exposure.lending": 25000,
    },
    decisionTrace: {
      decisionId: "DEC-LEND-2024-001",
      outcome: "ALLOW",
      policies: ["LEND-AU-EXPOSURE-001", "LEND-AU-INCOME-001", "LEND-AU-CREDIT-001"],
      explanation: "All lending policies passed. Income ratio 2.4x exceeds minimum 2.0x. Credit score 750 exceeds minimum 650. Total exposure after loan $95k within $150k cap.",
    },
    eventHistory: [
      { eventId: "E001", type: "LoanApplicationSubmitted", timestamp: new Date(HOUR_AGO.getTime() - 5 * 60 * 1000).toISOString() },
      { eventId: "E002", type: "FactsCollected", timestamp: new Date(HOUR_AGO.getTime() - 4 * 60 * 1000).toISOString() },
      { eventId: "E003", type: "ResolveEvaluationStarted", timestamp: new Date(HOUR_AGO.getTime() - 3 * 60 * 1000).toISOString() },
      { eventId: "E004", type: "PolicyEvaluated", timestamp: new Date(HOUR_AGO.getTime() - 2 * 60 * 1000).toISOString(), data: { policy: "LEND-AU-EXPOSURE-001", result: "PASS" } },
      { eventId: "E005", type: "PolicyEvaluated", timestamp: new Date(HOUR_AGO.getTime() - 1 * 60 * 1000).toISOString(), data: { policy: "LEND-AU-INCOME-001", result: "PASS" } },
      { eventId: "E006", type: "PolicyEvaluated", timestamp: HOUR_AGO.toISOString(), data: { policy: "LEND-AU-CREDIT-001", result: "PASS" } },
      { eventId: "E007", type: "DecisionFinalized", timestamp: new Date(HOUR_AGO.getTime() + 1000).toISOString() },
      { eventId: "E008", type: "LoanApproved", timestamp: new Date(HOUR_AGO.getTime() + 2000).toISOString() },
      { eventId: "E009", type: "LedgerPostingRequested", timestamp: new Date(HOUR_AGO.getTime() + 3000).toISOString() },
      { eventId: "E010", type: "LedgerPostingCommitted", timestamp: new Date(HOUR_AGO.getTime() + 5000).toISOString() },
    ],
    replayHash: "a7b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
    manifest: {
      factsHash: "f1a2c3d4e5f67890",
      decisionHash: "d4e5f6a7b8c90123",
      historyHash: "h7i8j9k0l1m2n3o4",
      schemaVersion: "1.0.0",
    },
    createdAt: HOUR_AGO,
  },
  {
    evidenceId: "EVD-PAY-001",
    decisionId: "DEC-PAY-2024-002",
    entityId: "PAY-002",
    entityType: "PAYMENT",
    state: "PENDING_REVIEW",
    facts: {
      "payment.amount": 15000,
      "account.balance": 45000,
      "daily_velocity": 18500,
      "weekly_velocity": 42000,
      "pattern.deviation": 3.2,
      "recipient.known": false,
    },
    decisionTrace: {
      decisionId: "DEC-PAY-2024-002",
      outcome: "REVIEW",
      policies: ["PAY-AU-VELOCITY-001", "PAY-AU-PATTERN-001"],
      explanation: "Payment flagged for manual review. Daily velocity $18,500 exceeds $15,000 threshold. Transaction pattern shows 3.2 standard deviation from normal behavior.",
    },
    eventHistory: [
      { eventId: "P001", type: "PaymentInitiated", timestamp: new Date(NOW.getTime() - 46 * 60 * 1000).toISOString() },
      { eventId: "P002", type: "FactsCollected", timestamp: new Date(NOW.getTime() - 45.5 * 60 * 1000).toISOString() },
      { eventId: "P003", type: "ResolveEvaluationStarted", timestamp: new Date(NOW.getTime() - 45.4 * 60 * 1000).toISOString() },
      { eventId: "P004", type: "PolicyEvaluated", timestamp: new Date(NOW.getTime() - 45.3 * 60 * 1000).toISOString(), data: { policy: "PAY-AU-BALANCE-001", result: "PASS" } },
      { eventId: "P005", type: "PolicyEvaluated", timestamp: new Date(NOW.getTime() - 45.2 * 60 * 1000).toISOString(), data: { policy: "PAY-AU-VELOCITY-001", result: "FLAG" } },
      { eventId: "P006", type: "PolicyEvaluated", timestamp: new Date(NOW.getTime() - 45.1 * 60 * 1000).toISOString(), data: { policy: "PAY-AU-PATTERN-001", result: "FLAG" } },
      { eventId: "P007", type: "DecisionFinalized", timestamp: new Date(NOW.getTime() - 45 * 60 * 1000).toISOString() },
      { eventId: "P008", type: "PaymentHeld", timestamp: new Date(NOW.getTime() - 44.9 * 60 * 1000).toISOString() },
    ],
    replayHash: "b8c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567891",
    manifest: {
      factsHash: "g2b3c4d5e6f78901",
      decisionHash: "e5f6g7h8i9j01234",
      historyHash: "i8j9k0l1m2n3o4p5",
      schemaVersion: "1.0.0",
    },
    createdAt: new Date(NOW.getTime() - 45 * 60 * 1000),
  },
  {
    evidenceId: "EVD-DEP-001",
    decisionId: "DEC-DEP-2024-002",
    entityId: "DEP-002",
    entityType: "DEPOSIT",
    state: "BLOCKED",
    facts: {
      "account.status": "LEGAL_HOLD",
      "account.balance": 125000,
      "legal_hold.active": true,
      "legal_hold.authority": "AFP",
      "legal_hold.reference": "AFP-2024-12345",
      "legal_hold.applied_at": DAY_AGO.toISOString(),
    },
    decisionTrace: {
      decisionId: "DEC-DEP-2024-002",
      outcome: "DECLINE",
      policies: ["DEP-AU-FREEZE-001", "DEP-AU-LEGAL-001"],
      explanation: "Transaction blocked. Account is under legal hold by Australian Federal Police (Reference: AFP-2024-12345). No debit transactions permitted until hold is released.",
    },
    eventHistory: [
      { eventId: "D001", type: "WithdrawalRequested", timestamp: new Date(NOW.getTime() - 21 * 60 * 1000).toISOString(), data: { amount: 50000 } },
      { eventId: "D002", type: "AccountStatusChecked", timestamp: new Date(NOW.getTime() - 20.9 * 60 * 1000).toISOString() },
      { eventId: "D003", type: "LegalHoldDetected", timestamp: new Date(NOW.getTime() - 20.8 * 60 * 1000).toISOString() },
      { eventId: "D004", type: "PolicyEvaluated", timestamp: new Date(NOW.getTime() - 20.7 * 60 * 1000).toISOString(), data: { policy: "DEP-AU-FREEZE-001", result: "BLOCK" } },
      { eventId: "D005", type: "PolicyEvaluated", timestamp: new Date(NOW.getTime() - 20.6 * 60 * 1000).toISOString(), data: { policy: "DEP-AU-LEGAL-001", result: "BLOCK" } },
      { eventId: "D006", type: "DecisionFinalized", timestamp: new Date(NOW.getTime() - 20.5 * 60 * 1000).toISOString() },
      { eventId: "D007", type: "WithdrawalBlocked", timestamp: new Date(NOW.getTime() - 20 * 60 * 1000).toISOString() },
      { eventId: "D008", type: "ComplianceNotified", timestamp: new Date(NOW.getTime() - 19.9 * 60 * 1000).toISOString() },
    ],
    replayHash: "c9d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567892",
    manifest: {
      factsHash: "h3c4d5e6f7890123",
      decisionHash: "f6g7h8i9j0k12345",
      historyHash: "j9k0l1m2n3o4p5q6",
      schemaVersion: "1.0.0",
    },
    createdAt: new Date(NOW.getTime() - 20 * 60 * 1000),
  },
];

// Module Status
export const MODULE_STATUS: ModuleStatus[] = [
  {
    moduleId: "resolve",
    name: "Resolve",
    status: "GREEN",
    testsPassing: 45,
    testsTotal: 45,
    lastVerified: NOW,
    surfaceFrozen: true,
    frozenAt: DAY_AGO,
  },
  {
    moduleId: "ledger",
    name: "Ledger",
    status: "GREEN",
    testsPassing: 38,
    testsTotal: 38,
    lastVerified: NOW,
    surfaceFrozen: true,
    frozenAt: DAY_AGO,
  },
  {
    moduleId: "lending",
    name: "Lending",
    status: "GREEN",
    testsPassing: 42,
    testsTotal: 42,
    lastVerified: NOW,
    surfaceFrozen: true,
    frozenAt: DAY_AGO,
  },
  {
    moduleId: "payments",
    name: "Payments",
    status: "GREEN",
    testsPassing: 49,
    testsTotal: 49,
    lastVerified: NOW,
    surfaceFrozen: true,
    frozenAt: DAY_AGO,
  },
  {
    moduleId: "exposure",
    name: "Exposure",
    status: "GREEN",
    testsPassing: 48,
    testsTotal: 48,
    lastVerified: NOW,
    surfaceFrozen: true,
    frozenAt: DAY_AGO,
  },
  {
    moduleId: "deposits",
    name: "Deposits",
    status: "GREEN",
    testsPassing: 25,
    testsTotal: 25,
    lastVerified: NOW,
    surfaceFrozen: true,
    frozenAt: NOW,
  },
];

// Governance Boundaries
export const GOVERNANCE_BOUNDARIES: GovernanceBoundary[] = [
  {
    boundaryId: "BOUND-001",
    name: "No New Execution Domains",
    description: "All 6 domains (Resolve, Ledger, Lending, Payments, Exposure, Deposits) are frozen. No new domains until customer demand.",
    enforced: true,
    enforcedAt: NOW,
  },
  {
    boundaryId: "BOUND-002",
    name: "No Ledger Changes",
    description: "Ledger is the sole source of financial truth. No schema or logic changes without governance exception.",
    enforced: true,
    enforcedAt: NOW,
  },
  {
    boundaryId: "BOUND-003",
    name: "No Execution Logic Outside Resolve",
    description: "All decisions flow through Resolve. Execution modules cannot make decisions independently.",
    enforced: true,
    enforcedAt: NOW,
  },
  {
    boundaryId: "BOUND-004",
    name: "No ML Decisions Without Governance Wrappers",
    description: "ML model outputs are facts, not decisions. All ML must be wrapped by Resolve policies.",
    enforced: true,
    enforcedAt: NOW,
  },
];

// Replay Proofs
export const REPLAY_PROOFS: ReplayProof[] = [
  // Lending
  { proofId: "RP-LEND-001", moduleName: "Lending", testName: "test_loan_approval_deterministic", inputHash: "abc123", outputHash: "def456", matched: true, executedAt: NOW },
  { proofId: "RP-LEND-002", moduleName: "Lending", testName: "test_loan_decline_deterministic", inputHash: "ghi789", outputHash: "jkl012", matched: true, executedAt: NOW },
  { proofId: "RP-LEND-003", moduleName: "Lending", testName: "test_state_machine_transitions", inputHash: "mno345", outputHash: "pqr678", matched: true, executedAt: NOW },
  // Payments
  { proofId: "RP-PAY-001", moduleName: "Payments", testName: "test_payment_authorization_deterministic", inputHash: "stu901", outputHash: "vwx234", matched: true, executedAt: NOW },
  { proofId: "RP-PAY-002", moduleName: "Payments", testName: "test_payment_decline_deterministic", inputHash: "yza567", outputHash: "bcd890", matched: true, executedAt: NOW },
  { proofId: "RP-PAY-003", moduleName: "Payments", testName: "test_state_machine_hard_gates", inputHash: "efg123", outputHash: "hij456", matched: true, executedAt: NOW },
  // Deposits
  { proofId: "RP-DEP-001", moduleName: "Deposits", testName: "test_account_lifecycle_deterministic", inputHash: "klm789", outputHash: "nop012", matched: true, executedAt: NOW },
  { proofId: "RP-DEP-002", moduleName: "Deposits", testName: "test_hold_placement_deterministic", inputHash: "qrs345", outputHash: "tuv678", matched: true, executedAt: NOW },
  { proofId: "RP-DEP-003", moduleName: "Deposits", testName: "test_interest_accrual_deterministic", inputHash: "wxy901", outputHash: "zab234", matched: true, executedAt: NOW },
  // Exposure
  { proofId: "RP-EXP-001", moduleName: "Exposure", testName: "test_exposure_projection_deterministic", inputHash: "cde567", outputHash: "fgh890", matched: true, executedAt: NOW },
  { proofId: "RP-EXP-002", moduleName: "Exposure", testName: "test_limits_evaluation_deterministic", inputHash: "ijk123", outputHash: "lmn456", matched: true, executedAt: NOW },
  { proofId: "RP-EXP-003", moduleName: "Exposure", testName: "test_snapshot_replay_deterministic", inputHash: "opq789", outputHash: "rst012", matched: true, executedAt: NOW },
];

// ============================================
// QUERY FUNCTIONS
// ============================================

export function getDecisions(filters?: { entityType?: string; outcome?: string; limit?: number }): Decision[] {
  let result = [...DECISIONS];
  
  if (filters?.entityType) {
    result = result.filter(d => d.entityType === filters.entityType);
  }
  if (filters?.outcome) {
    result = result.filter(d => d.outcome === filters.outcome);
  }
  
  result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  
  if (filters?.limit) {
    result = result.slice(0, filters.limit);
  }
  
  return result;
}

export function getDecision(decisionId: string): Decision | null {
  return DECISIONS.find(d => d.decisionId === decisionId) || null;
}

export function getEvidencePack(decisionId: string): EvidencePack | null {
  return EVIDENCE_PACKS.find(e => e.decisionId === decisionId) || null;
}

export function getEvidencePacks(filters?: { entityType?: string; limit?: number }): EvidencePack[] {
  let result = [...EVIDENCE_PACKS];
  
  if (filters?.entityType) {
    result = result.filter(e => e.entityType === filters.entityType);
  }
  
  result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  
  if (filters?.limit) {
    result = result.slice(0, filters.limit);
  }
  
  return result;
}

export function getModuleStatus(): ModuleStatus[] {
  return MODULE_STATUS;
}

export function getModuleStatusById(moduleId: string): ModuleStatus | null {
  return MODULE_STATUS.find(m => m.moduleId === moduleId) || null;
}

export function getGovernanceBoundaries(): GovernanceBoundary[] {
  return GOVERNANCE_BOUNDARIES;
}

export function getReplayProofs(moduleName?: string): ReplayProof[] {
  if (moduleName) {
    return REPLAY_PROOFS.filter(p => p.moduleName === moduleName);
  }
  return REPLAY_PROOFS;
}

export function getSystemSummary() {
  const modules = getModuleStatus();
  const totalTests = modules.reduce((sum, m) => sum + m.testsTotal, 0);
  const passingTests = modules.reduce((sum, m) => sum + m.testsPassing, 0);
  const allGreen = modules.every(m => m.status === "GREEN");
  const allFrozen = modules.every(m => m.surfaceFrozen);
  
  return {
    totalModules: modules.length,
    totalTests,
    passingTests,
    allGreen,
    allFrozen,
    releaseTag: "v1.0-replacement-ready",
    releasedAt: NOW,
    decisions: {
      total: DECISIONS.length,
      allowed: DECISIONS.filter(d => d.outcome === "ALLOW").length,
      reviewed: DECISIONS.filter(d => d.outcome === "REVIEW").length,
      declined: DECISIONS.filter(d => d.outcome === "DECLINE").length,
    },
  };
}
