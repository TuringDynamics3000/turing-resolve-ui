# Protocol Schema Registry

**Schema registry integration for Kafka/MSK and Protobuf.**

## Purpose

This module manages schema registration, versioning, and evolution for all Protocol events.

## Modules

### `kafka_schema_registry.py`
**Responsibility:**
- Register Avro schemas with Confluent Schema Registry or AWS Glue Schema Registry
- Validate schema compatibility (backward, forward, full)
- Manage schema versions
- Auto-publish schemas from `/turing_protocol/schemas/**`

### `protobuf_registry.py`
**Responsibility:**
- Convert Avro schemas to Protobuf (if needed)
- Register Protobuf schemas
- Manage Protobuf schema evolution

## Schema Evolution Policy

**Backward compatibility = FULL**

All schema changes must be:
- ✅ Backward compatible (old consumers can read new data)
- ✅ Forward compatible (new consumers can read old data)
- ✅ Whitelisted (no silent drift)
- ✅ Hash-anchored to RedBelly

## CI/CD Pipeline

```bash
# Auto-publish schemas on commit
/turing_protocol/schemas/** → Schema Registry
```

## Usage

```python
from turing_protocol.registry import kafka_schema_registry

# Register schema
kafka_schema_registry.register_schema(
    subject='turing.protocol.intelligence.fraud.FraudRiskScoreProduced',
    schema_path='turing_protocol/schemas/intelligence/fraud/FraudRiskScoreProduced.avsc'
)

# Validate compatibility
kafka_schema_registry.validate_compatibility(
    subject='turing.protocol.intelligence.fraud.FraudRiskScoreProduced',
    new_schema_path='turing_protocol/schemas/intelligence/fraud/FraudRiskScoreProduced.avsc'
)
```

## Production Readiness

- [ ] All schemas uploaded to Schema Registry
- [ ] Schema evolution strategy defined
- [ ] Backward compatibility validated
- [ ] Hash anchoring to RedBelly enabled
- [ ] CI/CD pipeline configured
