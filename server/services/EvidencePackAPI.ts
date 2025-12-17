/**
 * Evidence Pack API Service
 * 
 * Generates evidence packs on demand for auditor verification.
 * Each pack contains:
 * - Policy information with signature
 * - Model provenance (if applicable)
 * - Decision inputs and trace
 * - Events with Merkle inclusion proofs
 * - Pack hash for integrity verification
 */

import { createHash, randomUUID } from 'crypto';
import { getGovernedEventService, type GovernedEvent } from './GovernedEventService';

// ============================================================
// TYPES
// ============================================================

export interface EvidencePackRequest {
  decisionId: string;
  includeEvents?: boolean;
  includeProofs?: boolean;
}

export interface PolicyInfo {
  policyId: string;
  version: string;
  bytecodeHash: string;
  signature: string;
  keyId: string;
}

export interface ModelInfo {
  modelId: string;
  version: string;
  artifactHash: string;
  signature: string;
  keyId: string;
  domainType: string;
  status: string;
}

export interface DecisionTrace {
  evaluatedAt: string;
  outcome: 'ALLOW' | 'REVIEW' | 'DECLINE';
  policyHash: string;
  factsHash: string;
  traceHash: string;
  constraints: Array<{
    name: string;
    result: boolean;
    reason?: string;
  }>;
}

export interface EventProof {
  eventId: string;
  eventType: string;
  occurredAt: string;
  leafHash: string;
  inclusionProof?: {
    batchId: string;
    leafIndex: number;
    siblings: string[];
    rootHash: string;
    rootSignature: string;
  };
}

export interface EvidencePack {
  schema: string;
  packId: string;
  decisionId: string;
  tenantId: string;
  environmentId: string;
  generatedAt: string;
  
  policy: PolicyInfo;
  model?: ModelInfo;
  
  inputs: Record<string, unknown>;
  decisionTrace: DecisionTrace;
  actions: Record<string, unknown>;
  
  events: EventProof[];
  
  evidencePackHash: string;
}

// ============================================================
// HASH UTILITIES
// ============================================================

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function canonicalJson(obj: unknown): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const sorted = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = sorted.map(k => `"${k}":${canonicalJson((obj as Record<string, unknown>)[k])}`);
  return '{' + pairs.join(',') + '}';
}

function computePackHash(pack: Omit<EvidencePack, 'evidencePackHash'>): string {
  return sha256(canonicalJson(pack));
}

// ============================================================
// MOCK DATA (In production, fetch from DB)
// ============================================================

// Mock policy registry
const mockPolicies: Record<string, PolicyInfo> = {
  'payments.authorize.v1': {
    policyId: 'payments.authorize.v1',
    version: '1.0.0',
    bytecodeHash: sha256('policy:payments.authorize.v1:bytecode'),
    signature: sha256('policy:payments.authorize.v1:signature'),
    keyId: 'k-policy-prod',
  },
  'deposits.transfer.v1': {
    policyId: 'deposits.transfer.v1',
    version: '1.0.0',
    bytecodeHash: sha256('policy:deposits.transfer.v1:bytecode'),
    signature: sha256('policy:deposits.transfer.v1:signature'),
    keyId: 'k-policy-prod',
  },
};

// Mock model registry
const mockModels: Record<string, ModelInfo> = {
  'credit.scoring.v1': {
    modelId: 'credit.scoring.v1',
    version: '2024.12.1',
    artifactHash: sha256('model:credit.scoring.v1:artifact'),
    signature: sha256('model:credit.scoring.v1:signature'),
    keyId: 'k-model-prod',
    domainType: 'CREDIT',
    status: 'PRODUCTION',
  },
};

// Mock decisions (in production, fetch from turing_resolve.decision_records)
const mockDecisions: Record<string, {
  decisionId: string;
  policyId: string;
  modelId?: string;
  outcome: 'ALLOW' | 'REVIEW' | 'DECLINE';
  inputs: Record<string, unknown>;
  streamId: string;
  streamType: string;
  evaluatedAt: Date;
}> = {};

// ============================================================
// EVIDENCE PACK GENERATOR
// ============================================================

export class EvidencePackGenerator {
  private tenantId: string;
  private environmentId: string;
  
  constructor(tenantId?: string, environmentId?: string) {
    this.tenantId = tenantId || process.env.TENANT_ID || 'default';
    this.environmentId = environmentId || process.env.ENVIRONMENT_ID || 'development';
  }
  
  /**
   * Generate an evidence pack for a decision.
   */
  async generatePack(request: EvidencePackRequest): Promise<EvidencePack> {
    const { decisionId, includeEvents = true, includeProofs = true } = request;
    
    // Look up decision (mock for now)
    const decision = mockDecisions[decisionId] || this.createMockDecision(decisionId);
    
    // Get policy info
    const policy = mockPolicies[decision.policyId] || mockPolicies['payments.authorize.v1'];
    
    // Get model info (if applicable)
    const model = decision.modelId ? mockModels[decision.modelId] : undefined;
    
    // Build decision trace
    const decisionTrace = this.buildDecisionTrace(decision, policy);
    
    // Get events for this stream
    let events: EventProof[] = [];
    if (includeEvents) {
      events = await this.getEventProofs(decision.streamId, includeProofs);
    }
    
    // Build pack without hash
    const packWithoutHash: Omit<EvidencePack, 'evidencePackHash'> = {
      schema: 'TD:EVIDENCEPACK:v1',
      packId: `evp_${randomUUID()}`,
      decisionId,
      tenantId: this.tenantId,
      environmentId: this.environmentId,
      generatedAt: new Date().toISOString(),
      
      policy,
      model,
      
      inputs: decision.inputs,
      decisionTrace,
      actions: {
        outcome: decision.outcome,
        streamId: decision.streamId,
        streamType: decision.streamType,
      },
      
      events,
    };
    
    // Compute pack hash
    const evidencePackHash = computePackHash(packWithoutHash);
    
    return {
      ...packWithoutHash,
      evidencePackHash,
    };
  }
  
  /**
   * Create a mock decision for demo purposes.
   */
  private createMockDecision(decisionId: string) {
    const decision = {
      decisionId,
      policyId: 'payments.authorize.v1',
      modelId: 'credit.scoring.v1',
      outcome: 'ALLOW' as const,
      inputs: {
        amount: '1000.00',
        currency: 'AUD',
        fromAccount: 'ACC-001',
        toAccount: 'ACC-002',
      },
      streamId: `PAY-${decisionId.slice(-8)}`,
      streamType: 'PAYMENT',
      evaluatedAt: new Date(),
    };
    
    // Cache for future lookups
    mockDecisions[decisionId] = decision;
    
    return decision;
  }
  
  /**
   * Build decision trace from decision and policy.
   */
  private buildDecisionTrace(
    decision: typeof mockDecisions[string],
    policy: PolicyInfo
  ): DecisionTrace {
    const factsHash = sha256(canonicalJson(decision.inputs));
    const traceHash = sha256(`${policy.bytecodeHash}:${factsHash}:${decision.outcome}`);
    
    return {
      evaluatedAt: decision.evaluatedAt.toISOString(),
      outcome: decision.outcome,
      policyHash: policy.bytecodeHash,
      factsHash,
      traceHash,
      constraints: [
        { name: 'amount_limit', result: true },
        { name: 'account_active', result: true },
        { name: 'sufficient_balance', result: true },
        { name: 'fraud_check', result: true },
      ],
    };
  }
  
  /**
   * Get event proofs for a stream.
   */
  private async getEventProofs(streamId: string, includeProofs: boolean): Promise<EventProof[]> {
    const service = getGovernedEventService();
    const events = await service.getStreamEvents(streamId);
    
    return events.map((event, index) => {
      const proof: EventProof = {
        eventId: event.eventId,
        eventType: event.eventType,
        occurredAt: event.occurredAt.toISOString(),
        leafHash: event.leafHash,
      };
      
      if (includeProofs) {
        // In production, fetch actual proof from merkle_event_index
        proof.inclusionProof = {
          batchId: `batch_${Date.now()}`,
          leafIndex: index,
          siblings: [sha256(`sibling_${index}_0`), sha256(`sibling_${index}_1`)],
          rootHash: sha256(`root_${streamId}`),
          rootSignature: sha256(`root_sig_${streamId}`),
        };
      }
      
      return proof;
    });
  }
  
  /**
   * Verify an evidence pack.
   */
  verifyPack(pack: EvidencePack): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Verify pack hash
    const { evidencePackHash, ...packWithoutHash } = pack;
    const computedHash = computePackHash(packWithoutHash);
    if (computedHash !== evidencePackHash) {
      errors.push('Evidence pack hash mismatch');
    }
    
    // Verify policy signature (mock - in production, verify with public key)
    if (!pack.policy.signature) {
      errors.push('Missing policy signature');
    }
    
    // Verify model signature if present
    if (pack.model && !pack.model.signature) {
      errors.push('Missing model signature');
    }
    
    // Verify event proofs
    for (const event of pack.events) {
      if (event.inclusionProof) {
        // In production, verify Merkle proof
        if (!event.inclusionProof.rootSignature) {
          errors.push(`Missing root signature for event ${event.eventId}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// ============================================================
// SINGLETON
// ============================================================

let generatorInstance: EvidencePackGenerator | null = null;

export function getEvidencePackGenerator(): EvidencePackGenerator {
  if (!generatorInstance) {
    generatorInstance = new EvidencePackGenerator();
  }
  return generatorInstance;
}

// ============================================================
// CONVENIENCE FUNCTIONS
// ============================================================

export async function generateEvidencePack(decisionId: string): Promise<EvidencePack> {
  const generator = getEvidencePackGenerator();
  return generator.generatePack({ decisionId });
}

export function verifyEvidencePack(pack: EvidencePack): { valid: boolean; errors: string[] } {
  const generator = getEvidencePackGenerator();
  return generator.verifyPack(pack);
}
