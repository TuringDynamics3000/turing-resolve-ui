# Protocol Schema Pack: Intelligence Events

**Production-grade, regulator-defensible event schema bundle for Risk Brain v1**

Ready to drop into: `/turing_protocol/schemas/intelligence/`

All schemas follow these hard rules:
- ✅ **Immutable, append-only**
- ✅ **Tenant-scoped**
- ✅ **Time-travel & replay safe**
- ✅ **Court-admissible**
- ✅ **AI never writes money**
- ✅ **Model/version provenance always explicit**

## Schema Format

Avro-style JSON (Kafka/MSK + Schema Registry friendly). These can be trivially converted to Protobuf later if needed.

## Schema Catalog

### 0️⃣ Base Schema (All Intelligence Events Extend This)

**`base/IntelligenceEventBase.avsc`**

All ML/RL/AI events extend this base schema with:
- `event_id` (UUID v7)
- `tenant_id` (CU identifier)
- `origin` (HUMAN | SYSTEM | AI) - **critical for AI-originated command blocking**
- `occurred_at` (timestamp)
- `schema_version` (for backward compatibility)
- `hash_prev_event` (for chain integrity)

### 1️⃣ Fraud ML

**`fraud/FraudRiskScoreProduced.avsc`**
- Fraud risk score produced by ML model
- First protocol fraud ML event from Layer B → Layer A
- Includes: payment_id, customer_id, score_value, risk_band, model provenance

**`fraud/FraudAdvisoryIssued.avsc`**
- Fraud advisory issued after statistical proof
- Human chooses to accept or override
- Includes: recommended_action, confidence, expected_loss_avoidance

### 2️⃣ AML

**`aml/AmlRiskScoreProduced.avsc`**
- AML risk score produced by ML model
- First protocol AML ML event from Layer B → Layer A
- Includes: customer_id, account_id, risk_score, risk_band, model provenance

**`aml/AmlInvestigationOpened.avsc`**
- AML investigation opened by human investigator
- Only humans can open AML investigations
- Includes: customer_id, account_id, trigger_event_id

**`aml/SuspiciousMatterReportSubmitted.avsc`**
- Suspicious Matter Report submitted to AUSTRAC
- Only humans can submit SMRs
- Includes: customer_id, account_id, smr_reference, submitted_by

### 3️⃣ Hardship ML

**`hardship/HardshipRiskScoreProduced.avsc`**
- Hardship risk score produced by ML model
- First protocol hardship ML event from Layer B → Layer A
- Includes: customer_id, score_value (P(hardship in 45-90 days)), risk_band, model provenance

### 4️⃣ Payments RL

**`payments/RlPolicyEvaluated.avsc`**
- Payments RL policy evaluated
- First protocol payments RL event from Layer B → Layer A
- Zero authority, shadow only
- Includes: payment_id, state_hash, proposed_action, policy provenance, confidence, reward estimate

**`payments/RlRoutingAdvisoryIssued.avsc`**
- Payments RL routing advisory issued after statistical proof
- Human chooses to accept or override
- Includes: recommended_action, expected_cost_saving, expected_latency_delta, confidence

### 5️⃣ Treasury RL

**`treasury/RlTreasuryPolicyEvaluated.avsc`**
- Treasury RL policy evaluated
- First protocol treasury RL event from Layer B → Layer A
- Zero authority, shadow only
- Includes: state_hash, proposed_action, policy provenance, confidence, reward estimate

### 6️⃣ Gen-AI Explainability

**`ai/AiExplanationGenerated.avsc`**
- AI-generated explanation for regulator-grade transparency
- Used for AML narratives, fraud explanations, etc.
- Includes: subject, primary_entity_id, source_event_ids, model_id, prompt_hash, output_hash, object_store_ref

### 7️⃣ Model Governance (Mandatory for APRA/ASIC)

**`governance/ModelDeployed.avsc`**
- Model deployed to production
- Mandatory for APRA/ASIC model governance
- Includes: model_id, model_version, deployed_by, authority_level (SHADOW | ADVISORY | ENFORCEMENT)

**`governance/ModelAuthorityLevelChanged.avsc`**
- Model authority level changed
- Requires board/regulator approval for ADVISORY → ENFORCEMENT
- Includes: model_id, old_authority, new_authority, approving_body, policy_id

## Enforcement You Must Add in TuringCore

These schemas must be backed by two hard validators:

### 1. AI Origin Command Blocker

**Rule:**
```
If:
  origin = AI
  AND command touches {ledger, payments, treasury, restrictions}
→ REJECT
```

**Implementation:**
- Add `origin` field to all commands
- Implement command blocker at Protocol boundary
- Test blocker with AI-originated ledger commands
- Test blocker with AI-originated settlement commands

### 2. Policy Gateway Validator

**Rule:**
```
Every ML/RL event must pass through:
Policy(event) → Flag | Advisory | No-op
```

**No direct side effects.**

**Implementation:**
- Implement Fraud Policy Gateway in TuringCore
- Implement AML Policy Gateway in TuringCore
- Implement Hardship Policy Gateway in TuringCore
- Implement Payments RL Policy Gateway in TuringCore
- Implement Treasury RL Policy Gateway in TuringCore

## What You Now Have

You now have a complete, formal, event-level contract between:
- **B (Risk Brain v1)** - Probabilistic intelligence layer
- **A (TuringCore core banking system)** - Deterministic system of record

**This is now:**
- ✅ **Buildable** (Avro schemas ready for Kafka/MSK)
- ✅ **Testable** (Schema validation, command blocking)
- ✅ **Auditable** (Full provenance, replay safe)
- ✅ **Regulator-defensible** (APRA/ASIC/AUSTRAC compliant)
- ✅ **Investor-credible** (Production-grade architecture)

## Schema Registry Integration

### Kafka/MSK + Schema Registry

1. Upload all `.avsc` files to Confluent Schema Registry or AWS Glue Schema Registry
2. Configure Kafka producers to validate against schemas
3. Configure Kafka consumers to deserialize with schema evolution support

### Example (Python with Confluent Kafka):

```python
from confluent_kafka import avro
from confluent_kafka.avro import AvroProducer

# Load schema
value_schema = avro.load('fraud/FraudRiskScoreProduced.avsc')

# Create producer
producer = AvroProducer({
    'bootstrap.servers': 'kafka:9092',
    'schema.registry.url': 'http://schema-registry:8081'
}, default_value_schema=value_schema)

# Produce event
producer.produce(
    topic='turing.protocol.intelligence.fraud',
    value={
        'base': {
            'event_id': 'evt_01HQZX...',
            'tenant_id': 'CU_ALPHA',
            'origin': 'AI',
            'occurred_at': 1704067200000,
            'schema_version': '1.0',
            'hash_prev_event': None
        },
        'payment_id': 'pmt_01HQZY...',
        'customer_id': 'cust_01HQZZ...',
        'score_value': 0.92,
        'risk_band': 'HIGH',
        'model_id': 'fraud_ensemble_v1',
        'model_version': '1.2.0',
        'feature_set_version': '1.0',
        'confidence_interval': 0.88,
        'input_feature_hash': 'sha256:abc123...'
    }
)
```

## Production Readiness Checklist

- [ ] All schemas uploaded to Schema Registry
- [ ] AI Origin Command Blocker implemented in TuringCore
- [ ] Policy Gateway Validator implemented for all Risk Brain domains
- [ ] Schema validation enabled on all Kafka producers
- [ ] Schema evolution strategy defined (backward, forward, full compatibility)
- [ ] Event replay tested end-to-end
- [ ] Regulator audit pack generated from Protocol events
- [ ] Board + APRA sign-off obtained

## Success Criteria

**You have successfully integrated Protocol Schema Pack when:**

1. ✅ All Risk Brain outputs are Protocol events
2. ✅ No AI ever writes balances
3. ✅ All escalation is policy-gated
4. ✅ All outcomes are replayable
5. ✅ Posting Engine is the only money writer
6. ✅ AI-originated commands are blocked at Protocol boundary
7. ✅ Full audit trail exists for all ML/RL/AI decisions
8. ✅ Regulator can replay any incident end-to-end

**This is the schema foundation that makes TuringCore + Risk Brain v1 the most advanced, legally defensible, AI-aware banking platform in the world.**
