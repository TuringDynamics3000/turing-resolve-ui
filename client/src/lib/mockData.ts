import { addDays, subDays, subHours, subMinutes } from "date-fns";

export type DecisionOutcome = "APPROVED" | "REJECTED" | "FLAGGED_FOR_REVIEW";

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: 'TRIGGER' | 'POLICY_EVALUATION' | 'LEDGER_READ' | 'DECISION_FINALIZED';
  description: string;
  details?: any;
}

export interface ExplanationNode {
  level: number;
  title: string;
  content: string;
  evidence: Record<string, any>;
  children: ExplanationNode[];
}

export interface Decision {
  decision_id: string;
  entity_id: string;
  timestamp: string;
  outcome: DecisionOutcome;
  summary: string;
  risk_score: number;
  policy_version: string;
  facts: Record<string, any>;
  explanation_tree: ExplanationNode[];
  timeline: TimelineEvent[];
}

const now = new Date();

export interface Policy {
  id: string;
  version: string;
  name: string;
  status: 'ACTIVE' | 'DEPRECATED' | 'DRAFT';
  description: string;
  rules: {
    id: string;
    name: string;
    logic: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  }[];
  last_updated: string;
  author: string;
}

export const mockPolicies: Policy[] = [
  {
    id: "POL-AML-001",
    version: "v2.1.0",
    name: "Global AML Screening",
    status: "ACTIVE",
    description: "Standard screening against OFAC, UN, and EU sanctions lists.",
    last_updated: "2024-12-10T10:00:00Z",
    author: "Compliance Team",
    rules: [
      {
        id: "R-001",
        name: "Sanctions List Match",
        logic: "IF entity.name MATCHES sanctions_list THEN REJECT",
        severity: "CRITICAL"
      },
      {
        id: "R-002",
        name: "High Risk Jurisdiction",
        logic: "IF entity.country IN high_risk_countries THEN FLAG",
        severity: "HIGH"
      }
    ]
  },
  {
    id: "POL-TX-LIMITS",
    version: "v1.5.0",
    name: "Transaction Velocity & Limits",
    status: "ACTIVE",
    description: "Controls for transaction amounts and frequency.",
    last_updated: "2024-11-15T14:30:00Z",
    author: "Risk Ops",
    rules: [
      {
        id: "R-101",
        name: "High Value Check",
        logic: "IF amount > 50000 THEN FLAG",
        severity: "MEDIUM"
      },
      {
        id: "R-102",
        name: "Velocity Check",
        logic: "IF count(tx_last_24h) > 10 THEN FLAG",
        severity: "HIGH"
      }
    ]
  }
];

export const mockDecisions: Decision[] = [
  {
    decision_id: "DEC-2024-001",
    entity_id: "TX-9982-X",
    timestamp: subMinutes(now, 15).toISOString(),
    outcome: "FLAGGED_FOR_REVIEW",
    summary: "High-value transaction > $50k from new device",
    risk_score: 85,
    policy_version: "v2.1.0",
    facts: {
      amount: 52000.00,
      currency: "USD",
      device_id: "dev_new_123",
      previous_device_id: "dev_old_456",
      account_age_days: 45
    },
    timeline: [
      {
        id: "evt_1",
        timestamp: subMinutes(now, 15).toISOString(),
        type: "TRIGGER",
        description: "Transaction Initiated",
        details: { amount: 52000, currency: "USD" }
      },
      {
        id: "evt_2",
        timestamp: subMinutes(now, 15).toISOString(),
        type: "LEDGER_READ",
        description: "Hydrated Account Projection",
        details: { balance: 150000, status: "ACTIVE" }
      },
      {
        id: "evt_3",
        timestamp: subMinutes(now, 15).toISOString(),
        type: "POLICY_EVALUATION",
        description: "Rule: High Value Check",
        details: { result: "FAIL", threshold: 50000 }
      },
      {
        id: "evt_4",
        timestamp: subMinutes(now, 15).toISOString(),
        type: "DECISION_FINALIZED",
        description: "Decision: FLAGGED_FOR_REVIEW"
      }
    ],
    explanation_tree: [
      {
        level: 1,
        title: "Policy Evaluation",
        content: "Evaluated 3 policy rules.",
        evidence: {},
        children: [
          {
            level: 2,
            title: "✓ PASSED: balance_check",
            content: "Balance sufficient for transaction.",
            evidence: { balance: 150000, amount: 52000 },
            children: []
          },
          {
            level: 2,
            title: "! WARNING: high_value_check",
            content: "Transaction exceeds auto-approval limit.",
            evidence: { limit: 50000, amount: 52000 },
            children: []
          }
        ]
      }
    ]
  },
  {
    decision_id: "DEC-2024-002",
    entity_id: "KYC-USER-77",
    timestamp: subHours(now, 2).toISOString(),
    outcome: "REJECTED",
    summary: "Sanctions list match (fuzzy score 92%)",
    risk_score: 99,
    policy_version: "v2.0.5",
    facts: {
      name: "Robert M. Badactor",
      match_source: "OFAC_SDN",
      match_score: 0.92
    },
    timeline: [],
    explanation_tree: [
      {
        level: 1,
        title: "Policy Evaluation",
        content: "Evaluated 3 policy rules.",
        evidence: {},
        children: [
          {
            level: 2,
            title: "✗ FAILED: aml_screening",
            content: "High-risk jurisdiction detected.",
            evidence: { country: "North Korea", risk_score: 95 },
            children: []
          }
        ]
      }
    ]
  },
  {
    decision_id: "DEC-2024-003",
    entity_id: "TX-1002-A",
    timestamp: subHours(now, 5).toISOString(),
    outcome: "APPROVED",
    summary: "Standard payroll transfer",
    risk_score: 5,
    policy_version: "v2.1.0",
    facts: {
      amount: 2500.00,
      type: "ACH_CREDIT"
    },
    timeline: [],
    explanation_tree: [
      {
        level: 1,
        title: "Policy Evaluation",
        content: "Evaluated 3 policy rules.",
        evidence: {},
        children: [
          {
            level: 2,
            title: "✓ PASSED: balance_check",
            content: "Balance sufficient.",
            evidence: {},
            children: []
          }
        ]
      }
    ]
  }
];
