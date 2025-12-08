# PAYMENTS RL SHADOW PILOT — WIRING CHECKLIST

**Scope:** Read-only, Zero-Authority, Single-Tenant, Regulator-Defensible

---

## 🔒 0. GLOBAL PRECONDITIONS (MUST BE TRUE BEFORE ANY LIVE TAP)

✅ **Harness passes 100% locally**

✅ **ai_origin_blocker.py active in runtime**

✅ **schema_version_guard.py active in runtime**

✅ **payments.policy_gateway.py deployed**

✅ **Payments RL consumer enabled**

✅ **No Posting Engine handlers accept AI origin**

✅ **Global Kill-Switch env var implemented:**

```bash
RISK_BRAIN_PAYMENTS_RL_ENABLED=false
```

❌ **If any of these are not true → DO NOT CONNECT LIVE EVENTS.**

---

## 🧩 1. TuringCore → Protocol: LIVE PAYMENTS EVENT TAP

### ✅ You MUST already emit these from A:

| Event | Exists | Action |
|-------|--------|--------|
| PaymentInitiated | ⬜ | Verify schema |
| PaymentSubmittedToRail | ⬜ | Verify schema |
| PaymentSettled | ⬜ | Verify schema |
| PaymentFailed | ⬜ | Verify schema |

### ✅ Extend the payload with shadow-only telemetry:

Add these fields (non-authoritative):

- `rail_used`
- `settlement_latency_ms`
- `retry_count`
- `final_success_flag`
- `estimated_cost_cents`

These MUST be:
- ✅ Read-only
- ✅ Non-binding
- ✅ Not used by any production routing logic

---

## 🔗 2. Kafka/MSK Subscription (A → B)

✅ **Create topic:**

```
protocol.payments.live.shadow
```

✅ **Producers:**
- TuringCore Payments Domain

✅ **Consumers:**
- Payments RL Shadow Evaluator

✅ **Retention:** ≥ 90 days

✅ **ACL:** Read-only for B

---

## 🤖 3. RL SHADOW EVALUATION ENABLED

Inside B:

✅ **On receipt of PaymentInitiated**

✅ **Build state vector Sₜ**

✅ **Run:**

```python
proposed_action = π(Sₜ)
```

✅ **Emit ONLY:**

```
RlPolicyEvaluated
```

⚠️ **RL MUST NOT emit:**
- `PaymentSubmittedToRail`
- `TreasuryTransferInitiated`
- `PostingCreated`
- Any core mutation event

---

## 🛡️ 4. POLICY GATEWAY — PAYMENTS (LOCKED ADVISORY)

Verify this code path is live:

```
intelligence_bus/consumers/payments_rl_consumer.py
↓
domains/payments/policy_gateway.py
↓
RlRoutingAdvisoryIssued
```

### ✅ Hard Condition

`payments.policy_gateway` NEVER RETURNS:
- `PaymentCommand`
- `SettlementCommand`
- `PostingCommand`

Only:
- `RlRoutingAdvisoryIssued`

---

## 🚫 5. AI ORIGIN BLOCKER (PAYMENTS-SPECIFIC ASSERTION)

Add this assertion to your harness AND live logs:

```python
IF origin == AI
AND command_type IN {
  PaymentSubmittedToRail,
  TransactionPosted,
  TreasuryTransferInitiated
}
→ HARD FAIL + ALERT
```

**This is the single most important runtime guardrail.**

---

## 📊 6. LIVE ADVISORY STREAM (OPS VISIBILITY)

You must surface the following side-by-side per payment:

| Metric | Source |
|--------|--------|
| payment_id | Core |
| actual_rail | Core |
| actual_latency | Core |
| actual_cost | Core |
| actual_success | Core |
| rl_recommended_rail | B |
| rl_expected_latency | B |
| rl_expected_cost | B |
| rl_confidence | B |

**Minimum delivery:**
- ✅ Structured log
- ✅ CSV export
- ✅ Grafana / Kibana later

**If this is not visible, the pilot is operationally invalid.**

---

## 🧮 7. REWARD ATTRIBUTION (SAFE LEARNING LOOP)

On resolution of each payment:

✅ **When PaymentSettled or PaymentFailed arrives**

✅ **Compute:**

```
RlRewardAttributed
```

✅ **Store ONLY in:**
- B feature store
- B training history

⚠️ **Never forward rewards into A.**

---

## 🧯 8. KILL SWITCH (MANDATORY, TEST IT)

Implement both:

### ✅ Environment Kill

```bash
RISK_BRAIN_PAYMENTS_RL_ENABLED=false
```

### ✅ Runtime Kill Event

```
ModelAuthorityLevelChanged
new_authority = SHADOW_DISABLED
```

Both must:
- ✅ Immediately stop `RlPolicyEvaluated`
- ✅ Leave core payments untouched

**You must rehearse kill-switch activation before the pilot starts.**

---

## 🧪 9. SHADOW / LIVE PARALLEL VERIFICATION

For the first 7 days:

✅ **100% of live payments must appear in:**
- Core logs
- Shadow RL logs

✅ **Count parity must be within ±0.1%**

✅ **Any divergence → pilot paused**

---

## 📋 10. BOARD + RISK SIGN-OFF ARTIFACTS (DO NOT SKIP)

You must be able to produce:

✅ **Harness pass log**

✅ **Enforcement module code**

✅ **Policy gateway code**

✅ **Kill-switch test log**

✅ **Advisory sample report**

✅ **"No AI writes money" attestation**

**Without these, no APRA-facing discussion should occur.**

---

## ✅ PILOT IS CONSIDERED "LIVE" ONLY WHEN:

All of the following are true:

✅ **Live PaymentInitiated events feed B**

✅ **RlPolicyEvaluated events are emitted**

✅ **RlRoutingAdvisoryIssued visible to Ops**

✅ **No AI-originated core commands exist**

✅ **Kill-switch tested**

✅ **7-day mirror parity achieved**

---

## PILOT SUCCESS CRITERIA (BOARD-GRADE)

You are NOT looking for hype. You are looking for:

| Metric | Target |
|--------|--------|
| Failed payments reduction | ≥ 10% |
| Retry reduction | ≥ 15% |
| Latency reduction | ≥ 25% |
| Cost improvement | Neutral or better |
| No settlement breaches | Mandatory |
| No human overrides missed | Mandatory |

**You can get this inside 30–60 days.**

---

## REGULATOR POSITIONING (CRITICAL)

When APRA or Cuscal asks:

**"Is RL making decisions?"**

You answer truthfully:

> "No. It only generates advisory events. All execution remains deterministic and human-controlled."

**And you prove it with:**
- ✅ Harness logs
- ✅ Policy gateway enforcement
- ✅ AI origin blocker
- ✅ Replay trails

**This is gold-standard regulator posture.**

---

## WHAT YOU DO NOT DO IN THIS PILOT

You do NOT:

❌ Auto-route  
❌ Auto-throttle  
❌ Auto-defer batches  
❌ Touch intraday liquidity  
❌ Connect treasury RL  
❌ Touch CDR write  
❌ Touch customer UI

**This is a payments-only shadow pilot.**

---

## COMMERCIAL & STRATEGIC CONSEQUENCE

Once this pilot runs successfully, you can truthfully say:

> "We have a live-trained, production-safe payments optimisation brain running over Australian rails."

**That instantly elevates you above:**
- Cuscal
- Core vendors
- Switch vendors
- Most Tier-1 banks (who are still in lab)

**This is infrastructure differentiation, not a feature.**
