# ML Production Grade - Gap Analysis

## Comparison: Existing ModelGovernance.ts vs. Handover Pack Requirements

### Model Manifest Schema

| Field (Pack Requires) | Existing ModelGovernance | Status |
|----------------------|-------------------------|--------|
| model_id | ✅ modelId | OK |
| version | ✅ version | OK |
| artifact_uri | ❌ Missing | **GAP** |
| artifact_hash | ✅ artifactHash | OK |
| manifest_hash | ❌ Missing | **GAP** |
| trainer_code_hash | ❌ Missing (has inferenceCodeVersion) | **GAP** |
| inference_runtime_hash | ❌ Missing | **GAP** |
| feature_schema_id | ✅ featureSchemaId | OK |
| feature_schema_version | ✅ featureSchemaVersion | OK |
| dataset_snapshot_id | ❌ Missing | **GAP** |
| dataset_hash | ❌ Missing | **GAP** |
| evaluation_report_hash | ✅ evaluationReportHash | OK |
| signature | ✅ signature | OK |
| signing_key_id | ✅ signingKeyId | OK |

### Inference Fact Schema

| Field (Pack Requires) | Existing Implementation | Status |
|----------------------|------------------------|--------|
| fact_type: INFERENCE_EMITTED | ❌ Not implemented | **GAP** |
| decision_id | ✅ decisionId in ShadowPrediction | OK |
| timestamp_utc | ✅ timestamp | OK |
| tenant_id | ❌ Missing | **GAP** |
| environment_id | ❌ Missing | **GAP** |
| model_id | ✅ modelId | OK |
| model_version | ✅ version | OK |
| model_artifact_hash | ❌ Missing from prediction | **GAP** |
| model_signing_key_id | ❌ Missing from prediction | **GAP** |
| feature_schema_id | ❌ Missing from prediction | **GAP** |
| feature_schema_version | ❌ Missing from prediction | **GAP** |
| feature_snapshot_hash | ❌ Missing | **GAP** |
| prediction | ✅ recommendation | OK |
| confidence | ✅ confidence | OK |
| action_distribution | ✅ distribution | OK |
| latency_ms | ✅ latencyMs | OK |
| status | ❌ Missing (OK/TIMEOUT/ERROR/SKIPPED) | **GAP** |

### Lifecycle States

| State (Pack Requires) | Existing | Status |
|----------------------|----------|--------|
| REGISTERED | ✅ | OK |
| SHADOW | ✅ | OK |
| CANARY | ❌ Missing | **GAP** |
| PRODUCTION | ✅ | OK |
| RETIRED | ✅ | OK |
| REVOKED | ❌ Missing | **GAP** |

### Lifecycle Events

| Event (Pack Requires) | Existing | Status |
|----------------------|----------|--------|
| REGISTER | ✅ MODEL_REGISTERED | OK |
| PROMOTE_TO_SHADOW | ✅ MODEL_SHADOW_STARTED | OK |
| PROMOTE_TO_CANARY | ❌ Missing | **GAP** |
| PROMOTE_TO_PRODUCTION | ✅ MODEL_PROMOTED | OK |
| ROLLBACK | ✅ MODEL_ROLLED_BACK | OK |
| DISABLE | ✅ MODEL_DISABLED | OK |
| RETIRE | ❌ Missing (state exists, event doesn't) | **GAP** |
| REVOKE | ❌ Missing | **GAP** |

### API Endpoints

| Endpoint (Pack Requires) | Existing | Status |
|-------------------------|----------|--------|
| POST /ml/models | ❌ Not exposed via tRPC | **GAP** |
| POST /ml/models/{id}/versions | ❌ Not exposed via tRPC | **GAP** |
| POST /ml/.../promote | ❌ Not exposed via tRPC | **GAP** |
| POST /ml/.../rollback | ❌ Not exposed via tRPC | **GAP** |
| POST /ml/infer | ❌ Not exposed via tRPC | **GAP** |
| GET /evidence/decision/{id} | ✅ evidencePacks.generate | OK |

### Monitoring Metrics

| Metric (Pack Requires) | Existing | Status |
|-----------------------|----------|--------|
| inference_latency_ms | ✅ latencyMs tracked | OK |
| inference_timeout_rate | ❌ Not tracked | **GAP** |
| inference_error_rate | ❌ Not tracked | **GAP** |
| shadow_coverage_rate | ❌ Not tracked | **GAP** |
| drift_psi | ❌ Not implemented | **GAP** |
| provenance_missing_rate | ❌ Not tracked | **GAP** |
| model_fallback_rate | ❌ Not tracked | **GAP** |

### Operational Readiness

| Requirement | Existing | Status |
|-------------|----------|--------|
| Kill switch | ✅ ModelKillSwitch class | OK |
| Rollback < 5 min | ✅ Implemented | OK |
| Shadow harness | ✅ ShadowExecutionHarness | OK |
| Promotion gates | ✅ PromotionGate class | OK |
| Auto-disable triggers | ❌ Not implemented | **GAP** |

---

## Summary

**Total Fields/Features Required:** 45
**Implemented:** 25
**Gaps:** 20

### Priority Gaps to Close

1. **InferenceFact emission** - Every inference must emit a fact with full provenance
2. **CANARY state** - Add canary deployment stage
3. **Dataset provenance** - Add dataset_snapshot_id and dataset_hash
4. **API endpoints** - Expose Model Registry and Inference APIs via tRPC
5. **Auto-disable triggers** - Implement latency/error/drift triggers
