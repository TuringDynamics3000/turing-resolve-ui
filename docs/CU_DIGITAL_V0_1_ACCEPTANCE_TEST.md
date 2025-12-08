# CU-Digital v0.1 Acceptance Test

**Author:** Manus AI  
**Date:** 2025-01-15  
**Status:** Final

## 1. Purpose

The CU-Digital v0.1 Acceptance Test demonstrates that the TuringCore CU Edition:

- Maintains ledger correctness under realistic workloads.
- Enforces product and risk constraints (e.g., no unintended overdrafts).
- Preserves tenant isolation in a multi-tenant environment.
- Meets operational performance SLOs.
- Satisfies a basic CPS 230-aligned resilience test via controlled chaos (optional v0.1.1).

This test is **build-gating** for any release intended for CU pilots or production.

## 2. Test Topology

### Components

| Component | Description |
|---|---|
| **TuringCore** | Multi-tenant ledger and domain engine. |
| **CU_DIGITAL Tenant** | Synthetic digital credit union configured via `config/cu-digital.yaml`. |
| **Twin Orchestrator** | Test harness (`turingcore-cu-digital-twin` repo) with scenarios, generators, and invariants. |
| **Chaos Controller** | Fault injection mechanism. v0.1 uses `NoopChaosController`; v0.1.1+ will use a real K8s/AWS controller. |

### Environments

| Environment | Description |
|---|---|
| **DEV** | Mandatory for all builds. |
| **STAGE** | Recommended for pre-production validation. |
| **PROD** | Never runs chaos; may run steady-state invariants against a separate synthetic tenant. |

## 3. Scenarios

### 3.1 Steady-State Scenario (CU_DIGITAL_STEADY_STATE_V0_1)

**Config:** `config/steady-state.yaml`

**Workload Model:**
- **Customers:** 500 synthetic members with segments (YOUTH, RETAIL, SENIOR) and income bands (LOW, MEDIUM, HIGH).
- **Accounts:** Primary transaction account for all, plus savings, term deposits, cards, and loans based on segment/income heuristics.
- **Daily Activity:** Salary deposits, card/POS spend, bill payments, and savings sweeps, all as `PostEntry` commands.

### 3.2 Resilience Scenario (CU_DIGITAL_MSK_OUTAGE_5MIN_V0_1)

**Config:** `config/cu-chaos-msk-outage.yaml`

**Flow:**
1. Run the same steady-state scenario.
2. At t = 600s, inject a 5-minute outage on the KAFKA/ledger pipeline.
3. Continue to send commands.
4. Measure recovery using `LatencyRecorder` and the `check_rto_for_chaos_plan` invariant.

## 4. Invariants & Thresholds

### 4.1 Structural Invariants (Steady-State)

| Invariant | Definition | Threshold |
|---|---|---|
| `ledger_value_conserved_sampled` | Projection balance ≈ sum of event log postings. | 0 failures (±0.01 AUD) |
| `no_negative_balances_without_overdraft` | No account on a non-overdraft product may be negative. | 0 failures (< -0.01 AUD) |
| `multi_tenant_isolation_accounts_events` | Queries for CU_DIGITAL must not return other tenants' data. | 0 mismatched tenantIds |

### 4.2 Performance Invariant (Steady-State)

**`latency_slo`**

| Op type | p95 max (s) | p99 max (s) |
|---|---|---|
| `command:PostEntry` | 0.25 | 0.75 |
| `command:CreateCustomer` | 0.50 | 1.50 |
| `command:OpenAccount` | 0.50 | 1.50 |
| `read:get_account` | 0.25 | 0.75 |
| `read:list_accounts` | 0.50 | 1.50 |
| `read:get_account_events` | 1.00 | 3.00 |

### 4.3 Resilience Invariant (Chaos / CPS 230)

**`rto_for_chaos_plan`**

- **Definition:** For every OUTAGE chaos event, the system resumes successful `command:PostEntry` within a configured RTO.
- **Method:** RTO = `first_success.timestamp` – `outage_start`
- **Threshold:** RTO ≤ `rtoLimitSeconds` (e.g., 180s).

## 5. Execution Procedure

### 5.1 Steady-State Only

```bash
python -m twin_orchestrator.cli_steady_state \
  --tenant-config   config/cu-digital.yaml \
  --scenario-config config/steady-state.yaml \
  --base-url        $TURINGCORE_BASE_URL \
  --api-key         $TURINGCORE_API_KEY
```

**Pass criteria:** Exit code = 0; all structural + performance invariants pass.

### 5.2 Steady-State + Chaos (CPS 230 Chaos Pack v0.1)

```bash
python -m twin_orchestrator.cli_resilience \
  --tenant-config   config/cu-digital.yaml \
  --scenario-config config/steady-state.yaml \
  --chaos-config    config/cu-chaos-msk-outage.yaml \
  --base-url        $TURINGCORE_BASE_URL \
  --api-key         $TURINGCORE_API_KEY
```

**Pass criteria:** Exit code = 0; all CU invariants pass and `rto_for_chaos_plan` passes.

## 6. Outputs & Artefacts

- **JSON results:** Scenario metadata, per-invariant status, and latency stats.
- **Console summary (CI logs):** Pass/fail line, failure details, and latency summary.

These artefacts are attached to CI runs and can be exported for CU boards, auditors, or APRA evidence packs.
