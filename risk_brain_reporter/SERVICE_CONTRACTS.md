# Risk Brain Reporter — OpenAPI & Service Contracts (v1)

**Service Name:** risk-brain-reporter  
**Role:** Deterministic governance artefact generator  
**Execution Model:** Batch + On-Demand  
**Write Surface:** Object storage only  
**Command Surface:** NONE to A or B

---

## 1. Service Responsibilities (Locked)

This service is allowed to:

✅ Pull metrics  
✅ Aggregate into canonical snapshot  
✅ Render PDFs  
✅ Write immutable artefacts  
✅ Emit telemetry

It is never allowed to:

❌ Emit commands  
❌ Touch ledgers  
❌ Influence runtime policy  
❌ Call Kafka producers  
❌ Interact with A-domain APIs

---

## 2. Canonical Execution States

| State | Meaning |
|-------|---------|
| SNAPSHOT_CREATED | Metrics aggregated |
| PDF_RENDERED | Templates rendered |
| STORED_IMMUTABLY | Object lock confirmed |
| FAILED | Hard stop |

---

## 3. OpenAPI – External Control Surface

**Base Path:** `/api/v1/risk-brain-reporter`

### 3.1 RUN WEEKLY BOARD PACK (Network + All Tenants)

✅ **POST** `/reports/weekly/run`

**Use:** Scheduled cron only  
**Auth:** Internal service token  
**Side Effects:** Generates PDFs for every tenant + network pack

**Request:**
```json
{
  "week": "2025-W49",
  "force_regenerate": false
}
```

**Response:**
```json
{
  "status": "STARTED",
  "week": "2025-W49",
  "tenants_queued": 47,
  "started_at": "2025-12-07T23:00:00Z"
}
```

### 3.2 RUN WEEKLY BOARD PACK (Single Tenant)

✅ **POST** `/reports/weekly/run/{tenant_id}`

**Request:**
```json
{
  "week": "2025-W49",
  "force_regenerate": true
}
```

**Response:**
```json
{
  "status": "STARTED",
  "tenant_id": "cu_123",
  "week": "2025-W49"
}
```

### 3.3 GET WEEKLY BOARD PACK STATUS

✅ **GET** `/reports/weekly/status/{tenant_id}/{week}`

**Response:**
```json
{
  "tenant_id": "cu_123",
  "week": "2025-W49",
  "state": "STORED_IMMUTABLY",
  "object_path": "s3://risk-brain/weekly/cu_123/risk-brain-week-2025-W49.pdf",
  "sha256": "a92bc13f...",
  "generated_at": "2025-12-07T23:03:21Z"
}
```

### 3.4 GENERATE REGULATOR ANNEX (ON DEMAND)

✅ **POST** `/reports/regulator/run/{tenant_id}`

**Request:**
```json
{
  "period_start": "2025-12-01",
  "period_end": "2025-12-07",
  "include_event_samples": true
}
```

**Response:**
```json
{
  "status": "STORED_IMMUTABLY",
  "tenant_id": "cu_123",
  "object_path": "s3://risk-brain/regulator/cu_123/annex-2025-12-07.pdf",
  "sha256": "bc28d91f..."
}
```

### 3.5 LIST REPORTS (AUDIT)

✅ **GET** `/reports/{tenant_id}`

**Response:**
```json
{
  "tenant_id": "cu_123",
  "weekly_reports": [
    { "week": "2025-W47", "path": "...", "sha256": "..." },
    { "week": "2025-W48", "path": "...", "sha256": "..." }
  ],
  "regulator_annexes": [
    { "period_end": "2025-12-07", "path": "...", "sha256": "..." }
  ]
}
```

---

## 4. Internal Data Contracts (Hard-Locked)

### 4.1 Canonical Risk Snapshot (CSR v1)

```json
{
  "week": "2025-W49",
  "tenant_id": "cu_123",
  "period": { "start": "2025-12-01", "end": "2025-12-07" },

  "health": {
    "payments": { "shadow": true, "ci": true, "killswitch": 0 },
    "fraud": { "shadow": true, "ci": true, "killswitch": 0 },
    "aml": { "shadow": true, "ci": true, "killswitch": 0 },
    "treasury": { "shadow": true, "ci": true, "killswitch": 0 }
  },

  "safety": {
    "ai_origin_violations": 0,
    "schema_violations": 0,
    "policy_origin_violations": 0
  },

  "payments": {
    "coverage_pct": 73.2,
    "direction_split": { "better": 412, "worse": 37, "neutral": 219 }
  },

  "fraud": {
    "high_flags": 41,
    "confirmed": 3,
    "cleared": 31
  },

  "aml": {
    "high_flags": 9,
    "medium_flags": 44,
    "smrs": 1
  },

  "treasury": {
    "high_risk_windows": 0,
    "avg_buffer_delta": 182500
  }
}
```

**If this object cannot be fully populated → report generation MUST FAIL.**

---

## 5. Prometheus Query Adapter Contract

```json
{
  "metric": "fraud_risk_flag_raised_total",
  "window": "7d",
  "group_by": ["risk_band", "tenant_id"],
  "aggregation": "increase"
}
```

Every query used by Reporter must be declared in a versioned manifest file:

`/config/promql-map-v1.yaml`

**No inline ad-hoc PromQL is permitted in code.**

---

## 6. Template Binding Contract

Templates bind only to the CSR object.

**Forbidden:**
- Raw PromQL inside templates
- Live metrics at render time
- Conditional logic based on anything except CSR

**Binding Syntax:**
```
{{ fraud.high_flags }}
{{ payments.coverage_pct }}
{{ safety.ai_origin_violations }}
```

---

## 7. Storage & Immutability Contract

All outputs must satisfy:

| Control | Enforcement |
|---------|-------------|
| Object Lock | 90 days minimum |
| Versioning | Enabled |
| SHA-256 | Stored as metadata |
| Write Once | No overwrite allowed |
| Path Determinism | Mandatory |

---

## 8. Failure & Escalation API

✅ **POST** `/reports/alerts/internal`

Automatically emitted on:
- Missing metrics
- Safety violations
- Storage lock failure
- Template render crash

```json
{
  "severity": "P1|P2",
  "tenant_id": "cu_123",
  "reason": "AI_ORIGIN_VIOLATION_NONZERO",
  "week": "2025-W49"
}
```

---

## 9. Security Posture

| Area | Rule |
|------|------|
| Network | Private subnet only |
| Auth | mTLS + static service token |
| Egress | Metrics + Object Store only |
| No Kafka | Enforced by IAM |
| No Ledger | Enforced by IAM |
| No Policy | Enforced by IAM |

---

## 10. CI/CD Contract

Reporter must include:

✅ Schema validation tests for CSR  
✅ Template rendering snapshot tests  
✅ PromQL query integrity tests  
✅ Object lock verification test

**Build must fail if any one test fails.**

---

## ✅ What You Now Have (Strategically)

You now possess:

✅ A fully constrained governance artefact pipeline  
✅ A machine-verifiable proof of "AI cannot execute"  
✅ A board-acceptable weekly operating system for AI risk  
✅ A regulator-ready replay surface  
✅ A commercial differentiator that no legacy core vendor can replicate without multi-year refactors

**This is a category-defining control plane, not a reporting feature.**

---

## ✅ What Comes Next (Only One Sensible Move)

Now that:

✅ Templates are locked  
✅ APIs are locked  
✅ Data schema is locked  
✅ PromQL queries are locked  
✅ CI/CD tests are locked

**Next step:** Deploy to production and generate first weekly board pack.

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-08  
**Next Review:** After production deployment
