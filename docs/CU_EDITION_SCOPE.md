# TuringCore CU Edition – Scope and Contract

**Product Slice for Credit Unions**

**Version:** 1.0  
**Date:** 2025-01-15  
**Status:** Product Specification

---

## 1. Purpose

TuringCore **CU Edition** is the product slice we sell to credit unions:

- Built entirely on top of **Ring-0 Turing Protocol Core**
- Constrained to the features and APIs a CU needs for day-to-day banking
- Packaged with a standard cloud deployment and test artifacts

This document defines **what's in** CU Edition v1.0.0 and the **contract** we expose to CUs.

---

## 2. Dependencies

CU Edition depends on:

### 2.1 Ring-0 Core vX.Y.Z

**Required Components:**
- Protocol (command envelopes, event envelopes, validation)
- Tenants (creation, lifecycle, isolation)
- Ledger (multi-leg postings, double-entry, balances)
- Event store (append-only, immutable)
- Projections (accounts, customers, transactions, balances)
- Basic deposits and payments

**Version Compatibility:**
- CU Edition 1.0.0 requires Ring-0 Core 1.x.x
- CU Edition 2.0.0 requires Ring-0 Core 2.x.x

---

### 2.2 Explicitly NOT Dependent On

CU Edition does **NOT** depend on:

- ❌ Wealth / investments domains
- ❌ iCattle or other non-CU verticals
- ❌ Experimental ML/analytics modules
- ❌ UI frameworks (member portal, operator console)
- ❌ Data products, Data Mesh

**These are Ring-1+ services that may coexist but are not part of CU Edition.**

---

## 3. Functional Scope (v1.0.0)

### 3.1 Included Features

#### 3.1.1 Tenancy & Onboarding

**Tenant Management:**
- Create and manage CU tenant (one tenant per CU)
- Tenant configuration:
  - `tenantCode` (e.g., "CU_DIGITAL")
  - `displayName` (e.g., "CU Digital Twin")
  - `baseCurrency` (e.g., "AUD")
  - `timeZone` (e.g., "Australia/Sydney")
  - `region` (e.g., "ap-southeast-2")

**Tenant Lifecycle:**
- Create tenant
- Update tenant configuration
- Suspend tenant (for maintenance)
- Archive tenant (for decommissioning)

---

#### 3.1.2 Product Catalogue (Core Retail)

**Everyday Transaction Accounts:**
- Basic transaction account (free)
- Premium transaction account (with benefits)
- Youth transaction account (under 25)

**Online Saver Accounts:**
- Standard savings account
- High-interest savings account (with conditions)
- Youth savings account (under 25)

**Term Deposits:**
- 3-month term deposit
- 6-month term deposit
- 12-month term deposit
- (Optional if Ring-0 supports)

**Basic GL Structure:**
- Customer accounts ↔ clearing ↔ suspense
- GL accounts for internal transfers
- GL accounts for external payments

---

#### 3.1.3 Customer Management

**Retail Customers (Individuals):**
- Customer creation with KYC details:
  - Full name (first, middle, last)
  - Date of birth
  - Email, phone
  - Address (street, city, state, postcode, country)
  - Tax ID (TFN in Australia)
  
**KYC Status Fields:**
- KYC status (PENDING, VERIFIED, REJECTED)
- Risk segment (LOW, MEDIUM, HIGH)
- AML status (CLEAR, REVIEW, BLOCKED)

**Note:** CU controls full KYC orchestration via upstream systems. Ring-0 only stores status.

---

#### 3.1.4 Accounts & Balances

**Account Operations:**
- Open account (for customer, linked to product)
- Close account (with zero balance)
- Update account status (ACTIVE, SUSPENDED, CLOSED)

**Real-Time Balances:**
- Current balance (all cleared transactions)
- Available balance (current - holds)
- Ledger balance (current + pending)

**Transaction History:**
- Query transactions for account
- Filter by date range, type, amount
- Pagination support

---

#### 3.1.5 Internal Transfers

**Account-to-Account Transfers:**
- Same-tenant only
- Real-time settlement
- Validation:
  - Sufficient available balance
  - Accounts in ACTIVE status
  - No holds preventing transfer

**Transfer Types:**
- Member-to-member
- Member-to-GL (fees, interest)
- GL-to-member (salary, refunds)

---

#### 3.1.6 Payments Skeleton

**Outbound/Inbound Payment Posting Semantics:**
- PostEntry command for payment postings
- Multi-leg postings (customer account ↔ clearing ↔ external)

**Integration Points (Connectors) for:**
- **NPP (New Payments Platform)** - Real-time payments
- **BPAY** - Bill payments
- **Direct Entry** - Batch payments

**Note:** Scheme-specific logic lives in **outer services** (Ring-1+), not embedded in ledger logic.

---

### 3.2 Excluded for v1.0.0 (Future Scope)

**Advanced Banking:**
- ❌ Full lending lifecycle (beyond simple "personal loan" experiment)
- ❌ Cards issuing/processing core
- ❌ Complex fee engines and campaign pricing
- ❌ Business banking, treasury, sophisticated GL/reporting
- ❌ Wealth management, investments

**Advanced Features:**
- ❌ Fraud detection algorithms
- ❌ AML/KYC orchestration (only status storage)
- ❌ Credit scoring, risk models
- ❌ Marketing automation, CRM integration

**UI/Dashboards:**
- ❌ Member portal (separate Ring-1+ service)
- ❌ Operator console (separate Ring-1+ service)
- ❌ Reporting dashboards (separate Ring-1+ service)

---

## 4. API Surface (CU-Facing)

CU Edition offers a **narrow, stable API** subset.

### 4.1 Commands (via Command Gateway)

All commands are submitted via:

```
POST /tenants/{tenantId}/commands
```

**Command Types:**

#### 4.1.1 CreateTenant

**Purpose:** Create new CU tenant

**Payload:**
```json
{
  "commandType": "CreateTenant",
  "payload": {
    "tenantCode": "CU_DIGITAL",
    "displayName": "CU Digital Twin",
    "baseCurrency": "AUD",
    "timeZone": "Australia/Sydney",
    "region": "ap-southeast-2"
  }
}
```

---

#### 4.1.2 UpsertProduct

**Purpose:** Create or update product configuration

**Payload:**
```json
{
  "commandType": "UpsertProduct",
  "payload": {
    "productCode": "TXN_ACCOUNT_BASIC",
    "productType": "DEPOSIT",
    "displayName": "Basic Transaction Account",
    "description": "Free everyday banking",
    "interest": {
      "rate": 0.0,
      "calculationMethod": "SIMPLE",
      "accrualFrequency": "DAILY"
    },
    "fees": {
      "monthlyFee": 0.0,
      "transactionFee": 0.0
    },
    "features": ["NPP", "BPAY", "APPLE_PAY"],
    "limits": {
      "minBalance": 0.0,
      "maxBalance": null,
      "dailyWithdrawalLimit": 1000.0
    }
  }
}
```

---

#### 4.1.3 CreateCustomer

**Purpose:** Create new customer (member)

**Payload:**
```json
{
  "commandType": "CreateCustomer",
  "payload": {
    "externalRef": "CUST-000001",
    "firstName": "Alice",
    "lastName": "Smith",
    "dateOfBirth": "1990-01-01",
    "email": "alice.smith@example.com",
    "phone": "+61412345678",
    "address": {
      "street": "123 Main St",
      "city": "Sydney",
      "state": "NSW",
      "postcode": "2000",
      "country": "AU"
    },
    "taxId": "123456789",
    "kycStatus": "PENDING",
    "riskSegment": "LOW"
  }
}
```

---

#### 4.1.4 OpenAccount

**Purpose:** Open account for customer

**Payload:**
```json
{
  "commandType": "OpenAccount",
  "payload": {
    "customerId": "uuid",
    "productCode": "TXN_ACCOUNT_BASIC",
    "initialDeposit": {
      "amount": 100.0,
      "currency": "AUD",
      "source": "CASH"
    }
  }
}
```

---

#### 4.1.5 PostEntry

**Purpose:** Multi-leg posting to ledger (the ONLY way to move money)

**Payload:**
```json
{
  "commandType": "PostEntry",
  "payload": {
    "entryType": "SALARY",
    "description": "Salary payment",
    "valueDate": "2025-01-15",
    "legs": [
      {
        "accountId": "GL_SALARY_CLEARING",
        "direction": "DEBIT",
        "amount": 5000.0,
        "currency": "AUD"
      },
      {
        "accountId": "uuid-customer-txn-account",
        "direction": "CREDIT",
        "amount": 5000.0,
        "currency": "AUD"
      }
    ]
  }
}
```

---

### 4.2 Queries (Read-Side Projections)

Read-only endpoints:

#### 4.2.1 List Customers

```
GET /tenants/{tenantId}/customers?limit=100&offset=0
```

**Response:**
```json
{
  "customers": [
    {
      "customerId": "uuid",
      "externalRef": "CUST-000001",
      "fullName": "Alice Smith",
      "email": "alice.smith@example.com",
      "kycStatus": "VERIFIED",
      "riskSegment": "LOW",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "total": 100,
  "limit": 100,
  "offset": 0
}
```

---

#### 4.2.2 List Accounts

```
GET /tenants/{tenantId}/accounts?customerId={customerId}&limit=100&offset=0
```

**Response:**
```json
{
  "accounts": [
    {
      "accountId": "uuid",
      "customerId": "uuid",
      "productCode": "TXN_ACCOUNT_BASIC",
      "balance": 5100.0,
      "availableBalance": 5100.0,
      "currency": "AUD",
      "status": "ACTIVE",
      "openedAt": "2025-01-01T00:00:00Z"
    }
  ],
  "total": 2,
  "limit": 100,
  "offset": 0
}
```

---

#### 4.2.3 Get Account Events

```
GET /tenants/{tenantId}/accounts/{accountId}/events?limit=100&offset=0
```

**Response:**
```json
{
  "events": [
    {
      "eventId": "uuid",
      "eventType": "AccountOpened",
      "timestamp": "2025-01-01T00:00:00Z",
      "payload": {
        "accountId": "uuid",
        "customerId": "uuid",
        "productCode": "TXN_ACCOUNT_BASIC",
        "initialDeposit": 100.0
      }
    },
    {
      "eventId": "uuid",
      "eventType": "PostingApplied",
      "timestamp": "2025-01-02T00:00:00Z",
      "payload": {
        "entryType": "SALARY",
        "legs": [...]
      }
    }
  ],
  "total": 10,
  "limit": 100,
  "offset": 0
}
```

---

### 4.3 API Guarantees

**These are the only endpoints CU Edition guarantees for v1.0.0:**

1. ✅ POST /tenants/{tenantId}/commands (5 command types)
2. ✅ GET /tenants/{tenantId}/customers
3. ✅ GET /tenants/{tenantId}/accounts
4. ✅ GET /tenants/{tenantId}/accounts/{accountId}/events

**Stability Promise:**
- API contract will not break within major version
- New endpoints may be added in minor versions
- Deprecated endpoints will be supported for 12 months

---

## 5. Deployment Topology – CU Edition (Reference)

### 5.1 Target Infrastructure

**Cloud Provider:** AWS

**Region:** AU (e.g., ap-southeast-2)

**Account Structure:**
- `turing-core-platform-*` accounts for core infrastructure
- `turing-cu-{tenant}-*` accounts for CU-specific deployments (optional, for strong isolation)

---

### 5.2 Cluster Layout

**Kubernetes Cluster:**

```
turingcore namespace:
├── Ring-0 services
│   ├── command-gateway (API Gateway)
│   ├── event-store (Kafka + PostgreSQL)
│   ├── projection-workers (account, customer, transaction)
│   └── query-api (read-side)
├── CU Edition services
│   ├── cu-api (minimal API surface)
│   └── cu-config (product templates)
└── Infrastructure
    ├── postgres (Aurora with RLS enabled)
    ├── kafka (MSK)
    └── redis (ElastiCache)
```

**No wealth/iCattle services deployed in CU clusters.**

---

### 5.3 Observability

**Prometheus / Grafana / Loki stack per CU cluster:**

**Dashboards covering:**
- API latency and error rates
- Command throughput (commands/sec)
- Event throughput (events/sec)
- Event lag (time from command to projection)
- Ledger invariants (e.g., value conservation metrics)
- CPU/memory of core pods

**Alerts:**
- Event lag >5 seconds
- API latency p95 >500ms
- Error rate >1%
- Invariant violations >0

---

## 6. CU-Digital Twin as Acceptance Harness

CU Edition v1.0.0 is **not considered ready** unless:

### 6.1 CU-Digital v0.1 Acceptance Suite Passes

**Against the CU Edition deployment:**

1. ✅ Tenant, product, customer, account creation (TC-03 to TC-06)
2. ✅ Salary and spend posting via PostEntry (TC-07)
3. ✅ Ledger coherence checks (TC-09)
4. ✅ Idempotent seeding behaviour (TC-08)
5. ✅ Protocol enforcement (TC-01, TC-02)
6. ✅ Performance and stability (TC-10)

---

### 6.2 Separation Validation

**CU-Digital lives in a separate repo and cluster:**
- Interacts with CU Edition only via official APIs
- No direct database access
- No direct Kafka access
- No source code imports

**This proves the API is sufficient for real-world usage.**

---

## 7. Versioning & Support

### 7.1 Version Coupling

CU Edition versions follow Ring-0:

**Example:**
- CU Edition 1.0.0 runs on Ring-0 Core 1.0.x
- CU Edition 1.1.0 runs on Ring-0 Core 1.2.x
- CU Edition 2.0.0 runs on Ring-0 Core 2.0.x

---

### 7.2 Breaking Changes

**Breaking changes in API or semantics:**
- Require new CU Edition major version
- Must be paired with migration docs and impact analysis
- Must provide 12-month deprecation period for old API
- Must provide migration tooling

**Example Breaking Change:**
- Changing command envelope structure
- Removing required fields from API
- Changing event schema

---

### 7.3 Support Policy

**Current Version (v1.x.x):**
- Full support (bug fixes, security patches, new features)
- SLA: 99.9% uptime
- Support response: <4 hours for critical issues

**Previous Version (v0.x.x):**
- Security patches only
- SLA: 99.5% uptime
- Support response: <24 hours for critical issues

**End-of-Life (v-2.x.x):**
- No support
- Must upgrade to current or previous version

---

## 8. Regulatory Compliance

### 8.1 APRA Requirements

**CPS 230 (Operational Risk Management):**
- Complete audit trail (all commands, events, state changes)
- Disaster recovery (RTO <4 hours, RPO <15 minutes)
- Business continuity (tested quarterly)
- Incident management (documented procedures)

**CPS 234 (Information Security):**
- Tenant isolation (PostgreSQL RLS)
- Authentication/authorization (OAuth 2.0, RBAC)
- Encryption (at rest, in transit)
- Vulnerability management (quarterly scans)

---

### 8.2 Evidence Package

**For each CU Edition release, we provide:**

1. **Version Information:**
   - Ring-0 version number
   - CU Edition version number
   - Git commit hash
   - Notarized artifact IDs (RedBelly)

2. **Test Evidence:**
   - CU-Digital acceptance test run reports
   - Unit test coverage reports
   - Integration test results
   - Performance test results

3. **Change Documentation:**
   - List of changes (features, fixes)
   - Risk/impact analysis
   - Migration plan (if breaking)
   - Rollback plan

4. **Audit Trail:**
   - All commands logged (7 years retention)
   - All events immutable (indefinite retention)
   - All state changes traceable
   - Complete reconstruction possible

---

## 9. Pricing Model (Placeholder)

**Note:** Pricing details excluded per user request.

**Pricing Structure:**
- SaaS subscription model
- Tiered pricing based on member count
- Transparent pricing calculator
- No hidden fees

---

## 10. Summary

**This is your product definition for CUs, written in regulator-friendly language.**

**Key Points:**

1. ✅ **Built on Ring-0** – Single canonical core, no forks
2. ✅ **Constrained Scope** – Only what CUs need for day-to-day banking
3. ✅ **Stable API** – 5 commands, 3 queries, guaranteed for v1.0.0
4. ✅ **Deployment Ready** – AWS, Kubernetes, Aurora, Kafka, Redis
5. ✅ **Observability** – Prometheus, Grafana, Loki, comprehensive dashboards
6. ✅ **Acceptance Harness** – CU-Digital v0.1 suite must pass
7. ✅ **Versioning** – Follows Ring-0, semantic versioning, 12-month deprecation
8. ✅ **Regulatory Compliance** – APRA CPS 230/234, complete audit trail
9. ✅ **Support Policy** – Current, previous, end-of-life versions
10. ✅ **Evidence Package** – Version info, test reports, change docs, audit trail

**CU Edition is the clean, bounded, regulated product that credit unions will run in production.**

---

## References

- [Core vs CU Contract](./CORE_VS_CU_CONTRACT.md)
- [Ring-0 Core Scope](./RING0_CORE_SCOPE.md)
- [v0.1 Baseline Definition](./00-v0.1-baseline-definition.md)
- [Acceptance Test Specification](./08-acceptance-test-specification.md)

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-15  
**Owner:** CU Product Team  
**Status:** Product Specification
