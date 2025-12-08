# TuringCore CU Digital Twin

A **synthetic, multi-tenant Credit Union environment** running on top of **TuringCore-v3**.

This repository provisions a full **digital twin** of several archetypal Australian credit unions (small, mid, large, digital-only) using synthetic data, realistic transaction flows, and pre-built scenarios for:

- **Functional and performance validation** of TuringCore-v3
- **Sales demonstrations** (live CU in a browser, not slides)
- **APRA CPS 230 / CPS 234 / CDR walkthroughs** for regulatory compliance
- **Fintech partner sandbox** and integration testing
- **Multi-tenant SaaS proof** for credit union prospects

TuringCore-v3 itself lives in [`TuringCore-v3`](https://github.com/TuringDynamics3000/TuringCore-v3) and is consumed here **only via container images, Helm charts and APIs**, exactly as a real credit union would deploy it.

---

## 🚀 Quick Start

**New here?** Start with the end-to-end runbook:

👉 **[QUICKSTART.md](QUICKSTART.md)** — Run the full CU Digital Twin scenario in 30 minutes

**Want a one-command demo?** Use the Docker demo stack:

👉 **[DOCKER_DEMO.md](DOCKER_DEMO.md)** — One-command Docker demo with Prometheus + Grafana

**Want a desktop app?** Use the Windows launcher:

👉 **[DESKTOP_APP_SETUP.md](DESKTOP_APP_SETUP.md)** — One-click Windows desktop app with cinematic boot

**Want to know what's done?** Check the unified truth file:

👉 **[STATUS.md](STATUS.md)** — Single authoritative status declaration for the platform

---

## 1. Architecture Overview

At a high level, the digital twin consists of:

### Infrastructure

An **AWS EKS cluster** hosts two primary namespaces:

- **`turingcore` namespace** – TuringCore-v3 services + PostgreSQL/Aurora + Kafka/MSK
- **`cu-digital-twin` namespace** – Twin orchestrator, UIs, observability stack

### Twin Orchestrator

The orchestrator is the heart of the digital twin:

- Communicates with TuringCore-v3 over authenticated APIs
- Creates synthetic tenants representing different credit union archetypes:
  - **CU-Small** (5,000 members, basic products)
  - **CU-Mid** (25,000 members, full product suite)
  - **CU-Large** (75,000 members, complex operations)
  - **CU-Digital** (10,000 members, digital-first neobank)
- Generates synthetic customers, accounts, loans and transactions via Turing Protocol commands
- Runs time-warped scenarios (e.g., 3 years of activity compressed into 1 hour)
- Validates event sourcing, invariants, and compliance through scenario execution

### Operator Console

Back-office web UI exposing:

- **Customer/account search** across all tenants
- **Raw event timeline inspection** with cryptographic integrity verification
- **Compliance invariant monitoring** (5 testable invariants from Turing Protocol)
- **CPS 230/234 scenario visualization** (outage recovery, failover testing)
- **Multi-tenant isolation verification** (PostgreSQL RLS enforcement)

### Member Portal

Customer-facing web UI for each synthetic CU:

- **Account balances and transaction history**
- **Loan applications and statements**
- **Card management**
- **Payments and transfers**
- **CDR consent management**

---

## 2. National Risk Brain (B-Domains)

The digital twin includes the **National Risk Brain** — four shadow AI domains that run in parallel with the core ledger:

| Domain | Status | Description |
|--------|--------|-------------|
| **Payments RL Shadow** | ✅ Production-Ready | Advisory-only routing optimisation |
| **Fraud Shadow** | ✅ Production-Ready | Transaction anomaly detection |
| **AML Shadow** | ✅ Production-Ready | Behavioural AML/CTF detection |
| **Treasury RL Shadow** | ✅ Production-Ready | Liquidity stress & buffer forecasting |

**Key Properties:**

- ✅ **Advisory-only** (no execution authority)
- ✅ **Mechanically enforced** (IAM + network + CI + runtime guards)
- ✅ **Board-visible** (weekly governance artefacts)
- ✅ **Regulator-ready** (forensic replay packs)

---

## 3. Risk Brain Reporter (Governance Layer)

The **Risk Brain Reporter** auto-generates weekly governance artefacts:

- **Weekly Board Pack** (PDF) — Executive summary, domain summaries, governance attestation
- **Regulator Forensic Annex** (PDF) — Safety invariants, risk bands, replay pointers
- **Regulator Meeting Walkthrough Script** — Verbatim speaking guide for pre-engagement

**Sample Outputs:**

- [Week-0 Board Pack](risk-brain-reporter/samples/week-0/board-pack-network-2025-W49.pdf)
- [Week-0 Regulator Annex](risk-brain-reporter/samples/week-0/regulator-annex-network-2025-W49.pdf)
- [Regulator Meeting Script](risk-brain-reporter/samples/week-0/regulator-meeting-walkthrough-script.md)

---

## 4. Repository Structure

```
turingcore-cu-digital-twin/
├── QUICKSTART.md                    # 🚀 Start here
├── STATUS.md                        # Single authoritative status declaration
├── README.md                        # This file
│
├── services/                        # B-Domain shadow consumers
│   ├── payments_rl_shadow/          # Payments RL Shadow consumer
│   ├── fraud_shadow/                # Fraud Shadow consumer
│   ├── aml_shadow/                  # AML Shadow consumer
│   └── treasury_rl_shadow/          # Treasury RL Shadow consumer
│
├── domains/                         # A-Domain policy gateways
│   ├── payments/                    # Payments policy gateway
│   ├── fraud/                       # Fraud policy gateway
│   ├── aml/                         # AML policy gateway
│   └── treasury/                    # Treasury policy gateway
│
├── enforcement/                     # Enforcement layer (AI origin blocker, schema guard, policy validator)
│   ├── ai_origin_blocker.py
│   ├── schema_version_guard.py
│   └── policy_gateway_validator.py
│
├── risk_brain_reporter/            # Governance artefact generator
│   ├── cmd/                         # Go entry points (weekly-job, api)
│   ├── internal/                    # Internal packages (snapshot, renderer, storage, metrics)
│   ├── deploy/                      # Helm charts and Terraform modules
│   ├── samples/week-0/              # Week-0 sample outputs (board pack, regulator annex, meeting script)
│   └── README.md
│
├── risk_metrics/                    # Ops metrics aggregators
│   ├── payments_rl_metrics_aggregator.py
│   └── weekly_board_report.py
│
├── risk_harness/                    # CI harness for safety validation
│   ├── fraud/                       # Fraud shadow tests
│   ├── aml/                         # AML shadow tests
│   └── treasury/                    # Treasury shadow tests
│
├── twin-orchestrator/               # Digital twin orchestrator
│   ├── cli.py                       # CLI entry point
│   ├── scenarios/                   # Scenario definitions
│   └── README.md
│
├── infra/                           # Infrastructure as code
│   ├── aws/                         # Terraform modules (S3, IAM, EKS)
│   └── k8s/                         # Kubernetes manifests (CronJob, Deployment, NetworkPolicy)
│
├── tests/                           # Test suites
│   └── intelligence/                # Intelligence layer tests
│
└── docs/                            # Documentation
    └── regulator-briefing/          # Regulator pre-engagement briefing pack
```

---

## 5. Getting Started

### Prerequisites

- Python 3.10+
- Docker + Docker Compose
- Make
- Git
- Node.js 18+ (optional, for UI)

### Quick Start

Follow the [QUICKSTART.md](QUICKSTART.md) guide to run the full CU Digital Twin scenario in 30 minutes.

### Status

Check [STATUS.md](STATUS.md) for the current platform status and what's done vs in progress vs out of scope.

---

## 6. Key Features

### For Boards

✅ AI is clearly active  
✅ AI is generating intelligence  
✅ AI is not executing  
✅ Risk posture is measurable  
✅ Safety is mechanically enforced

### For Regulators

✅ Non-execution is provable  
✅ Replay is available  
✅ Escalation thresholds are explicit  
✅ Behavioural drift is quantified

### For Commercial Partners

✅ This is category-leading governance  
✅ This is not slide-deck AI  
✅ This is operational AI oversight

---

## 7. Strategic Position

> The system is **already regulator-pre-engagement grade** in shadow mode.  
> The only remaining risk is **demo coherence**, not safety, legality, or governance.

You can safely:
- Run CU board demos
- Conduct APRA / AUSTRAC / ASIC pre-engagements
- Use the Digital Twin as your default TuringCore integration gate

---

## 8. License

Proprietary — Turing Dynamics 3000 Pty Ltd

---

## 9. Contact

For questions or access requests:

- **Technical:** Platform Architecture Team
- **Commercial:** Business Development Team
- **Regulatory:** Chief Risk Officer

---

**Document Version:** 1.0  
**Last Updated:** 09 Dec 2025  
**Next Review:** After first production deployment
