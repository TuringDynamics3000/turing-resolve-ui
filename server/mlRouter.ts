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
import { TRPCError } from '@trpc/server';
import { 
  RBACService, 
  COMMANDS, 
  RBAC_ROLES,
  type AuthorizationContext 
} from './core/auth/RBACService';
import {
  ModelRegistryV2,
  InferenceService,
  AutoDisableMonitor,
  type ModelManifest,
  type PromotionPacket,
  type InferenceFact,
  type ModelStatus,
} from './core/model/ModelGovernanceV2';
import {
  getModelServiceClient,
  createFallbackExecutor,
  ModelServiceError,
  type InferenceResponse as ModelServiceResponse,
} from './core/model/ModelServiceClient';

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

// RBAC Service instance
const rbacService = new RBACService();

/**
 * RBAC Authorization Helper
 * Checks authorization and emits authority fact
 */
async function checkRBAC(
  ctx: { user?: { openId: string; name?: string | null } | null },
  commandCode: string,
  resourceId?: string,
  tenantId: string = 'default',
  environmentId: string = 'prod'
): Promise<void> {
  const actorId = ctx.user?.openId || 'anonymous';
  
  const authCtx: AuthorizationContext = {
    actorId,
    scope: {
      tenantId,
      environmentId,
      domain: 'ML',
    },
  };
  
  const result = await rbacService.authorize(authCtx, commandCode, resourceId);
  
  if (!result.authorized) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `RBAC_DENIED: ${result.reasonCode}. Required roles: ${result.requiredRoles.join(', ')}. Your roles: ${result.actorRoles.join(', ') || 'none'}`,
    });
  }
}

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
   * RBAC: Requires MODEL_AUTHOR role
   */
  registerVersion: protectedProcedure
    .input(z.object({
      model_id: z.string().min(1),
      manifest: ModelManifestSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      // RBAC Check: MODEL_AUTHOR required
      await checkRBAC(ctx, COMMANDS.REGISTER_MODEL_VERSION, input.model_id);
      
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
   * RBAC: 
   *   - SHADOW: MODEL_OPERATOR
   *   - CANARY: MODEL_APPROVER + approval required
   *   - PRODUCTION: RISK_APPROVER + approval required
   */
  promote: protectedProcedure
    .input(z.object({
      model_id: z.string().min(1),
      version: z.string().min(1),
      target_status: z.enum(['SHADOW', 'CANARY', 'PRODUCTION']),
      promotion_packet: PromotionPacketSchema.nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      // RBAC Check based on target status
      const commandCode = input.target_status === 'SHADOW' 
        ? COMMANDS.PROMOTE_MODEL_TO_SHADOW
        : input.target_status === 'CANARY'
          ? COMMANDS.PROMOTE_MODEL_TO_CANARY
          : COMMANDS.PROMOTE_MODEL_TO_PROD;
      
      await checkRBAC(ctx, commandCode, `${input.model_id}:${input.version}`);
      
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
   * RBAC: Requires MODEL_OPERATOR role
   */
  rollback: protectedProcedure
    .input(z.object({
      model_id: z.string().min(1),
      from_version: z.string().min(1),
      to_version: z.string().min(1),
      reason: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      // RBAC Check: MODEL_OPERATOR required
      await checkRBAC(ctx, COMMANDS.ROLLBACK_MODEL, `${input.model_id}:${input.from_version}`);
      
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
   * 
   * Wired to external model service with:
   * - Retry logic with exponential backoff
   * - Circuit breaker for fault tolerance
   * - Fallback to conservative prediction on failure
   * - Latency tracking for monitoring
   */
  infer: publicProcedure
    .input(z.object({
      model_id: z.string().min(1),
      request: InferenceRequestSchema,
      use_fallback: z.boolean().optional().default(false),
    }))
    .mutation(async ({ input }) => {
      const svc = getInferenceService();
      const monitor = getAutoDisableMonitor(input.model_id);
      const modelServiceClient = getModelServiceClient();
      
      // Get production version for this model
      const reg = getRegistry();
      const prodVersion = reg.getProduction(input.model_id);
      const modelVersion = prodVersion?.version_label || 'latest';
      
      // Model executor that calls external service with fallback
      const modelExecutor = async (features: Record<string, unknown>) => {
        // If explicitly using fallback, skip external service
        if (input.use_fallback) {
          const fallback = createFallbackExecutor();
          const result = await fallback(features);
          return {
            prediction: result.prediction,
            confidence: result.confidence,
            distribution: result.distribution?.map(d => ({
              action: d.label,
              probability: d.probability,
            })),
          };
        }
        
        try {
          // Try external model service
          const response = await modelServiceClient.infer({
            model_id: input.model_id,
            model_version: modelVersion,
            features,
            request_id: input.request.decision_id,
            tenant_id: input.request.tenant_id,
          });
          
          return {
            prediction: response.prediction,
            confidence: response.confidence,
            distribution: response.distribution?.map(d => ({
              action: d.label,
              probability: d.probability,
            })),
            _served_by: response.served_by,
            _external_latency_ms: response.latency_ms,
          };
        } catch (error) {
          // Log error and use fallback
          console.warn(
            `[ML] Model service error for ${input.model_id}: ${(error as Error).message}. Using fallback.`
          );
          
          // Use fallback executor
          const fallback = createFallbackExecutor();
          const result = await fallback(features);
          return {
            prediction: result.prediction,
            confidence: result.confidence,
            distribution: result.distribution?.map(d => ({
              action: d.label,
              probability: d.probability,
            })),
            _served_by: 'fallback',
            _fallback_reason: (error as Error).message,
          };
        }
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
      
      // Get service metrics
      const serviceMetrics = modelServiceClient.getMetrics();
      
      return {
        ...response,
        auto_disable_triggered: disableCheck.disable,
        auto_disable_reason: disableCheck.reason,
        service_metrics: {
          circuit_state: serviceMetrics.circuit_state,
          avg_latency_ms: serviceMetrics.avg_latency_ms,
          error_rate: serviceMetrics.failed_requests / Math.max(serviceMetrics.total_requests, 1),
        },
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
      const modelServiceClient = getModelServiceClient();
      const serviceMetrics = modelServiceClient.getMetrics();
      
      if (!monitor) {
        return {
          model_id: input.model_id,
          total_inferences: 0,
          health: 'UNKNOWN' as const,
          service_metrics: serviceMetrics,
        };
      }
      
      const disableCheck = monitor.shouldDisable();
      
      return {
        model_id: input.model_id,
        health: disableCheck.disable ? 'DEGRADED' : 'HEALTHY',
        auto_disable_reason: disableCheck.reason,
        service_metrics: serviceMetrics,
      };
    }),
  
  /**
   * Get model service metrics (circuit breaker, latency, etc.)
   */
  getServiceMetrics: publicProcedure
    .query(async () => {
      const modelServiceClient = getModelServiceClient();
      return modelServiceClient.getMetrics();
    }),
  
  /**
   * Health check for model service
   */
  serviceHealthCheck: publicProcedure
    .mutation(async () => {
      const modelServiceClient = getModelServiceClient();
      return modelServiceClient.healthCheck();
    }),
  
  /**
   * Reset circuit breaker (admin action)
   */
  resetCircuitBreaker: protectedProcedure
    .mutation(async () => {
      const modelServiceClient = getModelServiceClient();
      modelServiceClient.resetCircuitBreaker();
      return { success: true, message: 'Circuit breaker reset' };
    }),
  
  /**
   * List all registered models
   */
  listModels: publicProcedure
    .query(async () => {
      const reg = getRegistry();
      return reg.listModels();
    }),
  
  /**
   * List all versions for a model
   */
  listVersions: publicProcedure
    .input(z.object({
      model_id: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const reg = getRegistry();
      return reg.listVersions(input.model_id);
    }),
  
  /**
   * Get lifecycle events for a model
   */
  getLifecycleEvents: publicProcedure
    .input(z.object({
      model_id: z.string().min(1),
      limit: z.number().min(1).max(100).optional().default(50),
    }))
    .query(async ({ input }) => {
      const reg = getRegistry();
      return reg.getLifecycleEvents(input.model_id, input.limit);
    }),
});

export type MLRouter = typeof mlRouter;
