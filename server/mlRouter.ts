/**
 * ML Router - Model Registry and Inference API
 * 
 * Implements service contracts from docs/ml-production/service_contracts.md:
 * - POST /ml/models - Create model
 * - POST /ml/models/{model_id}/versions - Register version
 * - POST /ml/models/{model_id}/versions/{version}/promote - Promote
 * - POST /ml/models/{model_id}/versions/{version}/rollback - Rollback
 * - POST /ml/infer - Score endpoint
 */

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from './_core/trpc';
import {
  ModelRegistryV2,
  InferenceService,
  AutoDisableMonitor,
  type ModelManifest,
  type PromotionPacket,
  type InferenceFact,
  type ModelStatus,
} from './core/model/ModelGovernanceV2';

// ============================================================
// SCHEMAS
// ============================================================

const ModelManifestSchema = z.object({
  model_id: z.string().min(1),
  version: z.string().min(1),
  artifact_uri: z.string().min(1),
  artifact_hash: z.string().regex(/^[0-9a-f]{64}$/),
  trainer_code_hash: z.string().min(6),
  inference_runtime_hash: z.string().min(6),
  feature_schema_id: z.string().min(1),
  feature_schema_version: z.string().min(1),
  dataset_snapshot_id: z.string().min(1),
  dataset_hash: z.string().regex(/^[0-9a-f]{64}$/),
  evaluation_report_hash: z.string().regex(/^[0-9a-f]{64}$/),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const PromotionPacketSchema = z.object({
  model_id: z.string(),
  model_version: z.string(),
  artifact_hash: z.string(),
  manifest_hash: z.string(),
  shadow_window_start: z.string(),
  shadow_window_end: z.string(),
  coverage_percent: z.number().min(0).max(100),
  latency_p50_ms: z.number().min(0),
  latency_p95_ms: z.number().min(0),
  latency_p99_ms: z.number().min(0),
  timeout_rate: z.number().min(0).max(1),
  error_rate: z.number().min(0).max(1),
  agreement_with_baseline: z.number().min(0).max(1),
  estimated_uplift: z.number().optional(),
  constitution_violation_rate: z.number().min(0).max(1),
  primary_metrics: z.record(z.string(), z.object({
    value: z.number(),
    confidence_interval: z.tuple([z.number(), z.number()]).optional(),
  })),
  baseline_comparison: z.record(z.string(), z.number()),
  fairness_metrics: z.record(z.string(), z.number()).optional(),
  dashboard_links: z.array(z.string()),
  alerts_configured: z.boolean(),
  oncall_owner: z.string(),
  runbook_links: z.array(z.string()),
  rollback_plan: z.string(),
  kill_switch_tested: z.boolean(),
  approvals: z.array(z.object({
    role: z.string(),
    approved_by: z.string(),
    approved_at: z.string(),
    audit_event_id: z.string().optional(),
  })),
  target_status: z.enum(['CANARY', 'PRODUCTION']),
  canary_scope: z.object({
    tenant_ids: z.array(z.string()).optional(),
    segments: z.array(z.string()).optional(),
    traffic_percent: z.number().min(0).max(100).optional(),
  }).optional(),
  guardrails: z.record(z.string(), z.number()),
  auto_rollback_triggers: z.array(z.string()),
});

const InferenceRequestSchema = z.object({
  decision_id: z.string().min(1),
  tenant_id: z.string().min(1),
  environment_id: z.string().min(1),
  feature_schema_id: z.string().min(1),
  feature_schema_version: z.string().min(1),
  features: z.record(z.string(), z.unknown()),
  context: z.record(z.string(), z.unknown()).optional(),
});

// ============================================================
// SINGLETON INSTANCES (In production, use dependency injection)
// ============================================================

// Demo keys - in production, load from KMS
const DEMO_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7MmjSP/RLXR5RJ5Wr
-----END RSA PRIVATE KEY-----`;

const DEMO_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Z3VS5JJcds3xfn/ygWy
-----END PUBLIC KEY-----`;

// In-memory registry (in production, use Postgres)
let registry: ModelRegistryV2 | null = null;
let inferenceService: InferenceService | null = null;
const autoDisableMonitors: Map<string, AutoDisableMonitor> = new Map();

function getRegistry(): ModelRegistryV2 {
  if (!registry) {
    registry = new ModelRegistryV2(DEMO_PRIVATE_KEY, DEMO_PUBLIC_KEY);
  }
  return registry;
}

function getInferenceService(): InferenceService {
  if (!inferenceService) {
    inferenceService = new InferenceService(getRegistry(), 100);
  }
  return inferenceService;
}

function getAutoDisableMonitor(model_id: string): AutoDisableMonitor {
  let monitor = autoDisableMonitors.get(model_id);
  if (!monitor) {
    monitor = new AutoDisableMonitor();
    autoDisableMonitors.set(model_id, monitor);
  }
  return monitor;
}

// Store inference facts (in production, emit to event store)
const inferenceFacts: InferenceFact[] = [];

// ============================================================
// ML ROUTER
// ============================================================

export const mlRouter = router({
  // --------------------------------------------------------
  // Model Registry API
  // --------------------------------------------------------
  
  /**
   * Create model (POST /ml/models)
   */
  createModel: protectedProcedure
    .input(z.object({
      model_id: z.string().min(1),
      domain_type: z.string().min(1),
      description: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      const reg = getRegistry();
      return reg.createModel(input);
    }),
  
  /**
   * Register model version (POST /ml/models/{model_id}/versions)
   */
  registerVersion: protectedProcedure
    .input(z.object({
      model_id: z.string().min(1),
      manifest: ModelManifestSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      const reg = getRegistry();
      const created_by = ctx.user?.name || 'system';
      
      const { version, event } = reg.registerVersion(
        input.model_id,
        input.manifest as Omit<ModelManifest, 'manifest_hash' | 'signature' | 'signing_key_id'>,
        created_by
      );
      
      return {
        model_version_id: version.model_version_id,
        status: version.status,
        artifact_hash: version.artifact_hash,
        manifest_hash: version.manifest_hash,
        lifecycle_event_id: event.lifecycle_event_id,
      };
    }),
  
  /**
   * Promote model (POST /ml/models/{model_id}/versions/{version}/promote)
   */
  promote: protectedProcedure
    .input(z.object({
      model_id: z.string().min(1),
      version: z.string().min(1),
      target_status: z.enum(['SHADOW', 'CANARY', 'PRODUCTION']),
      promotion_packet: PromotionPacketSchema.nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const reg = getRegistry();
      const approved_by = ctx.user?.name || 'system';
      
      const { version, event } = reg.promote(
        input.model_id,
        input.version,
        input.target_status,
        input.promotion_packet as PromotionPacket | null,
        approved_by
      );
      
      return {
        model_version_id: version.model_version_id,
        status: version.status,
        lifecycle_event_id: event.lifecycle_event_id,
      };
    }),
  
  /**
   * Rollback model (POST /ml/models/{model_id}/versions/{version}/rollback)
   */
  rollback: protectedProcedure
    .input(z.object({
      model_id: z.string().min(1),
      from_version: z.string().min(1),
      to_version: z.string().min(1),
      reason: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const reg = getRegistry();
      const rolled_back_by = ctx.user?.name || 'system';
      
      const { from, to, event } = reg.rollback(
        input.model_id,
        input.from_version,
        input.to_version,
        input.reason,
        rolled_back_by
      );
      
      return {
        from_version: from.version_label,
        from_status: from.status,
        to_version: to.version_label,
        to_status: to.status,
        lifecycle_event_id: event.lifecycle_event_id,
      };
    }),
  
  /**
   * Get model version
   */
  getVersion: publicProcedure
    .input(z.object({
      model_id: z.string().min(1),
      version: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const reg = getRegistry();
      const version = reg.getVersion(input.model_id, input.version);
      
      if (!version) {
        return null;
      }
      
      return {
        model_version_id: version.model_version_id,
        model_id: version.model_id,
        version_label: version.version_label,
        status: version.status,
        artifact_hash: version.artifact_hash,
        manifest_hash: version.manifest_hash,
        feature_schema_id: version.feature_schema_id,
        feature_schema_version: version.feature_schema_version,
        created_at: version.created_at,
      };
    }),
  
  /**
   * Get production model
   */
  getProduction: publicProcedure
    .input(z.object({
      model_id: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const reg = getRegistry();
      const version = reg.getProduction(input.model_id);
      
      if (!version) {
        return null;
      }
      
      return {
        model_version_id: version.model_version_id,
        version_label: version.version_label,
        status: version.status,
        artifact_hash: version.artifact_hash,
      };
    }),
  
  // --------------------------------------------------------
  // Inference API
  // --------------------------------------------------------
  
  /**
   * Score endpoint (POST /ml/infer)
   * Shadow-safe: pure function, emits InferenceFact
   */
  infer: publicProcedure
    .input(z.object({
      model_id: z.string().min(1),
      request: InferenceRequestSchema,
    }))
    .mutation(async ({ input }) => {
      const svc = getInferenceService();
      const monitor = getAutoDisableMonitor(input.model_id);
      
      // Demo model executor (in production, call actual model service)
      const modelExecutor = async (features: Record<string, unknown>) => {
        // Simulate inference
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
        
        return {
          prediction: { score: Math.random(), action: 'APPROVE' },
          confidence: 0.85 + Math.random() * 0.1,
          distribution: [
            { action: 'APPROVE', probability: 0.7 },
            { action: 'REVIEW', probability: 0.2 },
            { action: 'DECLINE', probability: 0.1 },
          ],
        };
      };
      
      const { response, fact } = await svc.infer(
        input.model_id,
        input.request,
        modelExecutor
      );
      
      // Record for monitoring
      monitor.recordInference(response.latency_ms, response.status);
      
      // Store fact (in production, emit to event store)
      inferenceFacts.push(fact);
      
      // Check auto-disable
      const disableCheck = monitor.shouldDisable();
      
      return {
        ...response,
        auto_disable_triggered: disableCheck.disable,
        auto_disable_reason: disableCheck.reason,
      };
    }),
  
  /**
   * Get inference facts for a decision
   */
  getInferenceFacts: publicProcedure
    .input(z.object({
      decision_id: z.string().min(1),
    }))
    .query(async ({ input }) => {
      return inferenceFacts.filter(f => f.decision_id === input.decision_id);
    }),
  
  /**
   * Get model health metrics
   */
  getModelHealth: publicProcedure
    .input(z.object({
      model_id: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const monitor = autoDisableMonitors.get(input.model_id);
      
      if (!monitor) {
        return {
          model_id: input.model_id,
          total_inferences: 0,
          health: 'UNKNOWN' as const,
        };
      }
      
      const disableCheck = monitor.shouldDisable();
      
      return {
        model_id: input.model_id,
        health: disableCheck.disable ? 'DEGRADED' : 'HEALTHY',
        auto_disable_reason: disableCheck.reason,
      };
    }),
});

export type MLRouter = typeof mlRouter;
