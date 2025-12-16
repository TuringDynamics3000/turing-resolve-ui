# QUICKSTART — CU Digital Twin v0.1 (End-to-End Runbook)

**Objective:**  
Run a full CU Digital Twin scenario that proves:

- Events flow through A → Kafka → B (Risk Brain)
- All 4 B-domains activate in shadow
- Enforcement invariants hold (AI never executes)
- Metrics populate
- Weekly Board Pack + Regulator Annex generate
- Grafana shows live Risk Brain health

**This is the canonical golden path.**

---

## 0. What You Will Have at the End

After completing this guide, you will have:

✅ A running CU Digital Twin scenario  
✅ Shadow Payments RL, Fraud, AML, Treasury  
✅ Live Risk Brain Grafana dashboard  
✅ A generated Week-0 Board Pack PDF  
✅ A generated Week-0 Regulator Annex PDF  
✅ Mechanical proof that AI cannot execute

---

## 1. Prerequisites

### System

- Python 3.10+
- Docker + Docker Compose
- Make
- Git
- Node.js 18+ (only if you test UI later)

### Python Environment

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r twin-orchestrator/requirements.txt
```

---

## 2. Clone & Prepare

```bash
git clone https://github.com/TuringDynamics3000/turingcore-cu-digital-twin.git
cd turingcore-cu-digital-twin
```

Set environment:

```bash
cp twin-orchestrator/.env.example twin-orchestrator/.env
```

Edit `.env` only if you are pointing at non-local Kafka or Prometheus.

---

## 3. Start Core Infrastructure (A + Kafka + Metrics)

From repo root:

```bash
docker compose up -d
```

This must start:

- TuringCore (A-domain)
- Kafka / Redpanda
- Prometheus
- Grafana

Verify:

```bash
docker ps
```

You must see:

- `turingcore`
- `kafka` or `redpanda`
- `prometheus`
- `grafana`

---

## 4. Start Risk Brain (B-Domains)

Each B-domain runs as a shadow consumer.

From four separate terminals (or tmux):

### Payments RL (Shadow)

```bash
cd services/payments_rl_shadow
python consumer.py
```

### Fraud Shadow

```bash
cd services/fraud_shadow
python consumer.py
```

### AML Shadow

```bash
cd services/aml_shadow
python consumer.py
```

### Treasury RL (Shadow)

```bash
cd services/treasury_rl_shadow
python consumer.py
```

✅ **At this point:**

- All B-domains are live
- All are advisory-only
- None have execution credentials

---

## 5. Start the Digital Twin Orchestrator

From repo root:

```bash
cd twin-orchestrator
python cli.py --help
```

You should see scenario options.

---

## 6. Run the Canonical Golden Scenario

This is the official v0.1 reference scenario:

```bash
python cli.py run \
  --tenant cu_digital \
  --scenario steady_state_with_fraud_spike \
  --duration 10m
```

**What this injects:**

- Card payments
- Account transfers
- Merchant activity
- A controlled fraud spike
- Cross-border AML signals
- Treasury settlement pressure

✅ **This drives all four B-domains simultaneously.**

---

## 7. Verify Live Risk Brain Health (Grafana)

Open:

```
http://localhost:3000
```

Login:

- **User:** admin
- **Pass:** admin

Open dashboard:

```
Risk Brain – National Ops
```

Confirm:

✅ All domains = Shadow ON  
✅ Enforcement violations = 0  
✅ Customer impact = 0  
✅ Fraud/AML/Treasury counters increasing

**If any enforcement counter is non-zero → stop immediately (that's a P1 defect).**

---

## 8. Generate the Week-0 Board Pack

From repo root:

```bash
cd risk-brain-reporter
make generate-weekly WEEK=2025-W49 TENANT=cu_digital
```

Output path (example):

```
/risk-brain/weekly/cu_digital/risk-brain-week-2025-W49.pdf
```

Open the PDF and verify:

✅ Executive summary  
✅ Safety page with all zeros  
✅ Payments/Fraud/AML/Treasury populated  
✅ Governance attestation page present

---

## 9. Generate the Week-0 Regulator Annex

```bash
make generate-regulator \
  TENANT=cu_digital \
  START=2025-12-01 \
  END=2025-12-07
```

Output path:

```
/risk-brain/regulator/cu_digital/annex-2025-12-07.pdf
```

Verify:

✅ Safety invariants  
✅ Risk bands  
✅ Score percentiles  
✅ Event hash samples  
✅ Replay pointers

---

## 10. Kill-Switch Drill (Mandatory Safety Test)

From repo root:

```bash
cd tests/intelligence/harness
pytest fraud_kill_switch_drill.py
```

Expected result:

✅ Fraud domain halts  
✅ Advisory generation stops  
✅ Enforcement fires  
✅ No execution path opens  
✅ Metrics reflect kill-switch activation

Repeat for:

```bash
pytest aml_kill_switch_drill.py
pytest treasury_kill_switch_drill.py
```

---

## 11. Acceptance Test Gate (Formal)

Run:

```bash
pytest -m acceptance
```

This validates:

- Protocol invariants
- Schema conformance
- Enforcement invariants
- Twin orchestration
- B-domain isolation
- Governance artefact generation

✅ **All must pass before declaring a CU Digital Twin v0.1 build valid.**

---

## 12. Shutdown

```bash
docker compose down
```

Stop B-domains with Ctrl+C.

---

## ✅ What You Have Now Proven

By completing this quickstart you have mechanically demonstrated:

- Full A → B → Governance → Regulator replay pipeline
- Shadow AI across four risk domains
- Zero execution risk
- Immutable Board + Regulator artefacts
- Live operational visibility

**This is already board-demo and regulator-pre-engagement grade.**

---

## 🚀 Next Steps

### For Board Presentations

1. Use the generated board pack PDF
2. Walk through governance attestation
3. Emphasize mandatory safety statement

### For Regulator Pre-Engagement

1. Send regulator annex as pre-read
2. Use meeting walkthrough script from `risk-brain-reporter/samples/week-0/`
3. Emphasize formal non-execution assertion

### For CU Partner Demonstrations

1. Show board pack as proof of operational AI governance
2. Highlight category-leading governance vs slide-deck AI
3. Demonstrate weekly automated reporting

---

**Document Version:** 1.0  
**Last Updated:** 09 Dec 2025  
**Next Review:** After first production deployment
