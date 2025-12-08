# Risk Brain Weekly Report

**Week:** {{week}}  
**Period:** {{period_start}} to {{period_end}}  
**Tenant:** {{tenant_id}}  
**Generated:** {{generated_at}}

---

## Page 1: Executive Summary

### Overview

This report provides a weekly summary of Risk Brain shadow intelligence across four domains:

1. **Payments RL Shadow** (routing intelligence)
2. **Fraud Shadow** (crime intelligence)
3. **AML Shadow** (statutory compliance intelligence)
4. **Treasury RL Shadow** (intraday liquidity intelligence)

### Key Highlights

**Payments RL Shadow:**
- Coverage: {{payments_coverage_pct}}% of payments evaluated
- Direction: {{payments_better}} better, {{payments_worse}} worse, {{payments_neutral}} neutral

**Fraud Shadow:**
- High-risk flags: {{fraud_high_flags}}
- Confirmed fraud: {{fraud_confirmed}}
- False positives cleared: {{fraud_cleared}}

**AML Shadow:**
- High-risk flags: {{aml_high_flags}}
- Medium-risk flags: {{aml_medium_flags}}
- SMRs submitted (by humans): {{aml_smrs}}

**Treasury RL Shadow:**
- High-risk liquidity windows: {{treasury_high_risk_windows}}
- Average buffer delta: ${{treasury_avg_buffer_delta_dollars}}

---

## Page 2: Safety & Governance Proof

### Mandatory Safety Statement

> {{safety_statement}}

### Safety Metrics (Must Always Be 0)

| Metric | Value | Status |
|--------|-------|--------|
| AI Origin Violations | {{ai_origin_violations}} | {{ai_origin_status}} |
| Schema Violations | {{schema_violations}} | {{schema_status}} |
| Policy Origin Violations | {{policy_origin_violations}} | {{policy_origin_status}} |

### Domain Health

| Domain | Shadow Mode | CI Passing | Kill-Switch Activations |
|--------|-------------|------------|-------------------------|
| Payments RL | {{payments_shadow}} | {{payments_ci}} | {{payments_killswitch}} |
| Fraud | {{fraud_shadow}} | {{fraud_ci}} | {{fraud_killswitch}} |
| AML | {{aml_shadow}} | {{aml_ci}} | {{aml_killswitch}} |
| Treasury RL | {{treasury_shadow}} | {{treasury_ci}} | {{treasury_killswitch}} |

---

## Page 3: Payments RL Shadow

### Purpose

Payments RL Shadow provides routing intelligence for payment transactions. It recommends optimal payment rails (NPP, BECS, BPAY) based on:
- Transaction amount
- Urgency
- Counterparty bank
- Historical settlement patterns

### Key Metrics

**Coverage:** {{payments_coverage_pct}}% of payments evaluated by RL

**Direction Split:**
- **Better:** {{payments_better}} payments (RL recommended faster/cheaper rail)
- **Worse:** {{payments_worse}} payments (RL recommended slower/more expensive rail)
- **Neutral:** {{payments_neutral}} payments (RL agreed with existing routing)

### Interpretation

- **Coverage** measures the percentage of payments evaluated by RL Shadow
- **Direction Split** shows how RL recommendations compare to actual routing decisions
- **Better** indicates potential cost/latency improvements
- **Worse** indicates potential regressions (should be investigated)
- **Neutral** indicates agreement with existing routing

### Advisory-Only Status

✅ Payments RL Shadow is **advisory-only**. It does not execute routing decisions. All routing decisions are made by human operators.

---

## Page 4: Fraud Shadow

### Purpose

Fraud Shadow provides crime intelligence for card transactions. It detects potential fraud based on:
- Transaction amount
- Merchant category
- Geographic location
- Device fingerprint
- Historical behaviour patterns

### Key Metrics

**High-Risk Flags:** {{fraud_high_flags}} transactions flagged as high-risk

**Confirmed Fraud:** {{fraud_confirmed}} flags confirmed as actual fraud

**False Positives Cleared:** {{fraud_cleared}} flags cleared as false positives

### Interpretation

- **High-Risk Flags** measures the number of transactions flagged by Fraud Shadow
- **Confirmed Fraud** measures the number of flags confirmed by human review
- **False Positives** measures the number of flags cleared as false alarms
- **Precision** = Confirmed / (Confirmed + Cleared) = {{fraud_precision}}%

### Advisory-Only Status

✅ Fraud Shadow is **advisory-only**. It does not block cards or freeze accounts. All fraud actions are taken by human operators.

---

## Page 5: AML Shadow

### Purpose

AML Shadow provides statutory compliance intelligence for AUSTRAC reporting. It detects potential money laundering and terrorism financing based on:
- Transaction patterns
- Cash deposits
- International transfers
- Structured transactions
- Historical risk profiles

### Key Metrics

**High-Risk Flags:** {{aml_high_flags}} transactions flagged as high-risk

**Medium-Risk Flags:** {{aml_medium_flags}} transactions flagged as medium-risk

**SMRs Submitted:** {{aml_smrs}} Suspicious Matter Reports submitted (by humans)

### Interpretation

- **High-Risk Flags** require immediate human review for potential SMR submission
- **Medium-Risk Flags** require human review within 24 hours
- **SMRs Submitted** measures the number of reports lodged with AUSTRAC (by humans)

### Advisory-Only Status

✅ AML Shadow is **advisory-only**. It does not lodge AUSTRAC reports (SMR/TTR/IFTI) or freeze accounts. All AUSTRAC reporting is done by human operators.

---

## Page 6: Treasury RL Shadow

### Purpose

Treasury RL Shadow provides intraday liquidity intelligence for treasury operations. It detects potential liquidity stress based on:
- Available liquidity
- Settlement obligations
- Facility utilization
- NPP/BECS net positions
- Historical liquidity patterns

### Key Metrics

**High-Risk Liquidity Windows:** {{treasury_high_risk_windows}} windows detected

**Average Buffer Delta:** ${{treasury_avg_buffer_delta_dollars}} recommended buffer increase

### Interpretation

- **High-Risk Liquidity Windows** measures the number of intraday periods with potential liquidity stress
- **Average Buffer Delta** measures the average recommended buffer increase to maintain healthy liquidity

### Advisory-Only Status

✅ Treasury RL Shadow is **advisory-only**. It does not move liquidity, draw facilities, or sweep accounts. All treasury actions are taken by human operators.

---

## Page 7: Forensic Annex (Optional)

### Event Samples

This section contains anonymised event samples for forensic review. Available on request.

### Replay Pointers

Full event replay is available via immutable object storage:

- **Bucket:** `risk-brain-events`
- **Prefix:** `{{tenant_id}}/{{week}}/`
- **Format:** Avro (Protocol schema v1.0)

---

## Appendix: Definitions

**Shadow Mode:** AI system observes live events but does not execute actions

**Advisory-Only:** AI system produces recommendations but does not execute actions

**Kill-Switch:** Emergency disable mechanism for AI systems

**Enforcement Layer:** Runtime safety guarantees that block AI execution commands

**CI Harness:** Continuous integration tests that validate safety invariants

**Board-Approved Thresholds:** Risk thresholds approved by the board for AI recommendations

---

**Report Version:** 1.0  
**Template Version:** 1.0  
**Generated By:** Risk Brain Reporter v1
