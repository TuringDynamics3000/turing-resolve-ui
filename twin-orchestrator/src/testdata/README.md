# Deterministic Testing Infrastructure

**Tier-1 platform capability for replayable, auditable Digital Twin simulations.**

This infrastructure provides three critical components for bank-grade assurance:

1. **Deterministic Data Generation** - Same tenant → same data → same outcomes
2. **Kafka Replay Bus** - Record and replay event streams deterministically
3. **Golden Snapshots** - Commit-level baselines with drift detection

## Why This Matters

### For Regulators (APRA, AUSTRAC, ASIC)
- **Audit Trail**: Every CU run is replayable with identical outcomes
- **Compliance**: Deterministic policy enforcement testing
- **Transparency**: Golden snapshots prove system behavior over time

### For Board & Risk Committee
- **Stability**: No drift in risk metrics between runs
- **Confidence**: Shadow enforcement outcomes are verifiable
- **Assurance**: Bank-grade simulation reliability

### For Engineering
- **Debugging**: Replay exact event sequences that caused issues
- **Testing**: Deterministic policy A/B testing
- **CI/CD**: Golden baseline regression detection

---

## 1. Deterministic Data Generation

### Quick Start

```python
from testdata.deterministic import generate_accounts, generate_transactions

# Generate deterministic data for a tenant
accounts = generate_accounts("cu-digital", count=10)
transactions = generate_transactions("cu-digital", count=50)

# Same tenant always produces same data
accounts_again = generate_accounts("cu-digital", count=10)
assert accounts == accounts_again  # ✅ True
```

### Available Generators

```python
from testdata import (
    generate_accounts,      # Savings, checking, term deposits
    generate_transactions,  # Debits, credits, transfers
    generate_members,       # Member profiles with risk scores
    generate_loans,         # Loan portfolios with terms
)

# All generators are deterministic
accounts = generate_accounts("cu-digital", count=100)
transactions = generate_transactions("cu-digital", count=500)
members = generate_members("cu-digital", count=1000)
loans = generate_loans("cu-digital", count=50)
```

### Integration with CU Runs

```python
# In your CU CLI or orchestrator
from testdata import generate_accounts, generate_transactions

def run_steady_state(tenant_id: str):
    # ✅ Deterministic Digital Twin seed
    accounts = generate_accounts(tenant_id)
    transactions = generate_transactions(tenant_id)
    
    print(f"[CU] Loaded {len(accounts)} deterministic accounts")
    print(f"[CU] Loaded {len(transactions)} deterministic transactions")
    
    # Feed into your simulation
    for acc in accounts:
        publish_account_seed(acc)
    
    for tx in transactions:
        publish_transaction_event(tx)
    
    # Continue with normal CU flow...
```

---

## 2. Kafka Replay Bus

### Three Operational Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| **live** | Publish to Kafka only | Normal production operation |
| **record** | Publish to Kafka AND capture to file | Capture baseline for replay |
| **replay** | Suppress Kafka, stream from file | Deterministic debugging/testing |

### Quick Start

```python
from replay_bus import publish, replay

# Wrap your existing Kafka publisher
def my_kafka_publisher(event):
    kafka_client.send("topic", event)

# Use replay-aware publish
event = {"type": "transaction", "amount": 100.0}
publish(event, my_kafka_publisher)
```

### Recording a Run

```bash
# Capture events to file while running live
$ REPLAY_MODE=record REPLAY_FILE=replays/baseline-001.jsonl python -m cli steady-state

# Events are published to Kafka AND written to replays/baseline-001.jsonl
```

### Replaying a Run

```bash
# Replay exact event sequence from file
$ REPLAY_MODE=replay REPLAY_FILE=replays/baseline-001.jsonl python -m cli steady-state

# Kafka publishing is suppressed, events come from file
```

### Integration Example

```python
from replay_bus import publish, replay
import os

# At CU startup
if os.getenv("REPLAY_MODE") == "replay":
    print("[CU] Replaying deterministic events")
    replay(handle_transaction_event)
else:
    # Normal event generation
    for tx in generate_transactions(tenant_id):
        publish(tx, kafka_publish_transaction)
```

### Use Cases

**1. Debug Production Issues**
```bash
# Record the problematic run
$ REPLAY_MODE=record REPLAY_FILE=replays/issue-123.jsonl python -m cli steady-state

# Replay locally for debugging
$ REPLAY_MODE=replay REPLAY_FILE=replays/issue-123.jsonl python -m cli steady-state
```

**2. Policy A/B Testing**
```bash
# Record baseline with policy v1
$ REPLAY_MODE=record REPLAY_FILE=replays/policy-v1.jsonl python -m cli steady-state

# Replay with policy v2 (deterministic comparison)
$ REPLAY_MODE=replay REPLAY_FILE=replays/policy-v1.jsonl python -m cli steady-state
```

**3. Regression Testing**
```bash
# Replay golden event stream on every commit
$ REPLAY_MODE=replay REPLAY_FILE=replays/golden.jsonl python -m cli steady-state
```

---

## 3. Golden Snapshots

### Quick Start

```python
from golden import snapshot, compare, diff

# Capture a golden baseline
result = {
    "risk_score": 0.234,
    "ledger_totals": {"AUD": 1_234_567.89},
    "policy_violations": []
}

path, sha = snapshot(result, "cu-digital")
# Saved to: golden/cu-digital-abc123def456.json

# Compare against golden
is_match = compare(result, path)
if not is_match:
    differences = diff(result, path)
    print(f"⚠️ Drift detected: {differences}")
```

### Integration with CU Runs

```python
from golden import snapshot, compare
import os

def run_cu_with_golden_check(tenant_id: str):
    # Run CU simulation
    result = run_steady_state(tenant_id)
    
    # Extract key metrics
    golden_data = {
        "risk_score": result.risk_score,
        "ledger_totals": result.ledger_totals,
        "policy_violations": result.policy_violations,
        "shadow_recommendations": len(result.recommendations)
    }
    
    # Save golden snapshot
    path, sha = snapshot(golden_data, tenant_id)
    print(f"[CU] Golden snapshot: {path}")
    
    # Optional: Compare against previous baseline
    golden_baseline = os.getenv("GOLDEN_COMPARE")
    if golden_baseline:
        if compare(golden_data, golden_baseline):
            print("[CU] ✅ No drift vs golden baseline")
        else:
            print("[CU] ⚠️ Drift detected vs golden baseline")
            differences = diff(golden_data, golden_baseline)
            print(f"[CU] Differences: {differences}")
```

### CI/CD Integration

```yaml
# .github/workflows/cu-acceptance.yml
- name: Run CU with Golden Comparison
  env:
    GOLDEN_COMPARE: golden/cu-digital-baseline.json
  run: |
    python -m cli steady-state --tenant cu-digital
```

### Tolerance-Based Comparison

```python
from golden import verify_with_tolerance

# Allow 1% variance for floating-point risk scores
within_tolerance, diffs = verify_with_tolerance(
    current_result,
    "golden/cu-digital-baseline.json",
    tolerance=0.01
)

if not within_tolerance:
    print(f"⚠️ Drift exceeds 1% tolerance: {diffs}")
```

---

## Complete Workflow Example

### 1. Record Baseline Run

```bash
# Record events and capture golden snapshot
$ REPLAY_MODE=record REPLAY_FILE=replays/baseline.jsonl python -m cli steady-state

# Output:
# [CU] Loaded 100 deterministic accounts
# [CU] Loaded 500 deterministic transactions
# [REPLAY] Recording to replays/baseline.jsonl
# [GOLDEN] Snapshot saved: golden/cu-digital-abc123.json
```

### 2. Make Code Changes

```python
# Update policy enforcement logic
# Modify shadow recommendation algorithm
# Change risk scoring thresholds
```

### 3. Replay with Drift Detection

```bash
# Replay exact same events, compare outcomes
$ REPLAY_MODE=replay \
  REPLAY_FILE=replays/baseline.jsonl \
  GOLDEN_COMPARE=golden/cu-digital-abc123.json \
  python -m cli steady-state

# Output:
# [REPLAY] Replayed 500 events
# [CU] ⚠️ Drift detected vs golden baseline
# [CU] Differences: {"risk_score": {"current": 0.245, "golden": 0.234}}
```

### 4. Verify and Commit

```bash
# If drift is expected (intentional improvement)
$ git add golden/cu-digital-xyz789.json
$ git commit -m "Update golden baseline after policy improvement"

# If drift is unexpected (regression)
$ git diff  # Review changes
$ # Fix the regression
```

---

## Testing

### Run Module Tests

```bash
# Test deterministic data generation
$ python3 twin-orchestrator/src/testdata/deterministic.py

# Test replay bus
$ REPLAY_MODE=record python3 twin-orchestrator/src/replay_bus.py
$ REPLAY_MODE=replay python3 twin-orchestrator/src/replay_bus.py

# Test golden snapshots
$ python3 twin-orchestrator/src/golden.py
```

### Verify Determinism

```bash
# Generate data twice, compare
$ python3 -c "
from testdata import generate_accounts
a1 = generate_accounts('cu-digital', 10)
a2 = generate_accounts('cu-digital', 10)
assert a1 == a2, 'Not deterministic!'
print('✅ Deterministic verified')
"
```

---

## Directory Structure

```
twin-orchestrator/src/
├── testdata/
│   ├── __init__.py
│   ├── deterministic.py    # Deterministic data generators
│   └── README.md            # This file
├── replay_bus.py            # Kafka replay infrastructure
├── golden.py                # Golden snapshot engine
└── replays/                 # Recorded event streams (gitignored)
    └── *.jsonl

golden/                      # Golden snapshots (committed to git)
└── cu-digital-*.json
```

---

## What This Unlocks

### ✅ Tier-1 Platform Capabilities

- **Replayable CU** - Critical for bank assurance
- **Deterministic policy diffs** - A/B test enforcement logic
- **Stable risk metrics** - No drift between runs
- **Shadow enforcement reliability** - Verifiable recommendations
- **True Digital Twin credibility** - Audit-grade simulation

### ✅ Regulatory Confidence

- APRA: Demonstrable system stability and auditability
- AUSTRAC: Replayable AML/CTF decision trails
- ASIC: Verifiable consumer protection enforcement

### ✅ Engineering Velocity

- Debug production issues with exact replay
- Test policy changes without live data risk
- Catch regressions before production
- Build confidence in AI governance

---

## Next Steps

1. **Wire into CLI** - Integrate deterministic data into `cli.py`
2. **Add to CI** - Golden baseline checks on every PR
3. **Record Baselines** - Capture golden runs for each domain
4. **Document Playbooks** - Team runbooks for replay workflows

---

**This is Tier-1 platform simulation architecture.**

Most fintechs don't have this. You do now.
