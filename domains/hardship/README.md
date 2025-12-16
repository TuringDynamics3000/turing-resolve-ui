# Hardship Domain - Policy Gateway

**Deterministic policy translation for hardship ML events.**

## Purpose

This module translates hardship ML scores into deterministic domain commands.

## Policy Gateway

### `policy_gateway.py`
**Responsibility:**
- Receive `HardshipRiskScoreProduced` events from Layer B
- Apply deterministic policy rules
- Emit allowed Layer A commands only

**This is a pure function with no side effects.**

## Policy Rules

```python
def apply_policy(event: HardshipRiskScoreProduced) -> DomainCommand | None:
    """
    INPUT: HardshipRiskScoreProduced
    RULE:
      IF score ≥ 0.75
      THEN emit HardshipRiskFlagRaised
    
    Only humans can then initiate:
    - ProactiveCustomerOutreachInitiated
    - HardshipArrangementEntered
    """
```

## Key Properties

- ✅ **ML does not contact customers** - Only humans can initiate outreach
- ✅ **ML does not modify balances** - Only humans can enter hardship arrangements
- ✅ **Deterministic** - Same input always produces same output
- ✅ **No I/O** - Pure function
- ✅ **No money moves** - Only flags for human review

## Domain Ownership

This policy is owned by the **Hardship Domain**, not the Protocol or Risk Brain.

This maintains:
- Domain ownership
- Deterministic behaviour
- Regulator separation of duties
- CPS-230 compliance

## Usage

```python
from domains.hardship.policy_gateway import apply_policy

# Hardship ML score arrives from Layer B
hardship_score_event = HardshipRiskScoreProduced(...)

# Apply deterministic policy
command = apply_policy(hardship_score_event)

# Command is either:
# - HardshipRiskFlagRaised (if score ≥ 0.75)
# - None (if score below threshold)

# Human hardship officers then decide:
# - Initiate proactive customer outreach
# - Enter hardship arrangement
# - No action required
```
