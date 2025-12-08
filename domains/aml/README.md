# AML Domain - Policy Gateway

**Deterministic policy translation for AML ML events.**

## Purpose

This module translates AML ML scores into deterministic domain commands.

## Policy Gateway

### `policy_gateway.py`
**Responsibility:**
- Receive `AmlRiskScoreProduced` events from Layer B
- Apply deterministic policy rules
- Emit allowed Layer A commands only

**This is a pure function with no side effects.**

## Policy Rules

```python
def apply_policy(event: AmlRiskScoreProduced) -> DomainCommand | None:
    """
    INPUT: AmlRiskScoreProduced
    RULE:
      IF score ≥ 0.85
      THEN emit HighAmlRiskFlagRaised
    
    From here:
    Only human investigators can create:
    - SuspiciousMatterReportSubmitted
    - AccountRestrictionAuthorised
    """
```

## Key Properties

- ✅ **ML does not file SMRs** - Only humans can submit to AUSTRAC
- ✅ **ML does not freeze accounts** - Only humans can authorise restrictions
- ✅ **Deterministic** - Same input always produces same output
- ✅ **No I/O** - Pure function
- ✅ **No money moves** - Only flags for investigation

## Domain Ownership

This policy is owned by the **AML Domain**, not the Protocol or Risk Brain.

This maintains:
- Domain ownership
- Deterministic behaviour
- Regulator separation of duties
- AUSTRAC compliance

## Usage

```python
from domains.aml.policy_gateway import apply_policy

# AML ML score arrives from Layer B
aml_score_event = AmlRiskScoreProduced(...)

# Apply deterministic policy
command = apply_policy(aml_score_event)

# Command is either:
# - HighAmlRiskFlagRaised (if score ≥ 0.85)
# - None (if score below threshold)

# Human investigators then decide:
# - Open investigation
# - Submit SMR to AUSTRAC
# - Authorise account restriction
```
