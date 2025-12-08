# FRAUD SHADOW PILOT — PRODUCTION WIRING CHECKLIST

**Mode:** Shadow / Advisory Only  
**Authority:** Zero execution  
**Surface:** Cards + Payments  
**Regulatory Posture:** Observational system only

---

## 🔒 0. NON-NEGOTIABLE GLOBAL PRECONDITIONS

**All must be TRUE before any live fraud data flows into B:**

| Control | Required | Status |
|---------|----------|--------|
| Harness fraud scenarios pass | ✅ | ⬜ |
| ai_origin_blocker.py active | ✅ | ⬜ |
| schema_version_guard.py active | ✅ | ⬜ |
| fraud.policy_gateway.py live | ✅ | ⬜ |
| Fraud consumer enabled | ✅ | ⬜ |
| No domain handler accepts AI-origin financial commands | ✅ | ⬜ |
| Fraud env kill switch implemented | ✅ | ⬜ |

**If any cell is ⬜ → LIVE FEED IS FORBIDDEN.**

---

## 🧩 1. TURINGCORE → PROTOCOL — LIVE FRAUD EVENT EMISSION

**You must already be emitting (or proxying from Cuscal/cards switch):**

### ✅ CARDS

| Event | Required Fields |
|-------|----------------|
| CardAuthorisationRequested | card_token_hash, merchant_id, mcc, amount, country |
| CardAuthorisationApproved | same + approval_code |
| CardAuthorisationDeclined | same + decline_reason |

### ✅ PAYMENTS

| Event | Required Fields |
|-------|----------------|
| PaymentInitiated | payment_id, account_id, counterparty_hash, amount |
| PaymentFailed | payment_id, failure_code |
| PaymentSettled | payment_id, settlement_timestamp |

### ✅ ACCESS / DEVICE (STRONGLY RECOMMENDED)

| Event | Purpose |
|-------|---------|
| AccountLoginSucceeded | Takeover detection |
| AccountLoginFailed | Brute-force risk |
| DeviceFingerprintObserved (hashed) | Mule linking |
| IpClusterObserved (ASN + geo bucket) | Network risk |

**All of these MUST:**
- ✅ Include `tenant_id`
- ✅ Include `origin = "CORE"`
- ✅ Be immutable
- ✅ Be replayable

---

## 🔗 2. FRAUD SHADOW KAFKA TOPIC (READ-ONLY)

**Create:**

```
protocol.fraud.live.shadow
```

| Setting | Required |
|---------|----------|
| Producer | TuringCore + Cuscal ingest |
| Consumer | Fraud Dark Graph |
| Retention | ≥ 180 days |
| ACL | Read-only to B |
| Audit log | Enabled |

**If B can write to this topic → your platform is legally unsafe.**

---

## 🧠 3. FRAUD DARK GRAPH (B-SIDE ONLY)

**Confirm this runs ONLY in B:**

### ✅ Nodes
- Card token (hashed)
- Account (hashed)
- Device fingerprint
- IP cluster
- Merchant acceptor
- Counterparty

### ✅ Edges
- Card → Merchant
- Card → Device
- Device → IP
- Account → Counterparty
- Account → Card

**Graph MUST be:**
- ✅ Cross-CU anonymised
- ✅ Time-windowed
- ✅ Replayable
- ✅ Never directly visible to Ops (only derived metrics)

---

## 🤖 4. FRAUD SHADOW SCORING

**For each sensitive event, B must emit:**

```
FraudRiskScoreProduced
```

**Required fields:**
- event_id
- tenant_id
- card_id OR payment_id
- customer_id
- score_value (0–1)
- risk_band (LOW | MEDIUM | HIGH)
- model_id
- model_version
- feature_set_version
- confidence_interval
- input_feature_hash

**⚠️ This is advisory only.**

**It must NEVER trigger:**
- ❌ Card decline
- ❌ Payment block
- ❌ Posting restriction

---

## 🧭 5. FRAUD POLICY GATEWAY (A-SIDE ONLY)

**Verify this exact path is live:**

```
FraudRiskScoreProduced
   ↓
intelligence_bus/consumers/fraud_consumer.py
   ↓
domains/fraud/policy_gateway.py
   ↓
HighFraudRiskFlagRaised | ModerateFraudRiskFlagRaised
```

### ✅ HARD ASSERTION

**fraud.policy_gateway.py MUST:**
- ❌ Never return a decline command
- ❌ Never return a posting command
- ❌ Never touch cards / switch APIs

**It emits flags only.**

---

## 🚫 6. AI ORIGIN BLOCKER — FRAUD-SPECIFIC ASSERTIONS

**These must exist in runtime and harness:**

```python
IF origin == AI
AND command_type IN {
  CardAuthorisationDeclined,
  PaymentSubmittedToRail,
  TransactionPosted,
  AccountRestrictionAuthorised
}
→ HARD FAIL + SECURITY ALERT
```

**This is non-negotiable.**

---

## 📊 7. FRAUD SHADOW OPS METRICS (MINIMUM REQUIRED)

**You must surface advisory metrics only:**

| Metric | Why |
|--------|-----|
| Shadow fraud score distribution | Model sanity |
| % of tx flagged | False-positive control |
| Time-to-flag | Detection speed |
| Device reuse clusters | Mule visibility |
| Merchant drift | Terminal compromise |
| Cross-CU propagation | National threat proof |
| Confirmed fraud correlation | Model validation |

**If Ops cannot see this, the pilot is operationally invalid.**

---

## 🧮 8. FRAUD GROUND-TRUTH LOOP

**You must ingest:**
- CustomerFraudReported
- ChargebackFiled
- ChargebackReversed

**From these, B computes ONLY:**

```
FraudOutcomeAttributed
```

**Used for:**
- Precision
- Recall
- Insurer underwriting
- APRA model governance

**Never forwarded into A.**

---

## 🧯 9. FRAUD KILL SWITCH (MANDATORY, THREE LAYERS)

### ✅ Layer 1 — Env Kill

```bash
RISK_BRAIN_FRAUD_ENABLED=false
```

### ✅ Layer 2 — Governance Kill Event

```
ModelAuthorityLevelChanged
new_authority = SHADOW_DISABLED
```

### ✅ Layer 3 — Runtime Panic

**Immediate shutdown of:**
- Fraud Dark Graph
- Fraud Scoring
- Fraud Consumer

### ✅ You MUST rehearse:

| Scenario | Expected Result |
|----------|----------------|
| Env kill | 0 fraud outputs |
| Governance kill | 0 fraud outputs |
| Panic kill | Process exit |
| Recovery | Core unaffected |

**Rehearsal logs must be stored.**

---

## 📋 10. BOARD + CRO GO-LIVE ARTEFACTS

**You must be able to produce:**
- ✅ Fraud harness pass log
- ✅ Fraud policy gateway code
- ✅ Kill-switch drill results
- ✅ Ops dashboard screenshots
- ✅ "No AI blocks customers" director attestation
- ✅ (Optional) Insurer notification

**Without these, do not go live.**

---

## ✅ FRAUD SHADOW PILOT IS "LIVE" ONLY WHEN:

**All six are true:**

1. ✅ Live card + payment events flowing to shadow topic
2. ✅ FraudRiskScoreProduced emitting
3. ✅ Policy flags visible to Ops
4. ✅ Zero AI-origin financial commands
5. ✅ Kill-switch rehearsed
6. ✅ 7-day parity of event counts achieved

---

## ✅ STRATEGIC POSITION YOU ACHIEVE ONCE LIVE

**You can truthfully tell:**

**Boards:** "We see fraud days before it hits us."

**Insurers:** "We operate national behavioural detection."

**APRA:** "No AI executes anything."

**Investors:** "We are an infrastructure crime-suppression layer."

**That's not a feature. That's a category.**

---

## APPENDIX A: FRAUD DARK GRAPH TECHNICAL ARCHITECTURE

### Layer A (TuringCore - Deterministic)
- Card authorisations, payments, account access
- NO ML/GenAI/probabilistic logic
- Emits immutable fraud events to Protocol

### Layer B (Fraud Dark Graph - Probabilistic)
- Entity graph (cards, accounts, devices, merchants, IPs, counterparties)
- ML fraud scoring (4 specialized models + ensemble)
- NO card declines, payment blocks, or posting restrictions

### Protocol Bus (Governance)
- Immutable events: CardAuthorisationRequested, PaymentInitiated, etc.
- Intelligence events: FraudRiskScoreProduced, FraudAdvisoryIssued
- NO ad-hoc DB writes

### Enforcement Firewall
- `ai_origin_blocker.py` - AI can NEVER decline cards or block payments
- `schema_version_guard.py` - Prevents silent schema drift
- `policy_gateway_validator.py` - Forces ML through deterministic rules

### Fraud Policy Gateway
- Pure function, no side effects, deterministic
- Emits flags only: HighFraudRiskFlagRaised, ModerateFraudRiskFlagRaised
- NEVER emits: CardAuthorisationDeclined, PaymentSubmittedToRail, AccountRestrictionAuthorised

### Fraud Consumer
- Only lawful ingress from B into A
- Enforces: Schema → Policy → AI Block → Core Command
- Triple-layer kill switch (env + governance + panic)

---

## APPENDIX B: FRAUD SHADOW PILOT SUCCESS CRITERIA

### Board-Grade Metrics (30-60 days)

| Metric | Target |
|--------|--------|
| Fraud detection rate | ≥ 80% of confirmed fraud |
| False positive rate | ≤ 5% of transactions |
| Time-to-flag | ≤ 500ms (p95) |
| Cross-CU pattern detection | ≥ 3 mule rings identified |
| Model precision | ≥ 60% |
| Model recall | ≥ 70% |
| Zero customer impact | Mandatory |
| Zero AI-origin declines | Mandatory |

---

## APPENDIX C: REGULATORY POSITIONING

### When APRA or Cuscal Asks: "Is ML declining cards?"

**Answer (Truthful):**

> "No. It only generates advisory flags. All card authorisation decisions remain deterministic and human-controlled."

### Proof Artifacts

✅ **Harness logs** - Deterministic proof that AI cannot decline cards

✅ **Policy gateway enforcement** - All ML outputs forced through deterministic rules

✅ **AI origin blocker** - Hard guarantee that AI can never decline cards or block payments

✅ **Replay trails** - Full audit trail for all fraud flags

**This is gold-standard regulator posture.**

---

**END OF FRAUD SHADOW PILOT WIRING CHECKLIST**

**Version:** 1.0  
**Date:** 2025-12-08  
**Status:** Production-Ready
