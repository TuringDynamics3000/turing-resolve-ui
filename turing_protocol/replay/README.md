# Protocol Replay Engine

**Full audit, replay, and legal defensibility for all intelligence events.**

## Purpose

This module enables end-to-end replay of any incident involving ML/RL/AI decisions.

## Modules

### `protocol_replay_engine.py`
**Responsibility:**
- Replay Protocol events from any point in time
- Reconstruct state from event log
- Validate event chain integrity
- Support time-travel queries

### `regulator_export.py`
**Responsibility:**
- Export Protocol events in regulator-required formats
- Generate audit packs for APRA/ASIC/AUSTRAC
- Produce court-admissible evidence chains

## Example: Fraud Block Replay

```
CardAuthorisationRequested
→ FraudRiskScoreProduced (from B)
→ HighFraudRiskFlagRaised (A policy)
→ HumanOverrideApproved
→ AutoBlockAuthorisationIssued
→ CardAuthorisationDeclined
```

You can prove:
- ✅ ML detected
- ✅ Policy authorised
- ✅ Human approved
- ✅ Core executed
- ✅ Scheme declined

**That's admissible under ASIC, AUSTRAC, and civil litigation.**

## Usage

```python
from turing_protocol.replay import protocol_replay_engine, regulator_export

# Replay incident
incident_events = protocol_replay_engine.replay_from_event_id('evt_01HQZX...')

# Export for regulator
audit_pack = regulator_export.generate_audit_pack(
    incident_id='INC-2024-001',
    event_ids=['evt_01HQZX...', 'evt_01HQZY...'],
    format='APRA_CPS_230'
)
```

## Court-Defensible Properties

- ✅ Full event provenance
- ✅ Immutable event log
- ✅ Hash-chained integrity
- ✅ RedBelly anchoring
- ✅ Time-travel safe
