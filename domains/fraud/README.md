# Fraud Domain - Policy Gateway

**Deterministic policy translation for fraud ML events.**

## Purpose

This module translates fraud ML scores into deterministic domain commands.

## Policy Gateway

### `policy_gateway.py`
**Responsibility:**
- Receive `FraudRiskScoreProduced` events from Layer B
- Apply deterministic policy rules
- Emit allowed Layer A commands only

**This is a pure function with no side effects.**

## Policy Rules

```python
def apply_policy(event: FraudRiskScoreProduced) -> DomainCommand | None:
    """
    INPUT: FraudRiskScoreProduced
    RULE:
      IF score ≥ 0.90 AND CU_policy.auto_block_enabled = TRUE
      THEN emit AutoBlockAuthorisationIssued
      ELSE emit HighFraudRiskFlagRaised
    """
```

## Key Properties

- ✅ **ML does not block** - Only policy can authorise
- ✅ **Humans can still override** - Policy is not enforcement
- ✅ **Deterministic** - Same input always produces same output
- ✅ **No I/O** - Pure function
- ✅ **No money moves** - Only flags and advisories

## Domain Ownership

This policy is owned by the **Fraud Domain**, not the Protocol or Risk Brain.

This maintains:
- Domain ownership
- Deterministic behaviour
- Regulator separation of duties

## Usage

```python
from domains.fraud.policy_gateway import apply_policy

# Fraud ML score arrives from Layer B
fraud_score_event = FraudRiskScoreProduced(...)

# Apply deterministic policy
command = apply_policy(fraud_score_event)

# Command is either:
# - AutoBlockAuthorisationIssued (if auto-block enabled)
# - HighFraudRiskFlagRaised (if auto-block disabled)
# - None (if score below threshold)
```
