# Protocol-Only Writes Governance

**Status:** ENFORCED  
**Effective Date:** 2024-12-18  
**Last Updated:** 2024-12-18  
**Owner:** TuringDynamics Engineering

---

## Executive Summary

All state mutations in TuringCore MUST flow through the ProtocolGateway. Direct database writes are PROHIBITED. This is a structural guarantee, not a policy preference.

---

## The Invariant

> **No state change may occur outside the ProtocolGateway.**

This means:
- Every INSERT, UPDATE, DELETE must go through `gateway.executeWrite()`
- Every fact append must go through `gateway.appendFact()`
- Every decision record must go through `gateway.recordDecision()`
- No exceptions. No backdoors. No "just this once."

---

## Why This Matters

### 1. Governance Integrity
If writes can bypass the gateway, governance can be circumvented. A single backdoor invalidates the entire constitutional model.

### 2. Audit Completeness
The gateway maintains a complete audit log of all mutations. Bypassing it creates gaps in the audit trail that regulators will find.

### 3. Replay Determinism
Event sourcing depends on all state changes being recorded as facts. Direct writes break replay capability.

### 4. Evidence Validity
Evidence packs prove what happened. If mutations can occur outside the gateway, evidence packs are incomplete and potentially fraudulent.

---

## Enforcement Mechanisms

### 1. Structural Enforcement (ProtocolGateway)

```typescript
// All writes MUST use the gateway
import { gateway } from '@/server/core/gateway/ProtocolGateway';

// ✅ CORRECT: Write through gateway
await gateway.appendFact('deposits', accountId, 'CREDIT', { amount: 100 }, 'deposit-handler');

// ❌ FORBIDDEN: Direct database write
await db.insert(depositsFacts).values({ ... }); // CI will catch this
```

### 2. CI Enforcement

The CI pipeline scans all non-exempt files for forbidden write patterns:

```yaml
# .github/workflows/protocol-enforcement.yml
- name: Check for direct writes
  run: |
    pnpm run check:protocol-writes
    # Fails if any direct writes found outside gateway
```

Forbidden patterns:
- `db.insert(`
- `db.update(`
- `db.delete(`
- `.execute('INSERT`
- `.execute('UPDATE`
- `.execute('DELETE`

### 3. Code Review Gate

All PRs touching database operations require review from `@turingdynamics/core-governance` team.

---

## Exempt Files

Only these locations may contain direct database writes:

| Location | Reason |
|----------|--------|
| `server/core/gateway/` | Gateway implementation itself |
| `server/adapters/` | Gateway adapter implementations |
| `drizzle/migrations/` | Schema migrations (one-time) |
| `tests/`, `__tests__/` | Test fixtures |
| `*.spec.ts`, `*.test.ts` | Test files |

---

## Gateway Audit Log

Every gateway operation is recorded:

```typescript
interface GatewayAuditRecord {
  operationId: string;      // Unique operation ID
  operation: GatewayOperation;  // FACT_APPEND, PROJECTION_UPDATE, etc.
  module: string;           // deposits, payments, etc.
  entityId: string;         // Account ID, Payment ID, etc.
  timestamp: Date;          // When it happened
  callerContext: string;    // Who initiated it
  factHash?: string;        // Hash of the fact data
  success: boolean;         // Did it succeed?
  errorMessage?: string;    // If failed, why?
}
```

---

## Violation Response

### If CI Catches a Direct Write

1. PR is blocked automatically
2. Developer must refactor to use gateway
3. No exceptions granted via PR comments

### If a Direct Write Reaches Production

1. Incident declared immediately
2. Affected data quarantined
3. Replay verification triggered
4. Root cause analysis required
5. Governance exception documented (if intentional)

---

## Migration Path

For existing code with direct writes:

1. **Identify**: Run `pnpm run check:protocol-writes` locally
2. **Refactor**: Replace direct writes with gateway calls
3. **Test**: Verify behavior unchanged
4. **Verify**: Run CI checks
5. **Document**: Update any affected documentation

---

## Governance Exception Process

In rare cases, a direct write may be necessary (e.g., emergency data fix). The process:

1. Create GitHub Issue with `governance-exception` label
2. Document: What, Why, Impact, Rollback Plan
3. Require approval from 2 members of `@turingdynamics/core-governance`
4. Execute with audit logging enabled
5. Post-mortem within 48 hours

---

## Verification

To verify protocol-only writes are enforced:

```bash
# Run CI check locally
pnpm run check:protocol-writes

# View gateway audit log
curl http://localhost:3000/api/gateway/audit

# Verify no direct writes in codebase
grep -r "db.insert\|db.update\|db.delete" server/ --include="*.ts" | grep -v gateway | grep -v adapters
```

---

## Related Documents

- [ProtocolGateway.ts](../../server/core/gateway/ProtocolGateway.ts) - Implementation
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture
- [SURFACE_FREEZE.md](./SURFACE_FREEZE.md) - API surface freeze

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2024-12-18 | Initial governance document | TuringDynamics |
