# TURINGCORE – REGULATOR PRE-ENGAGEMENT BRIEFING PACK (v1.0)

**Audience:**
- APRA – Prudential Supervision
- AUSTRAC – AML/CTF Supervision
- ASIC – Consumer Data & Market Integrity

**Classification:** Regulatory – Pre-Approval Briefing

**Purpose:** Early supervisory alignment prior to any live execution authority

---

## 1. Purpose of This Engagement

This briefing seeks to:

- Introduce TuringCore as a national, multi-tenant core banking and risk infrastructure platform designed for Australian Credit Unions and Mutual Banks.
- Establish early supervisory transparency around:
  - AI usage boundaries
  - National fraud & AML intelligence
  - Payments and treasury optimisation
- Confirm that all current intelligence capabilities operate in:
  - **Shadow / advisory-only mode with zero execution authority.**

This engagement is **not** a request for:

- Product approval
- Model validation
- Licence variation

It is a supervisory positioning and alignment discussion.

---

## 2. System Classification (Regulatory Framing)

TuringCore should be viewed as:

- A hosted core banking execution platform (Layer A)
- With a non-executing national intelligence overlay (Layer B)
- Governed by a deterministic event protocol separating:
  - Intelligence
  - Human authority
  - Financial execution

It is **not**:

- A decision-making AI bank
- A consumer-facing financial service
- A non-deterministic execution system

---

## 3. Authority Separation (Hard Regulatory Boundary)

| Function | Authority |
|---|---|
| Ledger posting | Deterministic core only |
| Payments execution | Cuscal / licensed rails |
| Card authorisation | Scheme + issuer rules |
| Treasury liquidity | Human treasury operations |
| Fraud blocking | Human-controlled only |
| AML reporting (SMRs/TTRs) | Human compliance only |
| AI systems | Advisory only |

**Formal Declaration:**

> Artificial intelligence within TuringCore has no technical pathway to execute financial transactions, freeze accounts, block cards, move liquidity, or submit regulatory reports.

---

## 4. AI Usage Posture (Regulator-Safe by Construction)

All AI models currently operate in:

- ✅ Shadow mode
- ✅ Advisory only
- ✅ No execution privileges
- ✅ Deterministic policy-gated
- ✅ Human escalation required

**Active Shadow Domains:**

| Domain | Mode | Impact |
|---|---|---|
| Payments Routing (RL) | Advisory | None |
| Fraud Detection | Advisory | None |
| Cross-CU Dark Graph | Advisory overlay | None |
| AML Behavioural Models | Advisory | None |
| Treasury RL | Advisory | None |

---

## 5. Protocol Governance (Key Control Mechanism)

All system behaviour is governed by the Turing Protocol, which enforces:

- Schema version control
- AI origin blocking
- Deterministic policy gateways
- Immutable event chaining
- Full replay-based auditability

This creates a provable legal boundary between:

- Machine inference
- Human decisions
- Financial execution

---

## 6. APRA-Relevant Prudential Controls

Aligned to CPS-230 / CPS-234 intent:

- Deterministic execution paths
- No automated AI control of:
  - Payments
  - Liquidity
  - Credit
- Triple kill-switch architecture:
  - Environment-level
  - Governance-level
  - Runtime panic
- Full replay of:
  - Failures
  - Escalations
  - Kill-switch activations

**Systemic Risk Positioning:**

> Intelligence cannot autonomously create or amplify systemic financial risk.

---

## 7. AUSTRAC-Relevant AML Controls

- Behavioural pattern-of-life AML models
- Deterministic escalation thresholds
- Human-only investigations
- Human-only SMR/TTR submission
- Protocol-replay AUSTRAC evidence generation
- WORM retention for 7+ years

**Key Assurance:**

> No AI system can submit an AUSTRAC report or apply account restrictions.

---

## 8. ASIC / CDR Controls

Protocol-native:

- CDR Read
- CDR Write (human-authorised)
- Event-level consent capture
- Immutable consent revocation trails
- No direct AI interaction with consumer consent flows

---

## 9. National Fraud & Cross-CU Intelligence (Supervisory Interest Area)

TuringCore operates a Cross-CU Anonymised Dark Graph:

- No raw PII in national layer
- Hash-based identity linking
- Each CU sees only:
  - Local account impact counts
  - National risk context

Enables early detection of:

- Mule networks
- Terminal compromise
- Cross-institution laundering

This provides system-level crime observability without violating data sovereignty.

---

## 10. Insurance & Operational Resilience Implications

The platform materially reduces:

- Cyber execution blast radius
- Automated fraud amplification risk
- AML late-reporting exposure
- False customer harm events

This has already enabled engagement with:

- PI insurers
- Cyber underwriters
- Financial crime insurers

as a loss-suppression infrastructure rather than a loss driver.

---

## 11. What Is Explicitly Out of Scope (At This Stage)

The following are not live and not proposed without separate regulatory engagement:

- Automated AI payment routing
- Automated AI fraud blocking
- Automated AI credit approvals
- Automated AML report submission
- Automated liquidity execution

Any future move into these domains would require:

- Board resolution
- Insurer re-underwriting
- Formal APRA/AUSTRAC engagement

---

## 12. Engagement Objectives with Regulators

We seek:

- Supervisory feedback on:
  - National intelligence overlays across multiple ADIs
  - Validation of advisory-only AI posture
  - Guidance on future execution authorisation pathways
- Early alignment on data-sharing boundaries under anonymisation
- Confirmation of acceptable AML evidence models using Protocol replay

---

## 13. Transparency Commitments

TuringCore commits to:

- Pre-notification before any change in AI authority
- Regulator-accessible replay artefacts
- Kill-switch drill logs on request
- Model governance documentation for AML on request
- Cooperative supervisory posture

---

## 14. Closing Positioning Statement

TuringCore is being built as a regulator-first national financial control plane, where:

- Execution remains deterministic
- Intelligence remains advisory
- Humans remain accountable
- All actions remain replayable

The objective is to reduce systemic risk in the Australian CU sector, not to introduce new forms of automation risk.
