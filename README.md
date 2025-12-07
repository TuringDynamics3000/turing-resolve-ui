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

### Member Portal Demo

Reference digital banking UI for CU-Digital tenant:

- **Digital onboarding** with KYC/identity verification
- **Everyday banking** (balances, transfers, BPAY, NPP payments)
- **Loan applications** with AI-powered decisioning
- **Personal finance management** (spending insights, budgeting)
- **Real-time notifications** and alerts

### Observability Stack

Prometheus + Grafana + Loki providing "glass box" visibility:

- **Per-tenant SLOs** (latency, error rate, availability)
- **Event throughput and lag** (Kafka consumer metrics)
- **Invariant breach detection** (automated compliance monitoring)
- **Capacity planning** (resource utilization per tenant)
- **Fault injection outcomes** (CPS 230 resilience testing)

See [`docs/02-architecture.md`](docs/02-architecture.md) for detailed diagrams and component descriptions.

---

## 2. Repo Structure

```text
turingcore-cu-digital-twin/
├── README.md                           # This file
├── docs/                               # Design documentation
│   ├── 01-overview.md                  # Digital twin concept and objectives
│   ├── 02-architecture.md              # System architecture and diagrams
│   ├── 03-scenarios.md                 # Scenario definitions and use cases
│   ├── 04-demo-playbook.md             # Sales demo scripts and walkthroughs
│   └── 05-apra-cps230-234-walkthrough.md # Regulatory compliance demonstrations
├── infra/                              # Infrastructure as Code
│   ├── terraform/                      # AWS infrastructure provisioning
│   │   ├── main.tf                     # Main Terraform configuration
│   │   ├── vpc.tf                      # VPC and networking
│   │   ├── eks.tf                      # EKS cluster configuration
│   │   ├── rds-aurora.tf               # Database infrastructure
│   │   └── iam.tf                      # IAM roles and policies
│   ├── helm/                           # Helm charts and values
│   │   ├── Chart.yaml                  # Umbrella chart (optional)
│   │   ├── values-turingcore.yaml      # TuringCore-v3 deployment config
│   │   ├── values-monitoring.yaml      # Observability stack config
│   │   ├── values-operator-console.yaml # Operator console config
│   │   └── values-member-portal.yaml   # Member portal config
│   └── k8s/                            # Kubernetes manifests
│       ├── namespaces.yaml             # Namespace definitions
│       ├── network-policies.yaml       # Network isolation policies
│       └── ingress.yaml                # Ingress controller configuration
├── twin-orchestrator/                  # Scenario engine and data generators
│   ├── src/
│   │   ├── __init__.py
│   │   ├── main.py                     # CLI entrypoint
│   │   ├── api_client.py               # TuringCore API wrapper
│   │   ├── generators/                 # Synthetic data generators
│   │   │   ├── customers.py            # Customer/member generation
│   │   │   ├── accounts.py             # Account creation
│   │   │   ├── loans.py                # Loan application and servicing
│   │   │   ├── transactions.py         # Transaction generation
│   │   │   └── events.py               # Event stream generation
│   │   └── scenarios/                  # Scenario implementations
│   │       ├── base.py                 # Base scenario class
│   │       ├── scenario_recession.py   # Economic downturn simulation
│   │       ├── scenario_fraud_spike.py # Fraud detection testing
│   │       └── scenario_outage_recovery.py # CPS 230 resilience testing
│   ├── config/
│   │   ├── tenants/                    # Tenant configuration files
│   │   │   ├── cu-small.yaml           # Small credit union (5K members)
│   │   │   ├── cu-mid.yaml             # Medium credit union (25K members)
│   │   │   ├── cu-large.yaml           # Large credit union (75K members)
│   │   │   └── cu-digital.yaml         # Digital-only neobank (10K members)
│   │   └── scenarios/                  # Scenario configuration files
│   │       ├── recession.yaml          # Recession scenario parameters
│   │       ├── fraud-spike.yaml        # Fraud spike scenario parameters
│   │       └── outage-recovery.yaml    # Outage recovery scenario parameters
│   └── tests/                          # Unit and integration tests
├── operator-console/                   # Back-office UI (React/TypeScript)
│   ├── README.md
│   ├── package.json
│   └── src/
│       ├── App.tsx                     # Main application component
│       ├── components/                 # Reusable UI components
│       ├── pages/                      # Page components
│       └── api/                        # API client for TuringCore + observability
├── member-portal-demo/                 # Reference digital banking UI
│   ├── README.md
│   ├── package.json
│   └── src/
│       ├── App.tsx                     # Main application component
│       ├── components/                 # Reusable UI components
│       ├── pages/                      # Page components
│       └── api/                        # API client for TuringCore
├── observability/                      # Monitoring and observability
│   ├── grafana/
│   │   └── dashboards/                 # Grafana dashboard definitions
│   │       ├── turingcore-overview.json # Platform-wide metrics
│   │       ├── tenant-slo.json         # Per-tenant SLO tracking
│   │       └── invariants.json         # Compliance invariant monitoring
│   ├── prometheus/
│   │   └── rules/                      # Prometheus rules
│   │       ├── alerting-rules.yaml     # Alert definitions
│   │       └── recording-rules.yaml    # Recording rules for aggregations
│   └── loki/
│       └── config.yaml                 # Loki logging configuration
└── scripts/                            # Convenience scripts
    ├── bootstrap_cluster.sh            # Initial cluster setup
    ├── deploy_all.sh                   # Deploy all components
    ├── seed_tenants.sh                 # Create and seed synthetic tenants
    └── run_scenario.sh                 # Execute a specific scenario
```

---

## 3. Prerequisites

### Infrastructure

- **AWS account** with permissions to create:
  - VPC, subnets, security groups
  - EKS cluster (Kubernetes 1.28+)
  - RDS/Aurora PostgreSQL (or equivalent)
  - MSK (Managed Streaming for Kafka) or self-hosted Kafka
  - IAM roles and policies

### Local Tools

- **kubectl** (1.28+) – Kubernetes CLI
- **Helm** (3.12+) – Kubernetes package manager
- **Terraform** (1.5+) – Infrastructure as Code (if using provided modules)
- **Python** (3.11+) – For twin orchestrator
- **Node.js** (18+) – For UI components

### TuringCore-v3 Access

- Access to TuringCore-v3 container images:
  - e.g., `xxx.dkr.ecr.ap-southeast-2.amazonaws.com/turingcore-v3:<tag>`
- Access to TuringCore-v3 Helm chart repository
- TuringCore CI/CD configured to publish images and chart versions

---

## 4. Getting Started

### 4.1 Provision Infrastructure

From `infra/terraform`:

```bash
cd infra/terraform
terraform init
terraform apply
```

This will create:
- VPC with public and private subnets
- EKS cluster with managed node groups
- RDS/Aurora PostgreSQL cluster (optional, can use in-cluster PostgreSQL)
- MSK cluster for Kafka (optional, can use in-cluster Kafka)
- IAM roles for service accounts

Update your kubeconfig to point at the new cluster:

```bash
aws eks update-kubeconfig --name turingcore-digital-twin --region ap-southeast-2
```

### 4.2 Deploy TuringCore-v3

From `infra/helm`:

```bash
cd infra/helm

# Add TuringCore Helm repository
helm repo add turingcore https://charts.turingdynamics3000.com
helm repo update

# Deploy TuringCore-v3 to turingcore namespace
helm upgrade --install turingcore turingcore/turingcore-v3 \
  --namespace turingcore \
  --create-namespace \
  -f values-turingcore.yaml
```

**Note:** This repository does not contain TuringCore-v3 source code. It assumes TuringCore is published as a Helm chart and container image.

### 4.3 Deploy Observability Stack

```bash
# Deploy Prometheus, Grafana, Loki
helm upgrade --install observability prometheus-community/kube-prometheus-stack \
  --namespace cu-digital-twin \
  --create-namespace \
  -f values-monitoring.yaml
```

### 4.4 Deploy Operator Console and Member Portal

```bash
# Deploy operator console (back-office UI)
helm upgrade --install operator-console ./operator-console-helm \
  --namespace cu-digital-twin \
  -f values-operator-console.yaml

# Deploy member portal (digital banking UI)
helm upgrade --install member-portal ./member-portal-helm \
  --namespace cu-digital-twin \
  -f values-member-portal.yaml
```

### 4.5 Seed Tenants and Run Scenarios

From `twin-orchestrator/`:

```bash
cd twin-orchestrator

# Install Python dependencies
pip install -r requirements.txt

# Configure API endpoint and credentials for TuringCore-v3
cp .env.example .env
# Edit .env with TuringCore API endpoint and credentials

# Create synthetic tenants and seed initial data
python -m twin_orchestrator.main seed-tenants \
  --config config/tenants/cu-small.yaml \
  --config config/tenants/cu-mid.yaml \
  --config config/tenants/cu-large.yaml \
  --config config/tenants/cu-digital.yaml

# Run a sample scenario (12 months of normal operations)
python -m twin_orchestrator.main run-scenario \
  --scenario config/scenarios/steady-state.yaml
```

### 4.6 Access the Digital Twin

After deployment, you can access:

- **Operator Console:** `https://operator.cu-digital-twin.example.com`
- **Member Portal (CU-Digital):** `https://banking.cu-digital.example.com`
- **Grafana Dashboards:** `https://grafana.cu-digital-twin.example.com`

---

## 5. Scenarios

The digital twin supports multiple pre-defined scenarios for demonstration and testing:

### Steady State
Normal economic conditions with baseline performance metrics. Used for establishing performance benchmarks and SLO baselines.

### Recession
Simulates economic downturn with:
- Rising loan arrears (3% → 8%)
- Increased credit risk scores
- Stress on capital and liquidity metrics
- Member hardship requests
- Portfolio rebalancing by AI agents

### Fraud Spike
Simulates coordinated fraud attack with:
- Account takeover attempts
- Suspicious transaction patterns
- AML/CTF alert generation
- Real-time fraud detection by Agentic AI
- Compliance agent responses

### Outage & Recovery (CPS 230 Alignment)
Demonstrates operational resilience:
- Simulated node/zone failure
- Automated failover to secondary AZ
- Event replay and state reconstruction
- Zero data loss verification
- Recovery time measurement

Each scenario is defined declaratively under `twin-orchestrator/config/scenarios/*.yaml` and executed by the orchestrator purely through TuringCore commands and events.

See [`docs/03-scenarios.md`](docs/03-scenarios.md) for detailed scenario descriptions and expected outcomes.

---

## 6. Design Principles

### Consumer-First
This repository behaves like a real credit union consuming TuringCore-v3. No special backdoors or privileged access.

### Protocol Compliance
All interactions follow the Turing Protocol. All changes go through public APIs and command/event flows.

### Reproducible
Entire environment is Infrastructure as Code. One command should recreate the entire digital twin from scratch.

### Safe Data
Only synthetic data is generated. No real PII ever touches this cluster. All data is clearly marked as synthetic.

### Regulator-Friendly
Everything needed to demonstrate CPS 230/234/CDR compliance is visible, auditable, and exportable.

### Multi-Tenant Proof
Demonstrates true multi-tenant SaaS capabilities with:
- Sub-second tenant provisioning
- PostgreSQL RLS isolation verification
- Per-tenant performance metrics
- Shared infrastructure economics

---

## 7. Use Cases

### Sales Demonstrations
- **Live CU in a browser:** Show prospects a working credit union, not slides
- **Multi-tenant isolation:** Prove data isolation with side-by-side tenant views
- **Performance at scale:** Demonstrate 200K events/sec, 46K customers/sec
- **Feature showcase:** Digital onboarding, AI lending, real-time payments

### Regulatory Walkthroughs
- **APRA CPS 230:** Operational resilience and outage recovery
- **APRA CPS 234:** Information security and incident response
- **CDR (Open Banking):** Data sharing consent flows and API compliance
- **AML/CTF:** Transaction monitoring and suspicious activity reporting

### Partner Integration Testing
- **Fintech sandbox:** Allow partners to test integrations in safe environment
- **API documentation:** Live API examples with real (synthetic) data
- **Performance testing:** Validate integration performance under load
- **Compliance testing:** Verify partner integrations maintain compliance

### Internal Development
- **Feature validation:** Test new features in realistic multi-tenant environment
- **Performance benchmarking:** Establish baseline metrics for optimization
- **Scenario testing:** Validate system behavior under various conditions
- **Training environment:** Onboard new team members with realistic data

---

## 8. Roadmap

### v0.1 – Foundation (Current)
- ✅ Repository structure and documentation
- ✅ Infrastructure as Code (Terraform)
- ✅ Single tenant (CU-Digital) with basic seeding
- ✅ Steady-state scenario
- ✅ Basic observability dashboards

### v0.2 – Multi-Tenant Proof (Next)
- 🔄 Four tenant archetypes (Small, Mid, Large, Digital)
- 🔄 Recession and fraud spike scenarios
- 🔄 Per-tenant SLO dashboards
- 🔄 Operator console with multi-tenant views
- 🔄 Member portal demo for CU-Digital

### v0.3 – Regulatory Compliance (Q1 2026)
- ⏳ CPS 230 outage and recovery scenarios
- ⏳ CPS 234 security incident simulations
- ⏳ CDR consent flows and data sharing
- ⏳ APRA-style reporting extracts
- ⏳ Compliance invariant monitoring

### v1.0 – Production-Ready Demo (Q2 2026)
- ⏳ Packaged "prospect demo" preset
- ⏳ "Regulator walkthrough" preset
- ⏳ Self-service scripts for common tasks
- ⏳ Comprehensive documentation
- ⏳ Video walkthroughs and tutorials

---

## 9. Contributing

This is an internal repository for TuringDynamics3000. Contributions should:

1. Reference roadmap items and link to design docs in `docs/`
2. Follow the Turing Protocol for all TuringCore interactions
3. Include tests for new scenarios or generators
4. Update documentation for new features
5. Maintain the "consumer-first" principle (no backdoors)

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for detailed guidelines.

---

## 10. License

Copyright © 2025 TuringDynamics3000. All rights reserved.

This repository contains proprietary software and documentation. Unauthorized copying, distribution, or use is strictly prohibited.

---

## 11. Support

For questions or issues:

- **Internal Team:** Slack #turingcore-digital-twin
- **Documentation:** See `docs/` directory
- **Issues:** GitHub Issues in this repository

---

**Built with TuringCore-v3** – The first true multi-tenant SaaS core banking platform for Australian credit unions.
