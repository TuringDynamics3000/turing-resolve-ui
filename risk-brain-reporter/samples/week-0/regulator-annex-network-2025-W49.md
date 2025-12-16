# RISK BRAIN REGULATORY ANNEX (FORENSIC REPLAY PACK)

**Reporting Entity:** NETWORK (All Participating Credit Unions)  
**Reporting Period:** 01 December 2025 → 07 December 2025  
**Domains Covered:** Payments RL (Shadow), Fraud Shadow, AML Shadow, Treasury RL (Shadow)  
**Generated (UTC):** 08 December 2025 01:06:44  
**Version:** Regulatory Annex v1.0  
**System:** Risk Brain (B-Domain, Non-Executing Intelligence Layer)

---

## SECTION 1 — REGULATORY SCOPE & ASSERTIONS

### 1.1 Scope of This Annex

This document provides:

- A forensic summary of non-executing AI risk intelligence
- A machine-verifiable safety attestation for the reporting period
- A quantified view of behavioural and transactional risk signals
- Replay pointers to immutable protocol event streams

**This annex is generated automatically from immutable telemetry and is not subject to manual amendment.**

### 1.2 Non-Execution Assertion (Formal)

*"At no point during this reporting period was any AI-originated instruction capable of triggering ledger, payment, credit, treasury, or settlement execution."*

**All Risk Brain outputs remained strictly advisory-only and policy-gated.**

---

## SECTION 2 — SAFETY INVARIANTS (SYSTEM-LEVEL PROOFS)

| Safety Invariant | Value | Regulatory Interpretation |
|------------------|-------|---------------------------|
| AI-Origin Execution Violations | 0 | No breach of non-execution constraint |
| Schema Version Violations | 0 | No corrupted or off-protocol messages |
| Policy Origin Violations | 0 | All intelligence derived from human-authored policy |

✅ **Result:** All system-level invariants remained within strict regulatory tolerances for the full reporting window.

---

## SECTION 3 — DOMAIN RISK COUNTS (NETWORK AGGREGATE)

### 3.1 FRAUD SHADOW

| Risk Band | Count |
|-----------|-------|
| High | 37 |
| Medium | 118 |
| Low | 1,904 |

| Outcome | Count |
|---------|-------|
| Confirmed | 4 |
| Cleared | 28 |
| Pending Investigation | 5 |

**Interpretation:** Confirmed cases remain within historically expected baseline for transaction volume. No correlated multi-merchant or cross-tenant syndication detected.

### 3.2 AML SHADOW

| Risk Band | Count |
|-----------|-------|
| High | 7 |
| Medium | 49 |

| Escalation Outcome | Count |
|--------------------|-------|
| Investigations Opened | 6 |
| SMRs Filed | 1 |

**Interpretation:** High-band events reflect isolated behaviour consistent with known typologies. No structuring ladder patterns detected across tenants.

### 3.3 TREASURY RL (SHADOW)

| Metric | Value |
|--------|-------|
| High-Risk Liquidity Windows | 0 |
| Average Recommended Buffer Delta | A$184,200 |
| Peak Stress Score | 0.41 (Threshold = 0.70) |

**Interpretation:** Shadow liquidity forecasts show no impending systemic stress beyond current governance buffers.

### 3.4 PAYMENTS RL (SHADOW)

| Metric | Value |
|--------|-------|
| Payments Evaluated by RL | 14,892 |
| Coverage of Total Network Payments | 71.8% |
| Net Optimisation Direction | Positive |

**Interpretation:** Shadow routing optimisation suggests efficiency gains without currently observed adverse latency or risk externalities.

---

## SECTION 4 — SCORE DISTRIBUTIONS (PERCENTILE VIEW)

### Fraud Risk Score (Shadow)

| Percentile | Score |
|------------|-------|
| P50 | 0.21 |
| P75 | 0.38 |
| P90 | 0.62 |
| P99 | 0.88 |

### AML Behavioural Deviation Score

| Percentile | Score |
|------------|-------|
| P50 | 0.17 |
| P75 | 0.31 |
| P90 | 0.59 |
| P99 | 0.81 |

### Treasury Stress Score

| Percentile | Score |
|------------|-------|
| P50 | 0.19 |
| P75 | 0.33 |
| P90 | 0.41 |
| P99 | 0.53 |

✅ **All distributions remain below critical alert thresholds.**

---

## SECTION 5 — EVENT SAMPLES (ANONYMISED, FORENSIC-SAFE)

| Domain | Timestamp (UTC) | Risk Band | Event Hash Reference |
|--------|-----------------|-----------|----------------------|
| Fraud | 2025-12-05 02:41 | High | 7f3b91d…a20 |
| Fraud | 2025-12-05 02:53 | High | 88c1e04…dc1 |
| AML | 2025-12-06 10:17 | Medium | bd7121c…9f0 |
| AML | 2025-12-06 11:02 | High | ae90211…773 |

**These hashes correspond to immutable protocol events and can be fully replayed under supervisory access.**

---

## SECTION 6 — REPLAY POINTERS (IMMUTABLE OBJECT STORE)

| Domain | Object Store Path | SHA-256 |
|--------|-------------------|---------|
| Fraud | s3://risk-brain/events/fraud/2025-W49/ | b3a8…c91e |
| AML | s3://risk-brain/events/aml/2025-W49/ | 9d71…44fa |
| Treasury | s3://risk-brain/events/treasury/2025-W49/ | 1a0c…e2b9 |
| Payments RL | s3://risk-brain/events/payments/2025-W49/ | ce98…aa73 |

✅ **All references are:**
- Object-locked
- Versioned
- Hash-sealed
- Regulatory-replay capable

---

## SECTION 7 — REGULATORY ATTESTATION (AUTOMATED)

*"For the reporting period 01 December 2025 to 07 December 2025, the Risk Brain system operated exclusively in shadow mode. All AI-derived outputs were advisory only, subject to human policy gates, and were incapable of initiating execution. All safety invariants remained within regulatory tolerances with zero violations."*

**System Signature:**  
RiskBrainReporter v1.0 — Canonical Hash: 4e9b…1f02

---

## SECTION 8 — SUPERVISORY CONTACT POINTS

For supervisory inquiries regarding this annex:

**Technical Contact:** Chief Technology Officer  
**Risk Contact:** Chief Risk Officer  
**Compliance Contact:** Head of Regulatory Affairs

**Replay Access:** Available upon formal supervisory request via secure channel.

---

**Document Version:** Regulatory Annex v1.0  
**Generated By:** Risk Brain Reporter v1.0 (Automated)  
**Next Annex:** On-demand or upon supervisory request
