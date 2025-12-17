/**
 * Model Governance V2 - Aligned with ML Production Grade Handover Pack
 * 
 * Implements all requirements from:
 * - schemas/model_manifest.schema.json
 * - schemas/inference_fact.schema.json
 * - sql/ml_registry_postgres.sql
 * - docs/service_contracts.md
 */

import * as crypto from 'crypto';
import { canonicalJson, sha256 } from '../merkle/MerkleAuditTrail';

// ============================================================
// MODEL MANIFEST (Aligned with model_manifest.schema.json)
// ============================================================

export type ModelStatus = 
  | 'REGISTERED'
  | 'SHADOW'
  | 'CANARY'      // NEW: Added per pack requirements
  | 'PRODUCTION'
  | 'RETIRED'
  | 'REVOKED';    // NEW: Added per pack requirements

export interface ModelManifest {
  // Required fields per schema
  model_id: string;
  version: string;
  artifact_uri: string;           // NEW: Object store pointer
  artifact_hash: string;          // SHA-256 hex (64 chars)
  manifest_hash: string;          // NEW: SHA-256 of manifest
  trainer_code_hash: string;      // NEW: Git SHA or digest
  inference_runtime_hash: string; // NEW: Container digest
  feature_schema_id: string;
  feature_schema_version: string;
  dataset_snapshot_id: string;    // NEW: Training data reference
  dataset_hash: string;           // NEW: SHA-256 of dataset
  evaluation_report_hash: string;
  signature: string;              // Hex signature
  signing_key_id: string;
  
  // Optional fields
  status?: ModelStatus;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// INFERENCE FACT (Aligned with inference_fact.schema.json)
// ============================================================

export type InferenceStatus = 'OK' | 'TIMEOUT' | 'ERROR' | 'SKIPPED';

export interface InferenceFact {
  fact_type: 'INFERENCE_EMITTED';
  decision_id: string;
  timestamp_utc: string;
  tenant_id: string;
  environment_id: string;
  
  // Model provenance
  model_id: string;
  model_version: string;
  model_artifact_hash: string;
  model_signing_key_id: string;
  
  // Feature provenance
  feature_schema_id: string;
  feature_schema_version: string;
  feature_snapshot_hash: string;
  
  // Prediction
  prediction: unknown;
  confidence?: number | null;
  action_distribution?: Array<{ action: string; probability: number }> | null;
  
  // Performance
  latency_ms: number;
  status: InferenceStatus;
  error_code?: string | null;
  
  // Optional
  metadata?: Record<string, unknown>;
}

// ============================================================
// LIFECYCLE EVENTS (Aligned with ml_registry_postgres.sql)
// ============================================================

export type LifecycleEventType =
  | 'REGISTER'
  | 'PROMOTE_TO_SHADOW'
  | 'PROMOTE_TO_CANARY'      // NEW
  | 'PROMOTE_TO_PRODUCTION'
  | 'ROLLBACK'
  | 'DISABLE'
  | 'RETIRE'                  // NEW
  | 'REVOKE';                 // NEW

export interface ModelLifecycleEvent {
  lifecycle_event_id: string;
  model_version_id: string;
  event_type: LifecycleEventType;
  approved_by?: string;
  reason?: string;
  occurred_at: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// FEATURE SCHEMA REGISTRY
// ============================================================

export interface FeatureSchema {
  feature_schema_id: string;
  feature_schema_version: string;
  created_at: string;
  created_by?: string;
  schema_json: Record<string, unknown>;
  schema_hash: string;
  status: 'ACTIVE' | 'DEPRECATED' | 'REVOKED';
  metadata?: Record<string, unknown>;
}

export interface FeatureSnapshot {
  feature_snapshot_id: string;
  tenant_id: string;
  environment_id: string;
  feature_schema_id: string;
  feature_schema_version: string;
  snapshot_hash: string;
  snapshot_uri?: string;
  created_at: string;
  created_by?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// MODEL VERSION (Full registry entry)
// ============================================================

export interface ModelVersion {
  model_version_id: string;
  model_id: string;
  version_label: string;
  status: ModelStatus;
  
  // Artifact
  artifact_uri: string;
  artifact_hash: string;
  manifest_json: ModelManifest;
  manifest_hash: string;
  
  // Code provenance
  trainer_code_hash: string;
  inference_runtime_hash: string;
  
  // Feature binding
  feature_schema_id: string;
  feature_schema_version: string;
  
  // Dataset provenance
  dataset_snapshot_id: string;
  dataset_hash: string;
  
  // Evaluation
  evaluation_report_uri?: string;
  evaluation_report_hash?: string;
  
  // Signature
  signature: string;
  signing_key_id: string;
  
  // Timestamps
  created_at: string;
  created_by?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// PROMOTION PACKET (Required for CANARY/PRODUCTION)
// ============================================================

export interface PromotionPacket {
  // Identifiers
  model_id: string;
  model_version: string;
  artifact_hash: string;
  manifest_hash: string;
  
  // Shadow results
  shadow_window_start: string;
  shadow_window_end: string;
  coverage_percent: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
  latency_p99_ms: number;
  timeout_rate: number;
  error_rate: number;
  agreement_with_baseline: number;
  estimated_uplift?: number;
  constitution_violation_rate: number;
  
  // Evaluation
  primary_metrics: Record<string, { value: number; confidence_interval?: [number, number] }>;
  baseline_comparison: Record<string, number>;
  
  // Fairness (if applicable)
  fairness_metrics?: Record<string, number>;
  
  // Operational readiness
  dashboard_links: string[];
  alerts_configured: boolean;
  oncall_owner: string;
  runbook_links: string[];
  rollback_plan: string;
  kill_switch_tested: boolean;
  
  // Approvals
  approvals: Array<{
    role: string;
    approved_by: string;
    approved_at: string;
    audit_event_id?: string;
  }>;
  
  // Decision
  target_status: 'CANARY' | 'PRODUCTION';
  canary_scope?: {
    tenant_ids?: string[];
    segments?: string[];
    traffic_percent?: number;
  };
  guardrails: Record<string, number>;
  auto_rollback_triggers: string[];
}

// ============================================================
// MODEL REGISTRY SERVICE V2
// ============================================================

export class ModelRegistryV2 {
  private models: Map<string, ModelVersion[]> = new Map();
  private featureSchemas: Map<string, FeatureSchema[]> = new Map();
  private lifecycleEvents: ModelLifecycleEvent[] = [];
  private privateKey: string;
  private publicKey: string;
  private keyId: string;
  
  constructor(privateKey: string, publicKey: string) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.keyId = sha256(publicKey).substring(0, 16);
  }
  
  /**
   * Create a new model (POST /ml/models)
   */
  createModel(params: {
    model_id: string;
    domain_type: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): { model_id: string } {
    if (this.models.has(params.model_id)) {
      throw new Error(`Model already exists: ${params.model_id}`);
    }
    this.models.set(params.model_id, []);
    return { model_id: params.model_id };
  }
  
  /**
   * Register model version (POST /ml/models/{model_id}/versions)
   */
  registerVersion(
    model_id: string,
    manifest: Omit<ModelManifest, 'manifest_hash' | 'signature' | 'signing_key_id'>,
    created_by: string
  ): { version: ModelVersion; event: ModelLifecycleEvent } {
    const versions = this.models.get(model_id);
    if (!versions) {
      throw new Error(`Model not found: ${model_id}`);
    }
    
    // Check for duplicate
    if (versions.some(v => v.version_label === manifest.version)) {
      throw new Error(`Version already exists: ${model_id}@${manifest.version}`);
    }
    
    // Compute manifest hash
    const manifest_hash = sha256(canonicalJson(manifest));
    
    // Sign
    const signPayload = manifest.artifact_hash + manifest_hash;
    const sign = crypto.createSign('SHA256');
    sign.update(signPayload);
    const signature = sign.sign(this.privateKey, 'hex');
    
    const fullManifest: ModelManifest = {
      ...manifest,
      manifest_hash,
      signature,
      signing_key_id: this.keyId,
    };
    
    const version: ModelVersion = {
      model_version_id: crypto.randomUUID(),
      model_id,
      version_label: manifest.version,
      status: 'REGISTERED',
      artifact_uri: manifest.artifact_uri,
      artifact_hash: manifest.artifact_hash,
      manifest_json: fullManifest,
      manifest_hash,
      trainer_code_hash: manifest.trainer_code_hash,
      inference_runtime_hash: manifest.inference_runtime_hash,
      feature_schema_id: manifest.feature_schema_id,
      feature_schema_version: manifest.feature_schema_version,
      dataset_snapshot_id: manifest.dataset_snapshot_id,
      dataset_hash: manifest.dataset_hash,
      evaluation_report_hash: manifest.evaluation_report_hash,
      signature,
      signing_key_id: this.keyId,
      created_at: new Date().toISOString(),
      created_by,
    };
    
    versions.push(version);
    
    const event: ModelLifecycleEvent = {
      lifecycle_event_id: crypto.randomUUID(),
      model_version_id: version.model_version_id,
      event_type: 'REGISTER',
      approved_by: created_by,
      occurred_at: version.created_at,
    };
    this.lifecycleEvents.push(event);
    
    return { version, event };
  }
  
  /**
   * Promote model (POST /ml/models/{model_id}/versions/{version}/promote)
   */
  promote(
    model_id: string,
    version_label: string,
    target_status: 'SHADOW' | 'CANARY' | 'PRODUCTION',
    promotion_packet: PromotionPacket | null,
    approved_by: string
  ): { version: ModelVersion; event: ModelLifecycleEvent } {
    const version = this.getVersion(model_id, version_label);
    if (!version) {
      throw new Error(`Version not found: ${model_id}@${version_label}`);
    }
    
    // Validate transitions
    const validTransitions: Record<ModelStatus, ModelStatus[]> = {
      'REGISTERED': ['SHADOW'],
      'SHADOW': ['CANARY', 'PRODUCTION', 'REGISTERED'],
      'CANARY': ['PRODUCTION', 'SHADOW'],
      'PRODUCTION': ['RETIRED', 'SHADOW'],
      'RETIRED': [],
      'REVOKED': [],
    };
    
    if (!validTransitions[version.status].includes(target_status)) {
      throw new Error(`Invalid transition: ${version.status} → ${target_status}`);
    }
    
    // Require promotion packet for CANARY/PRODUCTION
    if ((target_status === 'CANARY' || target_status === 'PRODUCTION') && !promotion_packet) {
      throw new Error(`Promotion packet required for ${target_status}`);
    }
    
    // Require approvals for PRODUCTION
    if (target_status === 'PRODUCTION') {
      if (!promotion_packet?.approvals || promotion_packet.approvals.length < 2) {
        throw new Error('PRODUCTION requires at least 2 approvals (maker/checker)');
      }
    }
    
    version.status = target_status;
    
    const eventType: LifecycleEventType = 
      target_status === 'SHADOW' ? 'PROMOTE_TO_SHADOW' :
      target_status === 'CANARY' ? 'PROMOTE_TO_CANARY' :
      'PROMOTE_TO_PRODUCTION';
    
    const event: ModelLifecycleEvent = {
      lifecycle_event_id: crypto.randomUUID(),
      model_version_id: version.model_version_id,
      event_type: eventType,
      approved_by,
      occurred_at: new Date().toISOString(),
      metadata: promotion_packet ? { promotion_packet } : undefined,
    };
    this.lifecycleEvents.push(event);
    
    return { version, event };
  }
  
  /**
   * Rollback model (POST /ml/models/{model_id}/versions/{version}/rollback)
   */
  rollback(
    model_id: string,
    from_version: string,
    to_version: string,
    reason: string,
    rolled_back_by: string
  ): { from: ModelVersion; to: ModelVersion; event: ModelLifecycleEvent } {
    const fromV = this.getVersion(model_id, from_version);
    const toV = this.getVersion(model_id, to_version);
    
    if (!fromV || !toV) {
      throw new Error('Version not found');
    }
    
    // Demote current
    fromV.status = 'SHADOW';
    
    // Promote target
    toV.status = 'PRODUCTION';
    
    const event: ModelLifecycleEvent = {
      lifecycle_event_id: crypto.randomUUID(),
      model_version_id: fromV.model_version_id,
      event_type: 'ROLLBACK',
      approved_by: rolled_back_by,
      reason,
      occurred_at: new Date().toISOString(),
      metadata: { from_version, to_version },
    };
    this.lifecycleEvents.push(event);
    
    return { from: fromV, to: toV, event };
  }
  
  /**
   * Get version
   */
  getVersion(model_id: string, version_label: string): ModelVersion | undefined {
    return this.models.get(model_id)?.find(v => v.version_label === version_label);
  }
  
  /**
   * Get production version
   */
  getProduction(model_id: string): ModelVersion | undefined {
    return this.models.get(model_id)?.find(v => v.status === 'PRODUCTION');
  }
  
  /**
   * Get shadow version
   */
  getShadow(model_id: string): ModelVersion | undefined {
    return this.models.get(model_id)?.find(v => v.status === 'SHADOW');
  }
  
  /**
   * Get canary version
   */
  getCanary(model_id: string): ModelVersion | undefined {
    return this.models.get(model_id)?.find(v => v.status === 'CANARY');
  }
}

// ============================================================
// INFERENCE SERVICE
// ============================================================

export interface InferenceRequest {
  decision_id: string;
  tenant_id: string;
  environment_id: string;
  feature_schema_id: string;
  feature_schema_version: string;
  features: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface InferenceResponse {
  status: InferenceStatus;
  prediction: unknown;
  confidence?: number;
  action_distribution?: Array<{ action: string; probability: number }>;
  model_id: string;
  model_version: string;
  model_artifact_hash: string;
  latency_ms: number;
}

export class InferenceService {
  private registry: ModelRegistryV2;
  private timeoutMs: number;
  
  constructor(registry: ModelRegistryV2, timeoutMs: number = 100) {
    this.registry = registry;
    this.timeoutMs = timeoutMs;
  }
  
  /**
   * Score endpoint (POST /ml/infer)
   * Shadow-safe: pure function, no side effects
   */
  async infer(
    model_id: string,
    request: InferenceRequest,
    modelExecutor: (features: Record<string, unknown>) => Promise<{ prediction: unknown; confidence?: number; distribution?: Array<{ action: string; probability: number }> }>
  ): Promise<{ response: InferenceResponse; fact: InferenceFact }> {
    const startTime = Date.now();
    
    // Get production model
    const version = this.registry.getProduction(model_id);
    if (!version) {
      const fact = this.createInferenceFact(request, model_id, '', '', '', startTime, 'SKIPPED', null, null, 'NO_PRODUCTION_MODEL');
      return {
        response: {
          status: 'SKIPPED',
          prediction: null,
          model_id,
          model_version: '',
          model_artifact_hash: '',
          latency_ms: Date.now() - startTime,
        },
        fact,
      };
    }
    
    try {
      // Execute with timeout
      const result = await Promise.race([
        modelExecutor(request.features),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('TIMEOUT')), this.timeoutMs)
        ),
      ]);
      
      const latency_ms = Date.now() - startTime;
      
      const fact = this.createInferenceFact(
        request,
        model_id,
        version.version_label,
        version.artifact_hash,
        version.signing_key_id,
        startTime,
        'OK',
        result.prediction,
        result.confidence ?? null,
        null,
        result.distribution
      );
      
      return {
        response: {
          status: 'OK',
          prediction: result.prediction,
          confidence: result.confidence,
          action_distribution: result.distribution,
          model_id,
          model_version: version.version_label,
          model_artifact_hash: version.artifact_hash,
          latency_ms,
        },
        fact,
      };
    } catch (error) {
      const latency_ms = Date.now() - startTime;
      const isTimeout = error instanceof Error && error.message === 'TIMEOUT';
      
      const fact = this.createInferenceFact(
        request,
        model_id,
        version.version_label,
        version.artifact_hash,
        version.signing_key_id,
        startTime,
        isTimeout ? 'TIMEOUT' : 'ERROR',
        null,
        null,
        isTimeout ? 'TIMEOUT' : (error instanceof Error ? error.message : 'UNKNOWN')
      );
      
      return {
        response: {
          status: isTimeout ? 'TIMEOUT' : 'ERROR',
          prediction: null,
          model_id,
          model_version: version.version_label,
          model_artifact_hash: version.artifact_hash,
          latency_ms,
        },
        fact,
      };
    }
  }
  
  private createInferenceFact(
    request: InferenceRequest,
    model_id: string,
    model_version: string,
    model_artifact_hash: string,
    model_signing_key_id: string,
    startTime: number,
    status: InferenceStatus,
    prediction: unknown,
    confidence: number | null,
    error_code: string | null,
    action_distribution?: Array<{ action: string; probability: number }>
  ): InferenceFact {
    // Compute feature snapshot hash
    const feature_snapshot_hash = sha256(canonicalJson(request.features));
    
    return {
      fact_type: 'INFERENCE_EMITTED',
      decision_id: request.decision_id,
      timestamp_utc: new Date(startTime).toISOString(),
      tenant_id: request.tenant_id,
      environment_id: request.environment_id,
      model_id,
      model_version,
      model_artifact_hash,
      model_signing_key_id,
      feature_schema_id: request.feature_schema_id,
      feature_schema_version: request.feature_schema_version,
      feature_snapshot_hash,
      prediction,
      confidence,
      action_distribution: action_distribution ?? null,
      latency_ms: Date.now() - startTime,
      status,
      error_code,
    };
  }
}

// ============================================================
// AUTO-DISABLE TRIGGERS
// ============================================================

export interface AutoDisableTriggers {
  latency_p99_threshold_ms: number;
  latency_breach_window_minutes: number;
  timeout_rate_threshold: number;
  timeout_window_minutes: number;
  error_rate_threshold: number;
  error_window_minutes: number;
  drift_psi_threshold: number;
}

export const DEFAULT_AUTO_DISABLE_TRIGGERS: AutoDisableTriggers = {
  latency_p99_threshold_ms: 100,
  latency_breach_window_minutes: 15,
  timeout_rate_threshold: 0.005, // 0.5%
  timeout_window_minutes: 10,
  error_rate_threshold: 0.002, // 0.2%
  error_window_minutes: 10,
  drift_psi_threshold: 0.25,
};

export class AutoDisableMonitor {
  private triggers: AutoDisableTriggers;
  private latencies: Array<{ timestamp: number; value: number }> = [];
  private timeouts: Array<{ timestamp: number }> = [];
  private errors: Array<{ timestamp: number }> = [];
  private totalInferences = 0;
  
  constructor(triggers: AutoDisableTriggers = DEFAULT_AUTO_DISABLE_TRIGGERS) {
    this.triggers = triggers;
  }
  
  recordInference(latency_ms: number, status: InferenceStatus): void {
    const now = Date.now();
    this.totalInferences++;
    this.latencies.push({ timestamp: now, value: latency_ms });
    
    if (status === 'TIMEOUT') {
      this.timeouts.push({ timestamp: now });
    }
    if (status === 'ERROR') {
      this.errors.push({ timestamp: now });
    }
    
    // Prune old data (keep last hour)
    const cutoff = now - 60 * 60 * 1000;
    this.latencies = this.latencies.filter(l => l.timestamp > cutoff);
    this.timeouts = this.timeouts.filter(t => t.timestamp > cutoff);
    this.errors = this.errors.filter(e => e.timestamp > cutoff);
  }
  
  shouldDisable(): { disable: boolean; reason?: string } {
    const now = Date.now();
    
    // Check latency P99
    const latencyWindow = now - this.triggers.latency_breach_window_minutes * 60 * 1000;
    const recentLatencies = this.latencies
      .filter(l => l.timestamp > latencyWindow)
      .map(l => l.value)
      .sort((a, b) => a - b);
    
    if (recentLatencies.length > 0) {
      const p99Index = Math.floor(recentLatencies.length * 0.99);
      const p99 = recentLatencies[p99Index];
      if (p99 > this.triggers.latency_p99_threshold_ms) {
        return { disable: true, reason: `Latency P99 (${p99}ms) exceeds threshold (${this.triggers.latency_p99_threshold_ms}ms)` };
      }
    }
    
    // Check timeout rate
    const timeoutWindow = now - this.triggers.timeout_window_minutes * 60 * 1000;
    const recentTimeouts = this.timeouts.filter(t => t.timestamp > timeoutWindow).length;
    const recentTotal = this.latencies.filter(l => l.timestamp > timeoutWindow).length;
    if (recentTotal > 0) {
      const timeoutRate = recentTimeouts / recentTotal;
      if (timeoutRate > this.triggers.timeout_rate_threshold) {
        return { disable: true, reason: `Timeout rate (${(timeoutRate * 100).toFixed(2)}%) exceeds threshold (${(this.triggers.timeout_rate_threshold * 100).toFixed(2)}%)` };
      }
    }
    
    // Check error rate
    const errorWindow = now - this.triggers.error_window_minutes * 60 * 1000;
    const recentErrors = this.errors.filter(e => e.timestamp > errorWindow).length;
    const errorTotal = this.latencies.filter(l => l.timestamp > errorWindow).length;
    if (errorTotal > 0) {
      const errorRate = recentErrors / errorTotal;
      if (errorRate > this.triggers.error_rate_threshold) {
        return { disable: true, reason: `Error rate (${(errorRate * 100).toFixed(2)}%) exceeds threshold (${(this.triggers.error_rate_threshold * 100).toFixed(2)}%)` };
      }
    }
    
    return { disable: false };
  }
}

// Re-export ModelRegistryV2 as ModelRegistry for convenience
export { ModelRegistryV2 as ModelRegistry };
