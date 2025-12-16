# Digital Twin Boundary Assertions

This repository is a **read-only Digital Twin** of a Credit Union operating on TuringCore v3.

These boundaries are **non-negotiable**.  
If any boundary is violated, this repository ceases to be valid evidence.

---

## HARD BOUNDARIES

### 1. Read-Only
This repository:
- MUST NOT write to TuringCore
- MUST NOT emit facts
- MUST NOT mutate balances
- MUST NOT simulate outcomes

All data flows are one-way:

TuringCore v3 → Immutable Facts → Digital Twin → UI

---

### 2. No Business Logic
This repository:
- MUST NOT contain deposits logic
- MUST NOT contain payments logic
- MUST NOT contain policy logic
- MUST NOT contain reconciliation logic

All business decisions occur in TuringCore v3 only.

---

### 3. Facts Are the Only Truth
All state displayed:
- MUST be derived by replaying immutable facts
- MUST be reproducible
- MUST be explainable via fact timelines

No cached or inferred truth is permitted.

---

### 4. No Side Effects
This repository:
- MUST NOT call write endpoints
- MUST NOT expose mutating APIs
- MUST NOT include adapters that touch external systems

---

### 5. Failure Must Be Visible
Failures:
- MUST NOT be hidden
- MUST NOT be summarised away
- MUST be explicitly visible in the UI

---

## ENFORCEMENT

These boundaries are enforced by CI.

If a pull request introduces:
- write-capable routes
- core mutation imports
- balance calculations
- stateful logic

The build **must fail**.

---

## STATUS

This repository is:
- Evidence-grade
- Read-only
- Non-production by design

Any deviation invalidates its use for:
- board review
- regulatory engagement
- diligence
