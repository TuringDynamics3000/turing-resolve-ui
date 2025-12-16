# NATIONAL BANKING AI RISK & CRIME CONTROL
# INSURER DISCLOSURE PACK — v1.0

**Applicant:** TuringCore / TuringDynamics  
**Scope:** National Credit Union Banking Infrastructure + AI Advisory Systems  
**Coverage Sought:**
- Professional Indemnity (PI)
- Cyber
- Crime / Financial Institutions Bond

---

## 1. INSURED OPERATING PROFILE (CLEAR & NON-MISLEADING)

**Nature of Operations:**
- Cloud-hosted core banking infrastructure for Australian Credit Unions and Mutual Banks
- Payments processing (NPP, BECS, BPAY)
- Cards integration (Debit + Credit)
- Lending & deposits ledger
- Open Banking (read + write)
- AI-based advisory-only risk, fraud, AML, payments optimisation & liquidity intelligence

**Critical Declaration:**

> Artificial intelligence systems operated by TuringCore do not execute or authorise financial transactions. All AI outputs are strictly advisory and subject to deterministic policy enforcement and human control.

---

## 2. AUTHORITY BOUNDARY (THIS IS WHAT UNDERWRITERS CARE ABOUT MOST)

| Function | Authority |
|----------|-----------|
| Ledger posting | Deterministic core only |
| Payments execution | Cuscal / licensed rails |
| Card authorisation | Scheme + issuer rules |
| Treasury liquidity | Human treasury operations |
| Fraud blocking | Human-controlled only |
| AML reporting | Human compliance only |
| AI systems | **Advisory only (no execution)** |

**There is no scenario where AI:**
- ❌ Freezes accounts
- ❌ Declines cards
- ❌ Submits payments
- ❌ Moves liquidity
- ❌ Files AUSTRAC reports

**This materially reduces:**
- ✅ PI exposure
- ✅ Cyber execution risk
- ✅ Crime automation loss severity

---

## 3. AI RISK CONTAINMENT CONTROLS (TECHNICAL, ENFORCEABLE)

### 3.1 Protocol Enforcement Controls (Always-On)

✅ **AI Origin Blocker** — rejects any AI-originated command that attempts to mutate money

✅ **Deterministic Policy Gateways** — all escalation logic is rule-based, human-approved

✅ **Schema Version Guard** — prevents malformed or drifted AI outputs from propagating

✅ **Immutable Event Ledger** — all actions replayable and forensically verifiable

**These operate at runtime, not as procedural controls.**

### 3.2 Triple Kill-Switch Architecture

| Kill Layer | Mechanism | Purpose |
|------------|-----------|---------|
| Environment | `RISK_BRAIN_*_ENABLED=false` | Immediate system-wide disable |
| Governance | `ModelAuthorityLevelChanged` event | Board / regulator control |
| Runtime | Panic process halt | Cyber/poisoning containment |

**All three are independent. Any one disables AI instantly.**

---

## 4. FRAUD & CYBER SUPPRESSION CONTROLS (LOSS-MAKING EVENTS)

### 4.1 Fraud Shadow Detection Layer (Advisory Only)

**Live monitoring of:**
- Card transactions
- Payments
- Devices
- IP clusters
- Merchant behaviour

**Produces:**
- `FraudRiskScoreProduced`
- `HighFraudRiskFlagRaised` (advisory only)

**Cannot:**
- ❌ Block a card
- ❌ Decline a transaction
- ❌ Restrict accounts

**This removes:**
- ✅ False block liability
- ✅ Customer harm claims
- ✅ Scheme penalty exposure

### 4.2 National Cross-CU Dark Graph (Systemic Crime Suppression)

**Capabilities:**
- Cross-institution mule networks
- Terminal compromise rings
- Device fan-out rings
- Payment daisy-chain laundering

**Legal structure:**
- ✅ No raw PII in national layer
- ✅ Hashed, time-bucketed, anonymised
- ✅ Each CU only sees local impact count

**This materially reduces:**
- ✅ Time-to-detection
- ✅ Multi-CU correlated loss
- ✅ Silent systemic fraud propagation

**Insurers benefit from:**
- ✅ Portfolio-level crime visibility
- ✅ Early loss containment
- ✅ Better subrogation evidence

---

## 5. AML RISK CONTAINMENT (REGULATORY LOSS EVENTS)

**Pattern-of-life AML models** (structuring, mule layering, cross-border drift)

**All outputs:**
- ✅ Advisory only
- ✅ Human investigation required
- ✅ AUSTRAC reporting manual

**All SMRs generated via Protocol replay, not spreadsheets**

**This reduces:**
- ✅ AUSTRAC breach risk
- ✅ Late-reporting penalties
- ✅ Inadequate monitoring findings

---

## 6. PAYMENTS & TREASURY RISK (LARGE SEVERITY LOSSES)

### 6.1 Payments RL (Shadow Only)

**Evaluates:**
- NPP vs BECS routing
- Retry optimisation
- Failed-settlement avoidance

**Cannot:**
- ❌ Submit to rails
- ❌ Alter settlement routing
- ❌ Touch liquidity

**This means:**
- ✅ Zero AI-caused settlement risk
- ✅ Zero liquidity execution exposure

### 6.2 Treasury RL (Shadow Only)

**Intraday liquidity advisory only**

**No ability to:**
- ❌ Initiate transfers
- ❌ Call facilities
- ❌ Sweep accounts

**This removes:**
- ✅ Model-driven liquidity run risk
- ✅ Intraday margin delay risk

---

## 7. INCIDENT FORENSICS & CLAIM DEFENSIBILITY

**All events are:**
- ✅ Cryptographically chained
- ✅ Time-stamped
- ✅ Reconstructable via replay
- ✅ Linked to:
  - Policy decision
  - AI advisory output
  - Human enforcement action (or non-action)

**This supports:**
- ✅ Fast root-cause analysis
- ✅ Clear liability attribution

**Defence against:**
- ✅ Negligence claims
- ✅ System failure claims
- ✅ Improper automation claims
- ✅ AUSTRAC & APRA enforcement

---

## 8. CYBER RESILIENCE & CONTAINMENT

**Microservice isolation**

**No AI component has direct:**
- ❌ Database write access to money
- ❌ Card switch authority
- ❌ Treasury execution authority

**Kill-switch effectiveness:** < 1 second

**Shadow systems can be fully dark without production impact**

**This materially reduces:**
- ✅ Ransomware blast radius
- ✅ Malicious model manipulation severity
- ✅ Internal threat execution risk

---

## 9. CLAIM SEVERITY REDUCTION MECHANISMS (WHY PREMIUMS SHOULD DROP)

| Loss Class | Suppression Mechanism |
|------------|----------------------|
| Card fraud | National dark graph + early flags |
| Mule networks | Cross-CU device & IP clustering |
| AML penalties | Protocol-native reporting |
| Settlement losses | Payments RL shadow only |
| Liquidity losses | Treasury RL shadow only |
| False customer harm | Human-only enforcement |
| Cyber execution | AI origin blocker + kill switches |

**This is defensive infrastructure, not experimental AI.**

---

## 10. UNDERWRITER-FACING ATTESTATIONS (DIRECT QUOTES)

**You can use these exact lines in your proposal:**

> "Artificial intelligence within this platform is physically incapable of executing financial transactions."

> "All AI-generated outputs are advisory and must pass deterministic policy checks and human authorisation."

> "A triple kill-switch architecture exists with sub-second effective shutoff."

> "A national anonymised fraud graph provides early systemic crime detection without cross-CU data leakage."

**These statements are technically enforceable, not policy promises.**

---

## 11. REQUESTED UNDERWRITING CONSIDERATION

Given the above controls, we formally request:

✅ Reduced Crime deductible

✅ Lower Cyber BI sub-limit

✅ Favourable PI automation exclusions

✅ Recognition as a systemic crime-suppression platform

✅ Multi-CU portfolio underwriting discussions

---

## 12. SUPPORTING ARTEFACTS AVAILABLE ON REQUEST

**You can attach:**
- Risk Brain Harness logs
- Payments RL shadow metrics
- Fraud Ops shadow metrics
- Kill-switch drill logs
- Policy gateway code excerpts
- APRA pilot disclosure pack

---

## ✅ WHAT THIS PACK DOES FOR YOU STRATEGICALLY

**This document:**

✅ Changes the underwriting conversation from "AI risk" → "AI suppression control"

✅ Puts you into portfolio insurer dialogue, not single-client risk

✅ Supports Cyber + Crime premium compression

✅ Strengthens board risk posture

✅ De-risks Series A / B due diligence

---

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Contact:** TuringCore Risk & Compliance Team
