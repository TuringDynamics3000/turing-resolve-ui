# TuringSentinel

> *Vigilant governance, provable decisions.*

## Overview

TuringSentinel is the command center for TuringDynamics governance. Unlike traditional audit logs that record what happened, TuringSentinel generates **cryptographic proof** that can be independently verified.

## Key Differentiator

When a regulator asks "prove this decision was correct," traditional systems show an audit log. TuringSentinel shows a **signed evidence pack with Merkle inclusion proof**.

| Traditional Governance | TuringSentinel |
|----------------------|----------------|
| Audit logs that can be modified | Cryptographic proof of every decision |
| Database records | Merkle-anchored evidence packs |
| Point-in-time snapshots | Deterministic replay guarantees |
| Role-based restrictions only | Architecturally forbidden commands |

## Core Capabilities

### 1. Role-Based Access Control (RBAC)

Granular permissions with maker/checker workflows. Every action requires proper authority.

**Role Categories:**
- `PLATFORM` - System operations, token issuance, read-only audit
- `GOVERNANCE` - Risk approval, compliance approval
- `ML` - Model authoring, operation, approval
- `OPERATIONS` - Agent and supervisor roles

### 2. Authority Facts

Every command execution generates an **Authority Fact** recording:
- Actor identity and role
- Command code and resource ID
- Decision (ALLOW/DENY)
- Reason code (AUTHORIZED, ROLE_MISSING, FORBIDDEN_COMMAND, APPROVAL_REQUIRED)
- Timestamp

### 3. Maker/Checker Workflows

High-risk commands require multi-party approval:
1. Maker proposes command
2. System validates maker has proposal authority
3. Checker(s) approve or reject
4. System validates checker has approval authority
5. Command executes only after all approvals

### 4. Forbidden Commands

Some operations are **architecturally blocked** — no role can execute them:
- `ADJUST_BALANCE` - Direct balance manipulation
- `DELETE_FACT` - Fact deletion
- `BACKDATE_TRANSACTION` - Backdating
- `MODIFY_EVIDENCE_PACK` - Evidence tampering

### 5. Evidence Packs

Every decision generates a cryptographic evidence pack containing:
- Decision metadata
- Input facts (hashed)
- Policy evaluation trace
- Output decision
- Merkle inclusion proof

## Routes

| Route | Description |
|-------|-------------|
| `/sentinel` | Landing page with overview and quick actions |
| `/sentinel/console` | Full RBAC console with roles, approvals, and audit |
| `/governance-controls` | Surface freeze status and absolute boundaries |

## Integration with TuringCore

TuringSentinel integrates with:
- **Resolve** - Decision engine for policy evaluation
- **Ledger** - Financial truth for balance verification
- **Evidence Vault** - Storage for evidence packs
- **Merkle Anchoring** - External proof anchoring

## Competitive Positioning

TuringSentinel directly competes with Constantinople's **Justinian** console:

| Justinian (Constantinople) | TuringSentinel (TuringDynamics) |
|---------------------------|--------------------------------|
| Named after Byzantine emperor who codified law | Named for vigilant protection with cryptographic proof |
| Implies authority by decree | Implies authority by evidence |
| "Trust us, we logged it" | "Verify it yourself — here's the proof" |
| AI-powered dashboards | Cryptographic evidence packs |
| Role-based workflows | Maker/checker with authority facts |
| Audit trails | Merkle-anchored, externally verifiable |

## API Reference

### RBAC Router

```typescript
// List all roles
GET /api/rbac/roles

// Get role assignments for user
GET /api/rbac/assignments/:userId

// Check command authority
POST /api/rbac/check-authority
{
  actorId: string,
  actorRole: string,
  commandCode: string,
  resourceId: string
}

// Create command proposal
POST /api/rbac/proposals
{
  commandCode: string,
  resourceId: string,
  proposedBy: string,
  proposedRole: string
}

// Approve proposal
POST /api/rbac/proposals/:id/approve
{
  approverId: string,
  approverRole: string
}
```

## Database Schema

TuringSentinel uses 7 dedicated tables:

1. `rbac_roles` - Role definitions
2. `role_assignments` - User-role mappings
3. `rbac_commands` - Command definitions
4. `command_role_bindings` - Command-role permissions
5. `command_proposals` - Pending approvals
6. `approvals` - Approval records
7. `authority_facts` - Immutable authority audit trail

## Version History

- **v1.0** - Initial release with RBAC, maker/checker, forbidden commands
- **v1.1** - TuringSentinel branding, landing page, competitive positioning
