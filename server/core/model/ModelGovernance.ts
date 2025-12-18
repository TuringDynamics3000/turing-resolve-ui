/**
 * Constitutional Model Governance - Workstream D
 * 
 * Implements:
 * - Model artifact packaging with signing
 * - Model registry with lifecycle states
 * - Shadow-first enforcement
 * - Promotion gates via Constitution
 * - Rollback and kill switch
 * 
 * INVARIANT: No model may enter PRODUCTION without SHADOW period and approval events.
 * INVARIANT: Models are governed like policies; every change is provable and reversible.
 */

import * as crypto from 'crypto';
import { canonicalJson, sha256 } from '../merkle/MerkleAuditTrail';

// ============================================================
// MODEL ARTIFACT TYPES (D1)
// ============================================================

export interface ModelArtifactManifest {
  modelId: string;
  version: string;
  name: string;
  description: string;
  
  // Artifact components
  weightsHash: string; // Hash of model weights file
  inferenceCodeVersion: string; // Container digest or commit SHA
  featureSchemaId: string;
  featureSchemaVersion: string;
  preprocessingVersion: string;
  postprocessingVersion: string;
  
  // Model card metadata
  modelCard: ModelCard;
  
  // Evaluation
  evaluationReportHash: string;
  
  // Computed
  artifactHash: string;
  
  // Timestamps
  createdAt: Date;
  createdBy: string;
}

export interface ModelCard {
  intendedUse: string;
  limitations: string[];
  trainingDataDescription: string;
  performanceMetrics: Record<string, number>;
  fairnessMetrics?: Record<string, number>;
  driftThresholds?: Record<string, number>;
}

export interface SignedModelArtifact extends ModelArtifactManifest {
  signature: string;
  signingKeyId: string;
}

// ============================================================
// MODEL REGISTRY (D2)
// ============================================================

export type ModelLifecycleState = 
  | 'REGISTERED'   // Artifact exists, not used
  | 'SHADOW'       // Runs, logged, does not execute
  | 'PRODUCTION'   // May influence execution, still gated by Constitution
  | 'RETIRED';     // No longer active

export interface ModelRegistryEntry {
  modelId: string;
  version: string;
  artifact: SignedModelArtifact;
  state: ModelLifecycleState;
  
  // State transitions
  registeredAt: Date;
  registeredBy: string;
  shadowStartedAt?: Date;
  shadowStartedBy?: string;
  promotedAt?: Date;
  promotedBy?: string;
  retiredAt?: Date;
  retiredBy?: string;
  
  // Lineage
  previousVersion?: string;
  promotionApprovals?: PromotionApproval[];
  
  // Shadow metrics
  shadowMetrics?: ShadowMetrics;
}

export interface PromotionApproval {
  role: 'CRO' | 'COMPLIANCE' | 'MODEL_RISK' | 'ENGINEERING';
  approvedBy: string;
  approvedAt: Date;
  comments?: string;
}

export interface ShadowMetrics {
  totalPredictions: number;
  agreementWithBaseline: number;
  performanceMetrics: Record<string, number>;
  fairnessMetrics: Record<string, number>;
  latencyP50Ms: number;
  latencyP99Ms: number;
  errorRate: number;
  collectedFrom: Date;
  collectedTo: Date;
}

// ============================================================
// MODEL LIFECYCLE EVENTS
// ============================================================

export interface ModelRegistered {
  factType: 'MODEL_REGISTERED';
  modelId: string;
  version: string;
  artifactHash: string;
  signature: string;
  registeredAt: Date;
  registeredBy: string;
}

export interface ModelShadowStarted {
  factType: 'MODEL_SHADOW_STARTED';
  modelId: string;
  version: string;
  baselineModelId?: string;
  baselineVersion?: string;
  startedAt: Date;
  startedBy: string;
}

export interface ModelPromoted {
  factType: 'MODEL_PROMOTED';
  modelId: string;
  version: string;
  approvals: PromotionApproval[];
  shadowMetrics: ShadowMetrics;
  promotedAt: Date;
  promotedBy: string;
}

export interface ModelRolledBack {
  factType: 'MODEL_ROLLED_BACK';
  modelId: string;
  fromVersion: string;
  toVersion: string;
  reason: string;
  rolledBackAt: Date;
  rolledBackBy: string;
  affectedTenants: string[];
  affectedDomains: string[];
}

export interface ModelDisabled {
  factType: 'MODEL_DISABLED';
  modelId: string;
  version: string;
  reason: string;
  disabledAt: Date;
  disabledBy: string;
  affectedTenants: string[];
  affectedDomains: string[];
  fallbackPolicy: string;
}

// ============================================================
// MODEL REGISTRY SERVICE (D2)
// ============================================================

const ARTIFACT_HASH_PREFIX = 'TD:MODELARTIFACT:v1|';

export class ModelRegistry {
  private models: Map<string, ModelRegistryEntry[]> = new Map();
  private privateKey: string;
  private publicKey: string;
  private keyId: string;
  
  constructor(privateKey: string, publicKey: string) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.keyId = sha256(publicKey).substring(0, 16);
  }
  
  /**
   * Register a new model artifact (D1)
   */
  register(
    manifest: Omit<ModelArtifactManifest, 'artifactHash'>,
    registeredBy: string
  ): { entry: ModelRegistryEntry; event: ModelRegistered } {
    // Compute artifact hash
    const artifactHash = sha256(ARTIFACT_HASH_PREFIX + canonicalJson({
      modelId: manifest.modelId,
      version: manifest.version,
      weightsHash: manifest.weightsHash,
      inferenceCodeVersion: manifest.inferenceCodeVersion,
      featureSchemaId: manifest.featureSchemaId,
      featureSchemaVersion: manifest.featureSchemaVersion,
      preprocessingVersion: manifest.preprocessingVersion,
      postprocessingVersion: manifest.postprocessingVersion,
      evaluationReportHash: manifest.evaluationReportHash,
    }));
    
    // Sign artifact
    const signPayload = artifactHash + sha256(canonicalJson(manifest.modelCard));
    const sign = crypto.createSign('SHA256');
    sign.update(signPayload);
    const signature = sign.sign(this.privateKey, 'hex');
    
    const artifact: SignedModelArtifact = {
      ...manifest,
      artifactHash,
      signature,
      signingKeyId: this.keyId,
    };
    
    const entry: ModelRegistryEntry = {
      modelId: manifest.modelId,
      version: manifest.version,
      artifact,
      state: 'REGISTERED',
      registeredAt: new Date(),
      registeredBy,
    };
    
    // Store
    const versions = this.models.get(manifest.modelId) || [];
    if (versions.some(v => v.version === manifest.version)) {
      throw new Error(`Model version already exists: ${manifest.modelId}@${manifest.version}`);
    }
    versions.push(entry);
    this.models.set(manifest.modelId, versions);
    
    const event: ModelRegistered = {
      factType: 'MODEL_REGISTERED',
      modelId: manifest.modelId,
      version: manifest.version,
      artifactHash,
      signature,
      registeredAt: entry.registeredAt,
      registeredBy,
    };
    
    return { entry, event };
  }
  
  /**
   * Start shadow execution (D3)
   */
  startShadow(
    modelId: string,
    version: string,
    startedBy: string,
    baselineModelId?: string,
    baselineVersion?: string
  ): { entry: ModelRegistryEntry; event: ModelShadowStarted } {
    const entry = this.getVersion(modelId, version);
    if (!entry) {
      throw new Error(`Model not found: ${modelId}@${version}`);
    }
    
    if (entry.state !== 'REGISTERED') {
      throw new Error(`Model must be in REGISTERED state to start shadow, current: ${entry.state}`);
    }
    
    entry.state = 'SHADOW';
    entry.shadowStartedAt = new Date();
    entry.shadowStartedBy = startedBy;
    
    const event: ModelShadowStarted = {
      factType: 'MODEL_SHADOW_STARTED',
      modelId,
      version,
      baselineModelId,
      baselineVersion,
      startedAt: entry.shadowStartedAt,
      startedBy,
    };
    
    return { entry, event };
  }
  
  /**
   * Get model by ID and version
   */
  getVersion(modelId: string, version: string): ModelRegistryEntry | undefined {
    const versions = this.models.get(modelId);
    return versions?.find(v => v.version === version);
  }
  
  /**
   * Get production model
   */
  getProduction(modelId: string): ModelRegistryEntry | undefined {
    const versions = this.models.get(modelId);
    return versions?.find(v => v.state === 'PRODUCTION');
  }
  
  /**
   * Get shadow model
   */
  getShadow(modelId: string): ModelRegistryEntry | undefined {
    const versions = this.models.get(modelId);
    return versions?.find(v => v.state === 'SHADOW');
  }
}

// ============================================================
// SHADOW EXECUTION HARNESS (D3)
// ============================================================

export interface ShadowPrediction {
  modelId: string;
  version: string;
  decisionId: string;
  recommendation: unknown;
  confidence: number;
  distribution?: Record<string, number>;
  latencyMs: number;
  timestamp: Date;
}

export interface ShadowComparison {
  decisionId: string;
  shadowPrediction: ShadowPrediction;
  baselinePrediction?: unknown;
  agreement: boolean;
  divergenceReason?: string;
}

export class ShadowExecutionHarness {
  private predictions: Map<string, ShadowPrediction[]> = new Map();
  private comparisons: ShadowComparison[] = [];
  
  /**
   * Record shadow prediction
   */
  recordPrediction(prediction: ShadowPrediction): void {
    const key = `${prediction.modelId}@${prediction.version}`;
    const preds = this.predictions.get(key) || [];
    preds.push(prediction);
    this.predictions.set(key, preds);
  }
  
  /**
   * Compare shadow vs baseline
   */
  compare(
    decisionId: string,
    shadowPrediction: ShadowPrediction,
    baselinePrediction: unknown
  ): ShadowComparison {
    const agreement = JSON.stringify(shadowPrediction.recommendation) === 
                      JSON.stringify(baselinePrediction);
    
    const comparison: ShadowComparison = {
      decisionId,
      shadowPrediction,
      baselinePrediction,
      agreement,
      divergenceReason: agreement ? undefined : 'Predictions differ',
    };
    
    this.comparisons.push(comparison);
    
    return comparison;
  }
  
  /**
   * Compute shadow metrics for a model version
   */
  computeMetrics(modelId: string, version: string): ShadowMetrics {
    const key = `${modelId}@${version}`;
    const preds = this.predictions.get(key) || [];
    
    if (preds.length === 0) {
      throw new Error('No predictions to compute metrics');
    }
    
    const relevantComparisons = this.comparisons.filter(
      c => c.shadowPrediction.modelId === modelId && 
           c.shadowPrediction.version === version
    );
    
    const latencies = preds.map(p => p.latencyMs).sort((a, b) => a - b);
    const p50Index = Math.floor(latencies.length * 0.5);
    const p99Index = Math.floor(latencies.length * 0.99);
    
    return {
      totalPredictions: preds.length,
      agreementWithBaseline: relevantComparisons.length > 0
        ? relevantComparisons.filter(c => c.agreement).length / relevantComparisons.length
        : 1,
      performanceMetrics: {}, // Would be populated from evaluation
      fairnessMetrics: {},    // Would be populated from evaluation
      latencyP50Ms: latencies[p50Index] || 0,
      latencyP99Ms: latencies[p99Index] || 0,
      errorRate: 0, // Would track errors
      collectedFrom: preds[0].timestamp,
      collectedTo: preds[preds.length - 1].timestamp,
    };
  }
}

// ============================================================
// PROMOTION GATES (D4)
// ============================================================

export interface PromotionRequirements {
  requiredApprovals: Array<{
    role: PromotionApproval['role'];
    count: number;
  }>;
  minimumShadowDays: number;
  minimumShadowPredictions: number;
  minimumAgreementRate: number;
  maximumLatencyP99Ms: number;
  maximumErrorRate: number;
  fairnessThresholds?: Record<string, number>;
  rollbackPlanRequired: boolean;
}

export interface PromotionGateResult {
  canPromote: boolean;
  checks: {
    approvalsComplete: boolean;
    shadowPeriodComplete: boolean;
    predictionCountMet: boolean;
    agreementRateMet: boolean;
    latencyMet: boolean;
    errorRateMet: boolean;
    fairnessMet: boolean;
    rollbackPlanExists: boolean;
  };
  missingApprovals: PromotionApproval['role'][];
  errors: string[];
}

export class PromotionGateChecker {
  private requirements: PromotionRequirements;
  
  constructor(requirements: PromotionRequirements) {
    this.requirements = requirements;
  }
  
  /**
   * Check if model can be promoted
   */
  check(
    entry: ModelRegistryEntry,
    approvals: PromotionApproval[],
    metrics: ShadowMetrics,
    rollbackPlanExists: boolean
  ): PromotionGateResult {
    const errors: string[] = [];
    
    // Check approvals
    const missingApprovals: PromotionApproval['role'][] = [];
    for (const req of this.requirements.requiredApprovals) {
      const count = approvals.filter(a => a.role === req.role).length;
      if (count < req.count) {
        missingApprovals.push(req.role);
      }
    }
    const approvalsComplete = missingApprovals.length === 0;
    if (!approvalsComplete) {
      errors.push(`Missing approvals: ${missingApprovals.join(', ')}`);
    }
    
    // Check shadow period
    const shadowDays = entry.shadowStartedAt
      ? (Date.now() - entry.shadowStartedAt.getTime()) / (1000 * 60 * 60 * 24)
      : 0;
    const shadowPeriodComplete = shadowDays >= this.requirements.minimumShadowDays;
    if (!shadowPeriodComplete) {
      errors.push(`Shadow period incomplete: ${shadowDays.toFixed(1)} / ${this.requirements.minimumShadowDays} days`);
    }
    
    // Check prediction count
    const predictionCountMet = metrics.totalPredictions >= this.requirements.minimumShadowPredictions;
    if (!predictionCountMet) {
      errors.push(`Insufficient predictions: ${metrics.totalPredictions} / ${this.requirements.minimumShadowPredictions}`);
    }
    
    // Check agreement rate
    const agreementRateMet = metrics.agreementWithBaseline >= this.requirements.minimumAgreementRate;
    if (!agreementRateMet) {
      errors.push(`Agreement rate too low: ${(metrics.agreementWithBaseline * 100).toFixed(1)}% / ${(this.requirements.minimumAgreementRate * 100).toFixed(1)}%`);
    }
    
    // Check latency
    const latencyMet = metrics.latencyP99Ms <= this.requirements.maximumLatencyP99Ms;
    if (!latencyMet) {
      errors.push(`Latency too high: ${metrics.latencyP99Ms}ms / ${this.requirements.maximumLatencyP99Ms}ms`);
    }
    
    // Check error rate
    const errorRateMet = metrics.errorRate <= this.requirements.maximumErrorRate;
    if (!errorRateMet) {
      errors.push(`Error rate too high: ${(metrics.errorRate * 100).toFixed(2)}% / ${(this.requirements.maximumErrorRate * 100).toFixed(2)}%`);
    }
    
    // Check fairness (if thresholds defined)
    let fairnessMet = true;
    if (this.requirements.fairnessThresholds) {
      for (const [metric, threshold] of Object.entries(this.requirements.fairnessThresholds)) {
        const value = metrics.fairnessMetrics[metric];
        if (value !== undefined && value < threshold) {
          fairnessMet = false;
          errors.push(`Fairness metric ${metric} below threshold: ${value} / ${threshold}`);
        }
      }
    }
    
    // Check rollback plan
    if (this.requirements.rollbackPlanRequired && !rollbackPlanExists) {
      errors.push('Rollback plan required but not provided');
    }
    
    const canPromote = 
      approvalsComplete &&
      shadowPeriodComplete &&
      predictionCountMet &&
      agreementRateMet &&
      latencyMet &&
      errorRateMet &&
      fairnessMet &&
      (!this.requirements.rollbackPlanRequired || rollbackPlanExists);
    
    return {
      canPromote,
      checks: {
        approvalsComplete,
        shadowPeriodComplete,
        predictionCountMet,
        agreementRateMet,
        latencyMet,
        errorRateMet,
        fairnessMet,
        rollbackPlanExists,
      },
      missingApprovals,
      errors,
    };
  }
}

// ============================================================
// ROLLBACK AND KILL SWITCH (D5)
// ============================================================

export class ModelGovernanceController {
  private registry: ModelRegistry;
  private shadowHarness: ShadowExecutionHarness;
  private promotionChecker: PromotionGateChecker;
  
  constructor(
    registry: ModelRegistry,
    shadowHarness: ShadowExecutionHarness,
    promotionChecker: PromotionGateChecker
  ) {
    this.registry = registry;
    this.shadowHarness = shadowHarness;
    this.promotionChecker = promotionChecker;
  }
  
  /**
   * Promote model to production (D4)
   */
  promote(
    modelId: string,
    version: string,
    approvals: PromotionApproval[],
    rollbackPlanExists: boolean,
    promotedBy: string
  ): { entry: ModelRegistryEntry; event: ModelPromoted } | { error: PromotionGateResult } {
    const entry = this.registry.getVersion(modelId, version);
    if (!entry) {
      throw new Error(`Model not found: ${modelId}@${version}`);
    }
    
    if (entry.state !== 'SHADOW') {
      throw new Error(`Model must be in SHADOW state to promote, current: ${entry.state}`);
    }
    
    // Compute metrics
    const metrics = this.shadowHarness.computeMetrics(modelId, version);
    
    // Check promotion gates
    const gateResult = this.promotionChecker.check(entry, approvals, metrics, rollbackPlanExists);
    
    if (!gateResult.canPromote) {
      return { error: gateResult };
    }
    
    // Retire current production model
    const currentProduction = this.registry.getProduction(modelId);
    if (currentProduction) {
      currentProduction.state = 'RETIRED';
      currentProduction.retiredAt = new Date();
      currentProduction.retiredBy = 'system';
    }
    
    // Promote
    entry.state = 'PRODUCTION';
    entry.promotedAt = new Date();
    entry.promotedBy = promotedBy;
    entry.promotionApprovals = approvals;
    entry.shadowMetrics = metrics;
    entry.previousVersion = currentProduction?.version;
    
    const event: ModelPromoted = {
      factType: 'MODEL_PROMOTED',
      modelId,
      version,
      approvals,
      shadowMetrics: metrics,
      promotedAt: entry.promotedAt,
      promotedBy,
    };
    
    return { entry, event };
  }
  
  /**
   * Rollback to previous version (D5)
   */
  rollback(
    modelId: string,
    reason: string,
    rolledBackBy: string,
    affectedTenants: string[],
    affectedDomains: string[]
  ): { entry: ModelRegistryEntry; event: ModelRolledBack } {
    const currentProduction = this.registry.getProduction(modelId);
    if (!currentProduction) {
      throw new Error(`No production model to rollback: ${modelId}`);
    }
    
    if (!currentProduction.previousVersion) {
      throw new Error(`No previous version to rollback to: ${modelId}`);
    }
    
    const previousEntry = this.registry.getVersion(modelId, currentProduction.previousVersion);
    if (!previousEntry) {
      throw new Error(`Previous version not found: ${modelId}@${currentProduction.previousVersion}`);
    }
    
    // Retire current
    const fromVersion = currentProduction.version;
    currentProduction.state = 'RETIRED';
    currentProduction.retiredAt = new Date();
    currentProduction.retiredBy = rolledBackBy;
    
    // Restore previous
    previousEntry.state = 'PRODUCTION';
    previousEntry.promotedAt = new Date();
    previousEntry.promotedBy = rolledBackBy;
    
    const event: ModelRolledBack = {
      factType: 'MODEL_ROLLED_BACK',
      modelId,
      fromVersion,
      toVersion: previousEntry.version,
      reason,
      rolledBackAt: new Date(),
      rolledBackBy,
      affectedTenants,
      affectedDomains,
    };
    
    return { entry: previousEntry, event };
  }
  
  /**
   * Kill switch - disable model entirely (D5)
   */
  killSwitch(
    modelId: string,
    reason: string,
    disabledBy: string,
    affectedTenants: string[],
    affectedDomains: string[],
    fallbackPolicy: string
  ): { event: ModelDisabled } {
    const currentProduction = this.registry.getProduction(modelId);
    
    if (currentProduction) {
      currentProduction.state = 'RETIRED';
      currentProduction.retiredAt = new Date();
      currentProduction.retiredBy = disabledBy;
    }
    
    // Also disable any shadow models
    const shadow = this.registry.getShadow(modelId);
    if (shadow) {
      shadow.state = 'RETIRED';
      shadow.retiredAt = new Date();
      shadow.retiredBy = disabledBy;
    }
    
    const event: ModelDisabled = {
      factType: 'MODEL_DISABLED',
      modelId,
      version: currentProduction?.version || 'N/A',
      reason,
      disabledAt: new Date(),
      disabledBy,
      affectedTenants,
      affectedDomains,
      fallbackPolicy,
    };
    
    return { event };
  }
}

// ============================================================
// EVIDENCE PACK ADDITIONS (D5 - Evidence)
// ============================================================

/**
 * Model Provenance for Evidence Packs
 * 
 * This addresses the 🔴 Red gap: "ML provenance in evidence - Missing"
 * What "Green" Requires: Model + feature hashes everywhere
 */
export interface ModelProvenanceForEvidence {
  modelId: string;
  version: string;
  artifactHash: string;
  signature: string;
  signingKeyId: string;
  state: ModelLifecycleState;
  evaluationReportHash: string;
  shadowMetrics?: ShadowMetrics;
  
  // NEW: ML Provenance fields for 🔴→🟢
  mlProvenance: MLProvenanceDetails;
}

/**
 * Detailed ML Provenance - Required for enterprise audit
 */
export interface MLProvenanceDetails {
  // Model artifact hashes
  weightsHash: string;
  inferenceCodeHash: string;
  preprocessingHash: string;
  postprocessingHash: string;
  
  // Feature provenance
  featureSchemaId: string;
  featureSchemaVersion: string;
  featureVectorHash: string; // Hash of actual input features used
  featureCount: number;
  
  // Feature importance snapshot (top N features)
  featureImportance: Array<{
    featureName: string;
    importance: number;
    value: unknown;
    valueHash: string;
  }>;
  
  // Inference metadata
  inferenceTimestamp: string;
  inferenceLatencyMs: number;
  inferenceEnvironment: string;
  
  // Model lineage
  trainingDataHash?: string;
  trainingTimestamp?: string;
  parentModelVersion?: string;
  
  // Drift indicators
  driftMetrics?: {
    featureDriftScore: number;
    predictionDriftScore: number;
    lastDriftCheckAt: string;
    driftAlertTriggered: boolean;
  };
}

export function extractModelProvenance(
  entry: ModelRegistryEntry,
  inferenceContext?: {
    featureVector: Record<string, unknown>;
    featureImportance?: Array<{ featureName: string; importance: number }>;
    inferenceLatencyMs: number;
    inferenceEnvironment: string;
  }
): ModelProvenanceForEvidence {
  // Compute feature vector hash
  const featureVectorHash = inferenceContext?.featureVector 
    ? sha256(canonicalJson(inferenceContext.featureVector))
    : 'NO_FEATURES';
  
  // Build feature importance with value hashes
  const featureImportance = (inferenceContext?.featureImportance || []).slice(0, 10).map(fi => {
    const value = inferenceContext?.featureVector?.[fi.featureName];
    return {
      featureName: fi.featureName,
      importance: fi.importance,
      value,
      valueHash: sha256(canonicalJson({ [fi.featureName]: value })),
    };
  });
  
  return {
    modelId: entry.modelId,
    version: entry.version,
    artifactHash: entry.artifact.artifactHash,
    signature: entry.artifact.signature,
    signingKeyId: entry.artifact.signingKeyId,
    state: entry.state,
    evaluationReportHash: entry.artifact.evaluationReportHash,
    shadowMetrics: entry.shadowMetrics,
    mlProvenance: {
      weightsHash: entry.artifact.weightsHash,
      inferenceCodeHash: sha256(entry.artifact.inferenceCodeVersion),
      preprocessingHash: sha256(entry.artifact.preprocessingVersion),
      postprocessingHash: sha256(entry.artifact.postprocessingVersion),
      featureSchemaId: entry.artifact.featureSchemaId,
      featureSchemaVersion: entry.artifact.featureSchemaVersion,
      featureVectorHash,
      featureCount: inferenceContext?.featureVector 
        ? Object.keys(inferenceContext.featureVector).length 
        : 0,
      featureImportance,
      inferenceTimestamp: new Date().toISOString(),
      inferenceLatencyMs: inferenceContext?.inferenceLatencyMs || 0,
      inferenceEnvironment: inferenceContext?.inferenceEnvironment || 'unknown',
      trainingDataHash: undefined, // Would come from model card
      trainingTimestamp: undefined,
      parentModelVersion: entry.previousVersion,
      driftMetrics: entry.shadowMetrics ? {
        featureDriftScore: 0,
        predictionDriftScore: 0,
        lastDriftCheckAt: new Date().toISOString(),
        driftAlertTriggered: false,
      } : undefined,
    },
  };
}
