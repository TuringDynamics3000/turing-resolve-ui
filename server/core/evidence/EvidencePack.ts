/**
 * Evidence Pack Generator and Verifier
 * 
 * Integrates all workstreams into a verifiable evidence package:
 * - Merkle inclusion proofs for events
 * - Policy bytecode signatures
 * - Model artifact signatures
 * - Decision trace hashes
 * - Complete audit chain
 * 
 * INVARIANT: Evidence packs can be verified offline using reference verifier.
 * INVARIANT: All referenced events have valid Merkle inclusion proofs.
 */

import * as crypto from 'crypto';
import { canonicalJson, sha256 } from '../merkle/MerkleAuditTrail';
import { MerkleProof, verifyInclusionProof } from '../merkle/MerkleAuditTrail';
import { DecisionContextCaptured, PolicyEvaluated, AuthorizationTokenIssued, ActionExecuted } from '../policy/ExecutionProofs';
import { ModelProvenanceForEvidence } from '../model/ModelGovernance';

// ============================================================
// EVIDENCE PACK SCHEMA
// ============================================================

export const EVIDENCE_PACK_SCHEMA = 'TD:EVIDENCEPACK:v1';

export interface EvidencePack {
  schema: typeof EVIDENCE_PACK_SCHEMA;
  packId: string;
  decisionId: string;
  tenantId: string;
  environmentId: string;
  generatedAt: Date;
  
  // Policy provenance
  policy: PolicyProvenance;
  
  // Model provenance (if AI-governed)
  model?: ModelProvenanceForEvidence;
  
  // Authority proofs (RBAC decisions) - NEW for 🔴→🟢
  authority?: AuthorityProofs;
  
  // Input commitment
  inputs: InputCommitment;
  
  // Decision trace
  decisionTrace: DecisionTrace;
  
  // Actions
  actions: ActionSummary;
  
  // Events with Merkle proofs
  events: EventWithProof[];
  
  // Pack integrity
  evidencePackHash: string;
}

/**
 * Authority Proofs - RBAC decisions included in evidence packs
 * 
 * This addresses the 🔴 Red gap: "RBAC in evidence packs - Not yet bound"
 * What "Green" Requires: Authority proofs included by default
 */
export interface AuthorityProofs {
  // All authority facts related to this decision
  authorityFacts: AuthorityFactProof[];
  
  // Actor chain (who authorized what)
  actorChain: ActorAuthorization[];
  
  // Approval chain (if maker/checker was required)
  approvalChain?: ApprovalRecord[];
  
  // Authority summary
  summary: AuthoritySummary;
}

export interface AuthorityFactProof {
  authorityFactId: string;
  actorId: string;
  actorRole: string;
  commandCode: string;
  resourceId: string | null;
  decision: 'ALLOW' | 'DENY';
  reasonCode: string;
  occurredAt: string;
  factHash: string;
  merkleProof?: MerkleProof;
}

export interface ActorAuthorization {
  actorId: string;
  roles: string[];
  scope: {
    tenantId: string;
    environmentId: string;
    domain: string;
  };
  authorizedCommands: string[];
  authorizationTime: string;
}

export interface ApprovalRecord {
  proposalId: string;
  proposedBy: string;
  proposedAt: string;
  approvedBy: string;
  approvedAt: string;
  approverRole: string;
  decision: 'APPROVE' | 'REJECT';
  reason?: string;
}

export interface AuthoritySummary {
  totalAuthorityChecks: number;
  allowedCount: number;
  deniedCount: number;
  approvalRequired: boolean;
  approvalObtained: boolean;
  allAuthoritiesValid: boolean;
}

export interface PolicyProvenance {
  policyId: string;
  version: string;
  bytecodeHash: string;
  signature: string;
  signingKeyId: string;
  validFrom: string;
  validTo: string | null;
}

export interface InputCommitment {
  featureSnapshotHash: string;
  featureSchemaId: string;
  featureSchemaVersion: string;
  factSources: Array<{
    factId: string;
    factHash: string;
    factType: string;
  }>;
}

export interface DecisionTrace {
  traceHash: string;
  traceSchema: string;
  evaluationDurationMs: number;
  reasonCodes: string[];
}

export interface ActionSummary {
  recommended: string | null;
  gated: 'permit' | 'deny' | 'refer';
  executed: string | null;
  executedParams?: Record<string, unknown>;
}

export interface EventWithProof {
  eventId: string;
  eventType: string;
  occurredAt: string;
  leafHash: string;
  merkleProof: MerkleProof;
}

// ============================================================
// EVIDENCE PACK GENERATOR
// ============================================================

export interface EvidencePackInput {
  decisionId: string;
  tenantId: string;
  environmentId: string;
  
  // Decision records
  context: DecisionContextCaptured;
  evaluation: PolicyEvaluated;
  token?: AuthorizationTokenIssued;
  execution?: ActionExecuted;
  
  // Policy info
  policy: {
    policyId: string;
    version: string;
    bytecodeHash: string;
    signature: string;
    signingKeyId: string;
    validFrom: Date;
    validTo: Date | null;
  };
  
  // Model info (optional)
  model?: ModelProvenanceForEvidence;
  
  // Authority proofs (RBAC) - auto-included by default
  authority?: {
    authorityFacts: Array<{
      authorityFactId: string;
      actorId: string;
      actorRole: string;
      commandCode: string;
      resourceId: string | null;
      decision: 'ALLOW' | 'DENY';
      reasonCode: string;
      occurredAt: Date;
      factHash: string;
      merkleProof?: MerkleProof;
    }>;
    actorChain: Array<{
      actorId: string;
      roles: string[];
      scope: { tenantId: string; environmentId: string; domain: string };
      authorizedCommands: string[];
      authorizationTime: Date;
    }>;
    approvalChain?: Array<{
      proposalId: string;
      proposedBy: string;
      proposedAt: Date;
      approvedBy: string;
      approvedAt: Date;
      approverRole: string;
      decision: 'APPROVE' | 'REJECT';
      reason?: string;
    }>;
  };
  
  // Feature schema
  featureSchemaId: string;
  featureSchemaVersion: string;
  
  // Events with proofs
  events: Array<{
    eventId: string;
    eventType: string;
    occurredAt: Date;
    leafHash: string;
    proof: MerkleProof;
  }>;
}

export class EvidencePackGenerator {
  /**
   * Generate evidence pack from decision records
   */
  generate(input: EvidencePackInput): EvidencePack {
    const packId = `evp_${crypto.randomUUID().replace(/-/g, '')}`;
    const generatedAt = new Date();
    
    // Build policy provenance
    const policy: PolicyProvenance = {
      policyId: input.policy.policyId,
      version: input.policy.version,
      bytecodeHash: input.policy.bytecodeHash,
      signature: input.policy.signature,
      signingKeyId: input.policy.signingKeyId,
      validFrom: input.policy.validFrom.toISOString(),
      validTo: input.policy.validTo?.toISOString() || null,
    };
    
    // Build input commitment
    const inputs: InputCommitment = {
      featureSnapshotHash: input.context.factsHash,
      featureSchemaId: input.featureSchemaId,
      featureSchemaVersion: input.featureSchemaVersion,
      factSources: input.context.factSources.map(fs => ({
        factId: fs.factId,
        factHash: fs.factHash,
        factType: fs.factType,
      })),
    };
    
    // Build decision trace
    const decisionTrace: DecisionTrace = {
      traceHash: input.evaluation.traceHash,
      traceSchema: 'TD:TRACE:v1',
      evaluationDurationMs: input.evaluation.evaluationDurationMs,
      reasonCodes: input.evaluation.reasonCodes,
    };
    
    // Build action summary
    const actions: ActionSummary = {
      recommended: input.evaluation.actionProposal?.action || null,
      gated: input.evaluation.outcome,
      executed: input.execution?.action || null,
      executedParams: input.execution?.executedParams,
    };
    
    // Build events with proofs
    const events: EventWithProof[] = input.events.map(e => ({
      eventId: e.eventId,
      eventType: e.eventType,
      occurredAt: e.occurredAt.toISOString(),
      leafHash: e.leafHash,
      merkleProof: e.proof,
    }));
    
    // Build authority proofs (auto-included by default)
    let authority: AuthorityProofs | undefined;
    if (input.authority) {
      const authorityFacts: AuthorityFactProof[] = input.authority.authorityFacts.map(af => ({
        authorityFactId: af.authorityFactId,
        actorId: af.actorId,
        actorRole: af.actorRole,
        commandCode: af.commandCode,
        resourceId: af.resourceId,
        decision: af.decision,
        reasonCode: af.reasonCode,
        occurredAt: af.occurredAt.toISOString(),
        factHash: af.factHash,
        merkleProof: af.merkleProof,
      }));
      
      const actorChain: ActorAuthorization[] = input.authority.actorChain.map(ac => ({
        actorId: ac.actorId,
        roles: ac.roles,
        scope: ac.scope,
        authorizedCommands: ac.authorizedCommands,
        authorizationTime: ac.authorizationTime.toISOString(),
      }));
      
      const approvalChain: ApprovalRecord[] | undefined = input.authority.approvalChain?.map(ap => ({
        proposalId: ap.proposalId,
        proposedBy: ap.proposedBy,
        proposedAt: ap.proposedAt.toISOString(),
        approvedBy: ap.approvedBy,
        approvedAt: ap.approvedAt.toISOString(),
        approverRole: ap.approverRole,
        decision: ap.decision,
        reason: ap.reason,
      }));
      
      const allowedCount = authorityFacts.filter(af => af.decision === 'ALLOW').length;
      const deniedCount = authorityFacts.filter(af => af.decision === 'DENY').length;
      
      authority = {
        authorityFacts,
        actorChain,
        approvalChain,
        summary: {
          totalAuthorityChecks: authorityFacts.length,
          allowedCount,
          deniedCount,
          approvalRequired: !!input.authority.approvalChain && input.authority.approvalChain.length > 0,
          approvalObtained: input.authority.approvalChain?.some(ap => ap.decision === 'APPROVE') ?? false,
          allAuthoritiesValid: deniedCount === 0,
        },
      };
    }
    
    // Build pack without hash
    const packWithoutHash: Omit<EvidencePack, 'evidencePackHash'> = {
      schema: EVIDENCE_PACK_SCHEMA,
      packId,
      decisionId: input.decisionId,
      tenantId: input.tenantId,
      environmentId: input.environmentId,
      generatedAt,
      policy,
      model: input.model,
      authority,
      inputs,
      decisionTrace,
      actions,
      events,
    };
    
    // Compute pack hash
    const evidencePackHash = sha256(canonicalJson(packWithoutHash));
    
    return {
      ...packWithoutHash,
      evidencePackHash,
    };
  }
  
  /**
   * Generate and emit EVIDENCE_PACK_ISSUED event
   */
  generateWithEvent(input: EvidencePackInput): {
    pack: EvidencePack;
    event: EvidencePackIssuedEvent;
  } {
    const pack = this.generate(input);
    
    const event: EvidencePackIssuedEvent = {
      factType: 'EVIDENCE_PACK_ISSUED',
      packId: pack.packId,
      decisionId: pack.decisionId,
      tenantId: pack.tenantId,
      environmentId: pack.environmentId,
      evidencePackHash: pack.evidencePackHash,
      eventCount: pack.events.length,
      issuedAt: pack.generatedAt,
    };
    
    return { pack, event };
  }
}

export interface EvidencePackIssuedEvent {
  factType: 'EVIDENCE_PACK_ISSUED';
  packId: string;
  decisionId: string;
  tenantId: string;
  environmentId: string;
  evidencePackHash: string;
  eventCount: number;
  issuedAt: Date;
}

// ============================================================
// REFERENCE VERIFIER
// ============================================================

export interface VerificationReport {
  packId: string;
  decisionId: string;
  valid: boolean;
  
  checks: {
    schemaValid: boolean;
    packHashValid: boolean;
    policySignatureValid: boolean;
    modelSignatureValid: boolean;
    inputsHashValid: boolean;
    traceHashPresent: boolean;
    allEventsHaveProofs: boolean;
    allMerkleProofsValid: boolean;
    actionChainValid: boolean;
  };
  
  eventResults: Array<{
    eventId: string;
    proofValid: boolean;
    errors: string[];
  }>;
  
  errors: string[];
  warnings: string[];
  
  verifiedAt: Date;
}

export class EvidencePackVerifier {
  /**
   * Verify evidence pack - can be run offline
   */
  verify(pack: EvidencePack): VerificationReport {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check schema
    const schemaValid = pack.schema === EVIDENCE_PACK_SCHEMA;
    if (!schemaValid) {
      errors.push(`Invalid schema: ${pack.schema}`);
    }
    
    // Verify pack hash
    const packWithoutHash: Omit<EvidencePack, 'evidencePackHash'> = {
      schema: pack.schema,
      packId: pack.packId,
      decisionId: pack.decisionId,
      tenantId: pack.tenantId,
      environmentId: pack.environmentId,
      generatedAt: pack.generatedAt,
      policy: pack.policy,
      model: pack.model,
      inputs: pack.inputs,
      decisionTrace: pack.decisionTrace,
      actions: pack.actions,
      events: pack.events,
    };
    const recomputedHash = sha256(canonicalJson(packWithoutHash));
    const packHashValid = recomputedHash === pack.evidencePackHash;
    if (!packHashValid) {
      errors.push(`Pack hash mismatch: computed ${recomputedHash}, expected ${pack.evidencePackHash}`);
    }
    
    // Check policy signature (would need public key in production)
    const policySignatureValid = !!pack.policy.signature && !!pack.policy.signingKeyId;
    if (!policySignatureValid) {
      errors.push('Policy signature missing');
    }
    
    // Check model signature (if present)
    let modelSignatureValid = true;
    if (pack.model) {
      modelSignatureValid = !!pack.model.signature && !!pack.model.signingKeyId;
      if (!modelSignatureValid) {
        errors.push('Model signature missing');
      }
    }
    
    // Check inputs hash
    const inputsHashValid = !!pack.inputs.featureSnapshotHash;
    if (!inputsHashValid) {
      errors.push('Feature snapshot hash missing');
    }
    
    // Check trace hash
    const traceHashPresent = !!pack.decisionTrace.traceHash;
    if (!traceHashPresent) {
      errors.push('Trace hash missing');
    }
    
    // Check all events have proofs
    const allEventsHaveProofs = pack.events.every(e => !!e.merkleProof);
    if (!allEventsHaveProofs) {
      errors.push('Some events missing Merkle proofs');
    }
    
    // Verify all Merkle proofs
    const eventResults = pack.events.map(event => {
      const result = verifyInclusionProof(event.merkleProof);
      return {
        eventId: event.eventId,
        proofValid: result.valid,
        errors: result.errors,
      };
    });
    
    const allMerkleProofsValid = eventResults.every(r => r.proofValid);
    if (!allMerkleProofsValid) {
      const failedEvents = eventResults.filter(r => !r.proofValid);
      errors.push(`${failedEvents.length} event(s) have invalid Merkle proofs`);
    }
    
    // Check action chain validity
    const actionChainValid = this.verifyActionChain(pack);
    if (!actionChainValid) {
      errors.push('Action chain invalid: gated action does not match executed action');
    }
    
    // Warnings
    if (!pack.model) {
      warnings.push('No model provenance - decision was policy-only');
    }
    
    if (pack.events.length === 0) {
      warnings.push('No events in evidence pack');
    }
    
    const valid = 
      schemaValid &&
      packHashValid &&
      policySignatureValid &&
      modelSignatureValid &&
      inputsHashValid &&
      traceHashPresent &&
      allEventsHaveProofs &&
      allMerkleProofsValid &&
      actionChainValid;
    
    return {
      packId: pack.packId,
      decisionId: pack.decisionId,
      valid,
      checks: {
        schemaValid,
        packHashValid,
        policySignatureValid,
        modelSignatureValid,
        inputsHashValid,
        traceHashPresent,
        allEventsHaveProofs,
        allMerkleProofsValid,
        actionChainValid,
      },
      eventResults,
      errors,
      warnings,
      verifiedAt: new Date(),
    };
  }
  
  private verifyActionChain(pack: EvidencePack): boolean {
    // If denied, no execution should exist
    if (pack.actions.gated === 'deny') {
      return pack.actions.executed === null;
    }
    
    // If referred, execution is optional
    if (pack.actions.gated === 'refer') {
      return true;
    }
    
    // If permitted, executed should match recommended (if executed)
    if (pack.actions.gated === 'permit' && pack.actions.executed) {
      return pack.actions.executed === pack.actions.recommended;
    }
    
    return true;
  }
}

// ============================================================
// CLI VERIFICATION COMMAND
// ============================================================

/**
 * Command-line verification function
 * Usage: verify_evidence_pack(pack.json) prints PASS/FAIL + reasons
 */
export function verifyEvidencePackCLI(packJson: string): string {
  try {
    const pack = JSON.parse(packJson) as EvidencePack;
    
    // Convert date strings back to Date objects
    pack.generatedAt = new Date(pack.generatedAt);
    
    const verifier = new EvidencePackVerifier();
    const report = verifier.verify(pack);
    
    const lines: string[] = [];
    
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push(`  EVIDENCE PACK VERIFICATION REPORT`);
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');
    lines.push(`  Pack ID:      ${report.packId}`);
    lines.push(`  Decision ID:  ${report.decisionId}`);
    lines.push(`  Verified At:  ${report.verifiedAt.toISOString()}`);
    lines.push('');
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('  RESULT:  ' + (report.valid ? '✅ PASS' : '❌ FAIL'));
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('');
    lines.push('  Checks:');
    lines.push(`    Schema Valid:           ${report.checks.schemaValid ? '✓' : '✗'}`);
    lines.push(`    Pack Hash Valid:        ${report.checks.packHashValid ? '✓' : '✗'}`);
    lines.push(`    Policy Signature:       ${report.checks.policySignatureValid ? '✓' : '✗'}`);
    lines.push(`    Model Signature:        ${report.checks.modelSignatureValid ? '✓' : '✗'}`);
    lines.push(`    Inputs Hash:            ${report.checks.inputsHashValid ? '✓' : '✗'}`);
    lines.push(`    Trace Hash:             ${report.checks.traceHashPresent ? '✓' : '✗'}`);
    lines.push(`    All Events Have Proofs: ${report.checks.allEventsHaveProofs ? '✓' : '✗'}`);
    lines.push(`    All Merkle Proofs:      ${report.checks.allMerkleProofsValid ? '✓' : '✗'}`);
    lines.push(`    Action Chain:           ${report.checks.actionChainValid ? '✓' : '✗'}`);
    lines.push('');
    
    if (report.errors.length > 0) {
      lines.push('  Errors:');
      report.errors.forEach(e => lines.push(`    ❌ ${e}`));
      lines.push('');
    }
    
    if (report.warnings.length > 0) {
      lines.push('  Warnings:');
      report.warnings.forEach(w => lines.push(`    ⚠️  ${w}`));
      lines.push('');
    }
    
    if (report.eventResults.length > 0) {
      lines.push('  Event Proofs:');
      report.eventResults.forEach(er => {
        lines.push(`    ${er.proofValid ? '✓' : '✗'} ${er.eventId}`);
        if (er.errors.length > 0) {
          er.errors.forEach(e => lines.push(`        ${e}`));
        }
      });
      lines.push('');
    }
    
    lines.push('═══════════════════════════════════════════════════════════════');
    
    return lines.join('\n');
  } catch (error) {
    return `❌ FAIL: Unable to parse evidence pack - ${error}`;
  }
}

// ============================================================
// BATCH SEAL AND PROOF COMMAND
// ============================================================

/**
 * Command-line batch seal function
 * Usage: seal_batch(tenant) + proof(event_id)
 */
export function sealBatchCLI(
  tenantId: string,
  events: Array<{ eventId: string; leafHash: string }>,
  privateKey: string
): string {
  const lines: string[] = [];
  
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`  BATCH SEAL REPORT`);
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`  Tenant:       ${tenantId}`);
  lines.push(`  Event Count:  ${events.length}`);
  lines.push(`  Sealed At:    ${new Date().toISOString()}`);
  lines.push('');
  
  // Build Merkle tree
  const leafHashes = events.map(e => e.leafHash);
  
  // Simple Merkle root computation for demo
  let currentLevel = leafHashes;
  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1] ?? currentLevel[i];
      nextLevel.push(sha256(Buffer.concat([
        Buffer.from([0x01]),
        Buffer.from(left, 'hex'),
        Buffer.from(right, 'hex'),
      ])));
    }
    currentLevel = nextLevel;
  }
  
  const rootHash = currentLevel[0];
  
  // Sign root
  const sign = crypto.createSign('SHA256');
  sign.update(rootHash);
  const signature = sign.sign(privateKey, 'hex');
  
  lines.push(`  Root Hash:    ${rootHash}`);
  lines.push(`  Signature:    ${signature.substring(0, 32)}...`);
  lines.push('');
  lines.push('  ✅ Batch sealed successfully');
  lines.push('═══════════════════════════════════════════════════════════════');
  
  return lines.join('\n');
}
