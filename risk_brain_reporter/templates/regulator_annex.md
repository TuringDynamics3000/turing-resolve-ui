# Risk Brain Regulator Annex

**Period:** {{period_start}} to {{period_end}}  
**Tenant:** {{tenant_id}}  
**Generated:** {{generated_at}}  
**Purpose:** APRA/AUSTRAC/RBA Regulatory Disclosure

---

## Section 1: Header

### Reporting Entity

**Tenant ID:** {{tenant_id}}  
**Reporting Period:** {{period_start}} to {{period_end}}  
**Report Type:** Risk Brain Shadow Intelligence Annex  
**Regulatory Framework:** APRA CPS 234, AUSTRAC AML/CTF Act 2006

### AI Systems in Scope

This annex covers four AI shadow intelligence systems:

1. **Payments RL Shadow** (routing intelligence)
2. **Fraud Shadow** (crime intelligence)
3. **AML Shadow** (statutory compliance intelligence)
4. **Treasury RL Shadow** (intraday liquidity intelligence)

### Execution Authority

**All four systems are advisory-only with zero execution authority.**

- No AI-controlled financial actions
- No AI-controlled AUSTRAC reporting
- No AI-controlled liquidity management
- No AI-controlled account restrictions

---

## Section 2: Safety Table (All Invariant Metrics)

### Critical Safety Invariants (Must Always Be 0)

| Invariant | Value | Status | Regulatory Significance |
|-----------|-------|--------|-------------------------|
| AI Origin Violations | {{ai_origin_violations}} | {{ai_origin_status}} | Proves AI cannot execute financial actions |
| Schema Violations | {{schema_violations}} | {{schema_status}} | Proves event integrity is maintained |
| Policy Origin Violations | {{policy_origin_violations}} | {{policy_origin_status}} | Proves only board-approved policies are used |

### Mandatory Safety Statement

> {{safety_statement}}

### Enforcement Layer Status

| Enforcement Module | Status | Purpose |
|-------------------|--------|---------|
| AI Origin Blocker | ✅ Active | Blocks 27 forbidden command types |
| Schema Version Guard | ✅ Active | Pins 18 event types to v1.0 |
| Policy Gateway Validator | ✅ Active | Validates 7 approved policy sources |

---

## Section 3: Domain Counts (Flags by Risk Band)

### Payments RL Shadow

| Metric | Value | Interpretation |
|--------|-------|----------------|
| Coverage | {{payments_coverage_pct}}% | Percentage of payments evaluated by RL |
| Better Recommendations | {{payments_better}} | RL recommended faster/cheaper rail |
| Worse Recommendations | {{payments_worse}} | RL recommended slower/more expensive rail |
| Neutral Recommendations | {{payments_neutral}} | RL agreed with existing routing |

### Fraud Shadow

| Metric | Value | Interpretation |
|--------|-------|----------------|
| High-Risk Flags | {{fraud_high_flags}} | Transactions flagged as high-risk |
| Confirmed Fraud | {{fraud_confirmed}} | Flags confirmed as actual fraud |
| False Positives Cleared | {{fraud_cleared}} | Flags cleared as false alarms |
| Precision | {{fraud_precision}}% | Confirmed / (Confirmed + Cleared) |

### AML Shadow

| Metric | Value | Interpretation |
|--------|-------|----------------|
| High-Risk Flags | {{aml_high_flags}} | Transactions flagged as high-risk |
| Medium-Risk Flags | {{aml_medium_flags}} | Transactions flagged as medium-risk |
| SMRs Submitted (by humans) | {{aml_smrs}} | Suspicious Matter Reports lodged with AUSTRAC |

**AUSTRAC Compliance Statement:**

> AML Shadow is advisory-only. It does not lodge AUSTRAC reports (SMR/TTR/IFTI) or freeze accounts. All AUSTRAC reporting is done by human operators in compliance with AML/CTF Act 2006.

### Treasury RL Shadow

| Metric | Value | Interpretation |
|--------|-------|----------------|
| High-Risk Liquidity Windows | {{treasury_high_risk_windows}} | Intraday periods with potential liquidity stress |
| Average Buffer Delta | ${{treasury_avg_buffer_delta_dollars}} | Recommended buffer increase |

**RBA Compliance Statement:**

> Treasury RL Shadow is advisory-only. It does not move liquidity, draw facilities, or sweep accounts. All treasury actions are taken by human operators in compliance with RBA liquidity requirements.

---

## Section 4: Score Distributions (If Available)

### Payments RL Confidence Distribution

| Confidence Band | Count | Percentage |
|----------------|-------|------------|
| High (>= 0.85) | - | - |
| Medium (0.65-0.85) | - | - |
| Low (< 0.65) | - | - |

### Fraud Risk Score Distribution

| Risk Band | Count | Percentage |
|-----------|-------|------------|
| High (>= 0.85) | {{fraud_high_flags}} | - |
| Medium (0.65-0.85) | - | - |
| Low (< 0.65) | - | - |

### AML Risk Score Distribution

| Risk Band | Count | Percentage |
|-----------|-------|------------|
| High (>= 0.85) | {{aml_high_flags}} | - |
| Medium (0.65-0.85) | {{aml_medium_flags}} | - |
| Low (< 0.65) | - | - |

### Treasury Risk Score Distribution

| Risk Band | Count | Percentage |
|-----------|-------|------------|
| High (>= 0.85) | {{treasury_high_risk_windows}} | - |
| Medium (0.65-0.85) | - | - |
| Low (< 0.65) | - | - |

---

## Section 5: Event Samples (Optional Anonymised)

### Sample 1: Payments RL Advisory

```json
{
  "event_type": "RlRoutingAdvisoryIssued",
  "tenant_id": "[REDACTED]",
  "recommended_rail": "NPP",
  "confidence": 0.91,
  "policy_id": "payments-rl-policy-v1",
  "origin": "AI",
  "occurred_at": "[REDACTED]"
}
```

### Sample 2: Fraud Risk Flag

```json
{
  "event_type": "FraudRiskFlagRaised",
  "tenant_id": "[REDACTED]",
  "risk_band": "HIGH",
  "risk_score": 0.87,
  "policy_id": "fraud-policy-v1",
  "origin": "AI",
  "occurred_at": "[REDACTED]"
}
```

### Sample 3: AML Risk Flag

```json
{
  "event_type": "AmlRiskFlagRaised",
  "tenant_id": "[REDACTED]",
  "risk_band": "HIGH",
  "risk_score": 0.92,
  "policy_id": "aml-policy-v1",
  "origin": "AI",
  "occurred_at": "[REDACTED]"
}
```

### Sample 4: Treasury Risk Advisory

```json
{
  "event_type": "TreasuryRiskAdvisoryIssued",
  "tenant_id": "[REDACTED]",
  "risk_band": "MEDIUM",
  "recommended_buffer_cents": 300000000,
  "policy_id": "treasury-policy-v1",
  "origin": "AI",
  "occurred_at": "[REDACTED]"
}
```

---

## Section 6: Replay Pointer (Object Store + Offset References)

### Immutable Event Storage

**Bucket:** `risk-brain-events`  
**Prefix:** `{{tenant_id}}/{{week}}/`  
**Format:** Avro (Protocol schema v1.0)  
**Retention:** 7 years (AUSTRAC compliance)

### Replay Instructions

1. Access immutable object storage (S3-compatible)
2. Navigate to bucket: `risk-brain-events`
3. Navigate to prefix: `{{tenant_id}}/{{week}}/`
4. Download Avro files for the reporting period
5. Replay events using Protocol schema v1.0

### Forensic Reconstruction

Full forensic reconstruction is available via:
- Event replay from immutable storage
- Metrics replay from Prometheus TSDB
- Audit trail from enforcement layer

---

## Section 7: Regulatory Compliance Statements

### APRA CPS 234 (Information Security)

✅ **AI systems are advisory-only with zero execution authority.**

✅ **Enforcement layer prevents AI execution commands (runtime safety guarantees).**

✅ **CI harness validates safety invariants on every commit.**

✅ **Full audit trail captures every AI recommendation.**

### AUSTRAC AML/CTF Act 2006

✅ **AML Shadow is advisory-only. It does not lodge AUSTRAC reports (SMR/TTR/IFTI).**

✅ **All AUSTRAC reporting is done by human operators.**

✅ **AML Shadow cannot freeze accounts or restrict transactions.**

✅ **Full audit trail captures every AML risk score.**

### RBA Liquidity Requirements

✅ **Treasury RL Shadow is advisory-only. It does not move liquidity or draw facilities.**

✅ **All treasury actions are taken by human operators.**

✅ **Treasury RL Shadow cannot sweep accounts or adjust facilities.**

✅ **Full audit trail captures every liquidity risk score.**

---

## Section 8: Contact Information

### Regulatory Liaison

**Name:** [TO BE FILLED]  
**Title:** Chief Risk Officer  
**Email:** [TO BE FILLED]  
**Phone:** [TO BE FILLED]

### Technical Liaison

**Name:** [TO BE FILLED]  
**Title:** Head of Risk Brain Engineering  
**Email:** [TO BE FILLED]  
**Phone:** [TO BE FILLED]

---

## Appendix: Definitions

**Shadow Mode:** AI system observes live events but does not execute actions

**Advisory-Only:** AI system produces recommendations but does not execute actions

**Enforcement Layer:** Runtime safety guarantees that block AI execution commands

**Immutable Storage:** Object storage with write-once-read-many (WORM) guarantees

**Forensic Reconstruction:** Ability to replay events and recreate AI recommendations

**Board-Approved Thresholds:** Risk thresholds approved by the board for AI recommendations

---

**Annex Version:** 1.0  
**Template Version:** 1.0  
**Generated By:** Risk Brain Reporter v1  
**Regulatory Framework:** APRA CPS 234, AUSTRAC AML/CTF Act 2006, RBA Liquidity Requirements
