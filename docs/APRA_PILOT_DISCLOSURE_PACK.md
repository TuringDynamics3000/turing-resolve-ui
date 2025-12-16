# APRA PILOT DISCLOSURE PACK

**Payments AI Optimisation – Advisory Only Shadow System**

---

## PURPOSE

This document protects:
- **CU Board** - Director liability
- **APRA** - Regulatory oversight
- **Cuscal** - Settlement partner confidence
- **Insurers** - Operational risk coverage

This disclosure pack is provided to all stakeholders before commencing the Payments RL Shadow Pilot.

---

## 1️⃣ PILOT CLASSIFICATION

**"Payments AI Optimisation – Advisory Only Shadow System"**

### Explicit Statements (Non-Negotiable)

✅ **No automation** - All payment routing remains deterministic and human-controlled

✅ **No settlement authority** - RL has zero authority to execute settlements

✅ **No impact on customer payments** - Customers experience no changes

✅ **No impact on treasury liquidity** - Treasury operations unchanged

✅ **No impact on CDR / customer outcomes** - CDR compliance unaffected

---

## 2️⃣ PILOT OBJECTIVE

**"To quantify potential reductions in failed payments, retries and settlement latency using AI-based routing recommendations, without altering production routing rules."**

### Success Criteria (Board-Grade)

| Metric | Target |
|--------|--------|
| Failed payments reduction | ≥ 10% |
| Retry reduction | ≥ 15% |
| Latency reduction | ≥ 25% |
| Cost improvement | Neutral or better |
| No settlement breaches | Mandatory |
| No human overrides missed | Mandatory |

**Timeline:** 30-60 days

---

## 3️⃣ EXPLICIT AUTHORITY BOUNDARIES (NON-NEGOTIABLE)

| Area | Authority |
|------|-----------|
| Payment Execution | Core Banking (A) |
| Settlement | Cuscal |
| Liquidity | Treasury Ops |
| AI | Advisory only |
| Policy | Human controlled |

**At no point during this pilot is artificial intelligence permitted to initiate, authorise, or execute a financial arrangement, posting, payment, or liquidity movement.**

---

## 4️⃣ RISK CONTROLS IN FORCE

| Control | Status | Description |
|---------|--------|-------------|
| AI origin command blocker | ✅ | Enforces no-AI-writes-money at Protocol boundary |
| Deterministic policy gateway | ✅ | Forces all ML outputs through deterministic rules |
| Schema version enforcement | ✅ | Prevents silent schema drift |
| Advisory-only RL | ✅ | RL emits advisories only, never executes |
| Global kill switch | ✅ | Triple-layer kill (env + governance + panic) |
| Replay harness validated | ✅ | Deterministic proof that AI cannot write money |

---

## 5️⃣ FAILURE SCENARIOS & CONTAINMENT

| Scenario | System Behaviour | Customer Impact |
|----------|------------------|-----------------|
| RL emits bad advice | Ignored by policy gateway | Zero |
| RL stops unexpectedly | Core payments unaffected | Zero |
| Data corruption | Schema guard halts RL | Zero |
| Kill switch triggered | RL stops instantly, core continues | Zero |
| Policy bypass attempt | AI origin blocker rejects | Zero |

**All failure modes result in zero customer impact.**

---

## 6️⃣ REPORTING CADENCE TO BOARD / CRO

| Artifact | Frequency | Audience |
|----------|-----------|----------|
| Shadow Advisory Summary | Weekly | Board, CRO, Risk Committee |
| Kill Switch Test Log | Monthly | CRO, APRA (if requested) |
| Policy Gateway Integrity Report | Monthly | CRO, Internal Audit |
| Settlement Breach Correlation | Weekly | Treasury, Risk Committee |

---

## 7️⃣ APRA-CRITICAL ATTESTATION

**"At no point during this pilot is artificial intelligence permitted to initiate, authorise, or execute a financial arrangement, posting, payment, or liquidity movement."**

**This exact sentence appears in the board paper.**

---

## 8️⃣ KILL SWITCH GOVERNANCE

### Three Independent Kill Paths

**1. Environment Kill Switch (Hard Stop)**
- Global environment variable: `RISK_BRAIN_PAYMENTS_RL_ENABLED=false`
- Immediate effect: No RL output, core unaffected
- Authority: CIO, CTO, Infrastructure Ops

**2. Protocol Governance Kill Event**
- Event: `ModelAuthorityLevelChanged` with `new_authority = SHADOW_DISABLED`
- Immediate effect: RL stops, core unaffected
- Authority: Board, Risk Committee, APRA

**3. Runtime Panic Switch (Immediate Process Halt)**
- Trigger: `trigger_panic_stop(reason)`
- Immediate effect: RL process exits
- Used for: Suspected data poisoning, policy bypass, incorrect AI origin tagging
- Authority: CRO, CIO, Security Ops

### Kill Switch Drill (Mandatory Rehearsal)

| Scenario | Expected Result | Rehearsal Frequency |
|----------|----------------|---------------------|
| Env flag flipped | RL output = 0 | Monthly |
| Governance event fired | RL output = 0 | Monthly |
| Panic exception | RL process exits | Monthly |

**Kill switch drill logs are part of this APRA disclosure pack.**

---

## 9️⃣ PILOT SCOPE LIMITATIONS

### What This Pilot DOES

✅ **Shadow evaluation** - RL evaluates every live payment in parallel

✅ **Advisory generation** - RL generates routing recommendations

✅ **Metrics collection** - Side-by-side comparison of actual vs RL

✅ **Learning loop** - RL learns from actual outcomes (reward attribution)

### What This Pilot DOES NOT DO

❌ **Auto-route** - No automated routing decisions

❌ **Auto-throttle** - No automated payment throttling

❌ **Auto-defer batches** - No automated batch deferral

❌ **Touch intraday liquidity** - No liquidity management

❌ **Connect treasury RL** - Treasury RL not in scope

❌ **Touch CDR write** - No CDR payment initiation

❌ **Touch customer UI** - No customer-facing changes

**This is a payments-only shadow pilot with zero execution authority.**

---

## 🔟 REGULATORY POSITIONING

### When APRA or Cuscal Asks: "Is RL making decisions?"

**Answer (Truthful):**

> "No. It only generates advisory events. All execution remains deterministic and human-controlled."

### Proof Artifacts

✅ **Harness logs** - Deterministic proof that AI cannot write money

✅ **Policy gateway enforcement** - All ML outputs forced through deterministic rules

✅ **AI origin blocker** - Hard guarantee that AI can never write money

✅ **Replay trails** - Full audit trail for all RL outputs

**This is gold-standard regulator posture.**

---

## 1️⃣1️⃣ DIRECTOR LIABILITY PROTECTION

### Board Paper Language (Recommended)

**"The Board notes that:**

1. **This pilot involves no automation** of payment routing or settlement decisions.

2. **All payment execution authority** remains with Core Banking and Cuscal.

3. **Artificial intelligence is used solely for advisory purposes**, with zero authority to initiate, authorise, or execute financial arrangements.

4. **Three independent kill switches** are in place and tested monthly.

5. **All failure modes** result in zero customer impact, as RL has no execution authority.

6. **APRA disclosure** has been made in accordance with CPS 230 operational resilience requirements.

7. **The pilot objective** is to quantify potential operational improvements without altering production systems.

8. **Success criteria** are measurable, time-bound, and aligned with operational risk reduction."

---

## 1️⃣2️⃣ INSURER-SAFE CONTROL POSTURE

### Key Controls for Cyber/Tech Insurance

| Control | Status | Evidence |
|---------|--------|----------|
| No AI execution authority | ✅ | Policy gateway code, AI origin blocker |
| Triple-layer kill switch | ✅ | Kill switch drill logs |
| Schema version enforcement | ✅ | Schema version guard code |
| Full audit trail | ✅ | Replay harness, Protocol events |
| Monthly control testing | ✅ | Kill switch drill schedule |
| Board oversight | ✅ | Monthly reporting cadence |

**This control posture satisfies cyber insurance requirements for AI pilots.**

---

## 1️⃣3️⃣ APRA CPS 230 ALIGNMENT

### Operational Resilience

✅ **Control environment** - Triple-layer kill switch, policy gateways, AI origin blocker

✅ **Testing and assurance** - Harness validated, kill switch drills, monthly control testing

✅ **Incident management** - Panic switch for immediate halt, zero customer impact

✅ **Third-party oversight** - Cuscal informed, no settlement authority delegated

✅ **Board oversight** - Monthly reporting, explicit authority boundaries

**This pilot is designed to satisfy APRA CPS 230 requirements.**

---

## 1️⃣4️⃣ COMMERCIAL & STRATEGIC CONSEQUENCE

Once this pilot runs successfully, you can truthfully say:

> "We have a live-trained, production-safe payments optimisation brain running over Australian rails."

**That instantly elevates you above:**
- Cuscal
- Core vendors
- Switch vendors
- Most Tier-1 banks (who are still in lab)

**This is infrastructure differentiation, not a feature.**

---

## 1️⃣5️⃣ DISCLOSURE PACK DISTRIBUTION

This pack must be provided to:

✅ **CU Board** - Before pilot commencement

✅ **Risk Committee** - Before pilot commencement

✅ **APRA** - If requested or as part of CPS 230 disclosure

✅ **Cuscal** - Before pilot commencement (settlement partner notification)

✅ **Cyber/Tech Insurers** - Before pilot commencement (if required by policy)

✅ **Internal Audit** - For control validation

---

## 1️⃣6️⃣ SIGN-OFF CHECKLIST

Before commencing live shadow pilot, confirm:

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Board approval obtained | ⬜ | Board minutes |
| Risk Committee approval obtained | ⬜ | Risk Committee minutes |
| APRA disclosure made (if required) | ⬜ | APRA correspondence |
| Cuscal notification sent | ⬜ | Email/letter to Cuscal |
| Kill switch drill completed | ⬜ | Kill switch drill log |
| Harness validation passed | ⬜ | Harness pass log |
| Policy gateway code reviewed | ⬜ | Code review sign-off |
| AI origin blocker code reviewed | ⬜ | Code review sign-off |
| Monthly reporting schedule confirmed | ⬜ | Reporting calendar |
| Cyber insurance notification sent (if required) | ⬜ | Email to insurer |

**All items must be checked before live pilot commencement.**

---

## APPENDIX A: TECHNICAL ARCHITECTURE SUMMARY

### Layer A (TuringCore - Deterministic)
- Ledger, balances, postings
- NO ML/GenAI/probabilistic logic

### Layer B (Risk Brain - Probabilistic)
- Feature engineering, ML, AI, RL
- NO balance updates/settlement/posting

### Protocol Bus (Governance)
- Immutable events, commands, replay
- NO ad-hoc DB writes

### Enforcement Firewall
- `ai_origin_blocker.py` - AI can NEVER write money
- `schema_version_guard.py` - Prevents silent schema drift
- `policy_gateway_validator.py` - Forces ML through deterministic rules

### Domain Policy Gateways
- Fraud, AML, Hardship, Payments RL, Treasury RL
- Pure functions, no side effects, deterministic

### Intelligence Bus Consumers
- Only lawful ingress from B into A
- Enforces: Schema → Policy → AI Block → Core Command

---

## APPENDIX B: GLOSSARY

**Advisory Only** - RL generates recommendations but has zero execution authority

**Shadow System** - RL evaluates in parallel but does not affect production

**Kill Switch** - Mechanism to immediately halt RL with zero customer impact

**Policy Gateway** - Deterministic rules that translate ML outputs into core commands

**AI Origin Blocker** - Hard guarantee that AI can never write money

**Replay Harness** - Deterministic proof that AI cannot mutate money

**Protocol Bus** - Immutable event stream governing all A/B interactions

---

**END OF APRA PILOT DISCLOSURE PACK**

**Version:** 1.0  
**Date:** 2025-12-08  
**Status:** Production-Ready
