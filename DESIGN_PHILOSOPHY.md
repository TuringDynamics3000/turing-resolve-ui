# Design Philosophy: The Human-Machine Contract

> "You are not designing a better ops UI. You are designing the missing human-machine contract in financial systems."

## Core Principle

Turing Resolve is not a dashboard. It is **the interface to a governance contract** — a formal agreement between humans and machines about how financial decisions are made, recorded, and proven.

Every pixel, every API call, every state transition exists to serve one purpose: **making the contract visible, verifiable, and enforceable**.

---

## The Three Guarantees

### 1. No Execution Module Contains Decision Logic

The system enforces a strict separation:

| Layer | Responsibility | What It Cannot Do |
|-------|---------------|-------------------|
| **Request** | Capture intent | Execute anything |
| **Resolve** | Evaluate policy | Skip evaluation |
| **Decision** | Record outcome | Modify after recording |
| **Execution** | Apply decision | Make decisions |
| **Ledger** | Post financials | Reverse without decision |
| **Evidence** | Seal audit pack | Alter sealed records |

This is not a suggestion — it is an architectural invariant. The UI reflects this by showing the decision flow as a pipeline where each stage is discrete and auditable.

### 2. Every Decision Creates Cryptographic Evidence

When a decision is made, the system generates:

```
Decision Record
├── decision_id: UUID
├── request_hash: SHA-256 of original request
├── policy_version: Immutable reference to rules applied
├── outcome: ALLOW | REVIEW | DECLINE
├── timestamp: ISO 8601 with timezone
├── operator_id: Who (or what) made the decision
├── previous_hash: Link to prior decision (hash chain)
└── signature: Cryptographic seal
```

The hash chain means:
- Decisions cannot be reordered
- Decisions cannot be deleted
- Decisions cannot be modified
- Any tampering is mathematically detectable

### 3. Humans See What Machines See

The UI never hides complexity — it translates it. When an operator views a decision:

- They see the **exact policy** that was evaluated
- They see the **exact data** that was considered
- They see the **exact reason** for the outcome
- They can **verify the hash** independently

This is transparency as a feature, not a bug.

---

## Server-Driven State

The frontend has **no authority**. It is a view into server state, not a source of truth.

### Why This Matters

Traditional banking UIs often compute outcomes client-side for "responsiveness". This creates:

- **Inconsistency**: Client and server can disagree
- **Vulnerability**: Client logic can be manipulated
- **Audit gaps**: What the user saw ≠ what was recorded

Turing Resolve inverts this:

```
┌─────────────────────────────────────────────────────┐
│                    SERVER                           │
│  ┌─────────────────────────────────────────────┐   │
│  │  Append-Only Decision Store                  │   │
│  │  (Single Source of Truth)                    │   │
│  └─────────────────────────────────────────────┘   │
│                      │                              │
│                      ▼                              │
│  ┌─────────────────────────────────────────────┐   │
│  │  API Layer                                   │   │
│  │  POST /decisions                             │   │
│  │  POST /decisions/{id}/approve                │   │
│  │  POST /decisions/{id}/reject                 │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│                   FRONTEND                          │
│  ┌─────────────────────────────────────────────┐   │
│  │  React + shadcn/Radix                        │   │
│  │  (View Only - No Authority)                  │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

The frontend:
- **Requests** actions via API
- **Displays** server state
- **Never** computes outcomes
- **Never** holds authoritative state

---

## API Design

The API is intentionally minimal. Three endpoints handle all decision flow:

### `POST /decisions`

Create a new decision request. The server:
1. Validates the request
2. Evaluates against current policy
3. Records the decision with hash chain
4. Returns the sealed decision record

```typescript
interface DecisionRequest {
  type: 'LIMIT_INCREASE' | 'TRANSACTION' | 'ACCOUNT_OPEN' | ...;
  subject_id: string;      // Who/what is this about
  payload: Record<string, unknown>;  // Type-specific data
  requested_by: string;    // Origin of request
}

interface DecisionResponse {
  decision_id: string;
  outcome: 'ALLOW' | 'REVIEW' | 'DECLINE';
  hash: string;            // SHA-256 of this decision
  previous_hash: string;   // Link to chain
  timestamp: string;
  evidence_pack_id: string;
}
```

### `POST /decisions/{id}/approve`

Operator approves a decision in REVIEW state:

```typescript
interface ApprovalRequest {
  operator_id: string;
  reason?: string;
  override_policy?: string;  // If overriding, which policy
}
```

### `POST /decisions/{id}/reject`

Operator rejects a decision in REVIEW state:

```typescript
interface RejectionRequest {
  operator_id: string;
  reason: string;  // Required - must explain why
}
```

---

## Storage Architecture

### Append-Only Decision Store

Decisions are **never updated or deleted**. The store is append-only:

```sql
CREATE TABLE decisions (
  id UUID PRIMARY KEY,
  sequence_number BIGSERIAL,  -- Monotonic ordering
  type VARCHAR(50) NOT NULL,
  subject_id VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  outcome VARCHAR(20) NOT NULL,
  policy_version VARCHAR(50) NOT NULL,
  operator_id VARCHAR(100),
  reason TEXT,
  hash VARCHAR(64) NOT NULL,      -- SHA-256
  previous_hash VARCHAR(64),       -- Chain link
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Immutability enforced at DB level
  CONSTRAINT no_updates CHECK (TRUE)  -- Trigger prevents UPDATE
);

-- Index for chain verification
CREATE INDEX idx_decisions_hash ON decisions(hash);
CREATE INDEX idx_decisions_previous ON decisions(previous_hash);
```

### Hash Chain Construction

Each decision's hash is computed from:

```
hash = SHA-256(
  decision_id +
  sequence_number +
  type +
  subject_id +
  JSON.stringify(payload) +
  outcome +
  policy_version +
  operator_id +
  timestamp +
  previous_hash
)
```

This creates an unbreakable chain where:
- Altering any field changes the hash
- Changing the hash breaks the chain
- The chain can be verified by anyone with read access

### Optional: RedBelly Notarisation

For regulatory-grade immutability, decisions can be notarised on RedBelly blockchain:

```typescript
interface NotarisationRecord {
  decision_hash: string;
  redbelly_tx_id: string;
  block_number: number;
  timestamp: string;
}
```

This provides:
- Third-party timestamp proof
- Tamper evidence beyond internal controls
- Regulatory compliance for audit requirements

---

## UI Manifestation

The design philosophy manifests in specific UI patterns:

### Decision Flow Visualization

The six-stage pipeline is always visible:

```
Request → Resolve → Decision → Execution → Ledger → Evidence
```

Each stage shows:
- Current state (pending/complete/failed)
- Timestamp of completion
- Hash of stage output
- Link to evidence pack

### Hash Chain Indicator

Every decision shows its position in the chain:

```
┌─────────────────────────────────────────┐
│  Decision #4,847                        │
│  Hash: 7f3a...b2c1                       │
│  Previous: 9e2d...f4a8                   │
│  ✓ Chain verified                        │
└─────────────────────────────────────────┘
```

Members can click to see the full chain and verify independently.

### Transparency Timeline

For member-facing requests (limit increases, etc.):

```
Your Request Timeline
─────────────────────
◉ Submitted           Dec 18, 2:34 PM
│ Hash: 7f3a...b2c1
│ Sealed ✓
│
◉ Under Review        Dec 18, 2:35 PM  
│ Assigned to operator
│
○ Pending Decision    
│ Usually within 24 hours
```

This shows members that their request is:
- Recorded immutably
- Cryptographically sealed
- Progressing through a defined process

---

## Implementation Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | React 19 + shadcn/Radix | View layer (no authority) |
| State | tRPC + React Query | Server-driven state sync |
| API | Express + tRPC | Decision endpoints |
| Database | PostgreSQL | Append-only decision store |
| Hashing | Node.js crypto (SHA-256) | Chain construction |
| Notarisation | RedBelly SDK (optional) | Blockchain anchoring |

---

## The Contract in Practice

When a credit union member requests a limit increase:

1. **Member Portal** sends `POST /decisions` with type `LIMIT_INCREASE`
2. **Server** evaluates against policy, creates decision record
3. **Hash chain** links this decision to all previous decisions
4. **Ops Console** shows the decision in the review queue
5. **Operator** approves via `POST /decisions/{id}/approve`
6. **Member Portal** shows updated status with hash proof
7. **Evidence Vault** stores the complete audit pack

At every step, both human and machine can verify:
- What was requested
- What policy was applied
- What decision was made
- Who made it
- When it happened
- That nothing has been altered

This is the human-machine contract. The UI is just how we read it.

---

## Final Takeaway

> The append-only decision store with hash chain is the key — it means every decision is immutable, auditable, and provably ordered. The UI is just the human interface to that contract.

We are not building software. We are building **trust infrastructure**.

---

*Document Version: 1.0*  
*Last Updated: December 2024*  
*Turing Resolve - Decision Governance System*
