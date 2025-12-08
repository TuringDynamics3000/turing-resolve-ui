# Protocol Validators - Legal Firewall

**This is the most important code in the entire system.**

These validators enforce the hard boundaries between Layer A (TuringCore) and Layer B (Risk Brain).

## Enforcement Modules

### `ai_origin_blocker.py`
**Purpose:** Enforces no-AI-writes-money rule

**Responsibility:**
- Reject any command with `origin = AI` that touches:
  - Ledger
  - Payments
  - Treasury
  - Account restrictions

**This is a regulatory control artefact, not just code.**

### `policy_gateway_validator.py`
**Purpose:** Forces ML/RL through deterministic rules

**Responsibility:**
- Validate that all ML/RL events pass through domain policy gateways
- Ensure no direct side effects from AI
- Guarantee deterministic policy translation

**This is a regulatory control artefact, not just code.**

### `schema_version_guard.py`
**Purpose:** Prevents silent schema drift

**Responsibility:**
- Validate schema versions on all intelligence events
- Prevent backward-incompatible changes
- Enforce schema registry compatibility

**This is APRA-critical.**

## Usage

These validators run on every intelligence event before it enters TuringCore:

```python
from turing_protocol.validators import ai_origin_blocker, policy_gateway_validator, schema_version_guard

# Every intelligence event must pass through all three validators
def process_intelligence_event(event):
    # 1. Schema version guard
    schema_version_guard.validate(event)
    
    # 2. AI origin blocker
    ai_origin_blocker.validate(event)
    
    # 3. Policy gateway validator
    policy_gateway_validator.validate(event)
    
    # Only if all validators pass, proceed to domain policy gateway
    return domain_policy_gateway.apply_policy(event)
```

## Court-Defensible Properties

With these validators in place:
- ✅ No AI ever writes balances
- ✅ All escalation is policy-gated
- ✅ All outcomes are replayable
- ✅ Schema drift is prevented
- ✅ Full audit trail exists

**Until these exist, Layer B must not connect to Layer A.**
