# Core vs CU Contract – TuringDynamics

**Hard Boundary Between Ring-0 Core and CU Edition**

**Version:** 1.0  
**Date:** 2025-01-15  
**Status:** Governance Policy

---

## 1. Purpose

This document defines the **hard boundary** between:

- **Ring-0 Turing Protocol Core** ("Regulated Core")
- **CU Edition** (product slice for credit unions)
- **Other verticals and products** (e.g. wealth, iCattle, ML services)

It exists to ensure:

- We maintain **exactly one** implementation of the Turing Protocol and ledger
- Regulated customers (CUs) run on a **clean, bounded core**
- Experiments and other business lines **cannot pollute** the core

---

## 2. Principles

### 2.1 Single Core Implementation

**TuringDynamics maintains one canonical implementation of the Turing Protocol Core.**

No forks, clones, or alternative ledger implementations are permitted for any vertical.

**Rationale:**
- Reduces testing burden
- Ensures regulatory compliance across all deployments
- Prevents divergence and maintenance nightmare
- Enables confident upgrades

---

### 2.2 Ring-0 Regulated Core

**Ring-0 is the only code allowed to:**
- Validate and execute Turing Protocol commands
- Mutate ledger or customer monetary state
- Persist events in the event store

**All other code is a consumer of Ring-0.**

---

### 2.3 Protocol-Only Mutation

**All state changes MUST follow the path:**

```
Command Gateway → Invariants → Events → Projections
```

**Direct DB writes to balances or aggregates are prohibited.**

**Enforcement:**
- Static analysis tools scan for direct UPDATE statements
- CI/CD fails on violations
- Architecture tests validate compliance

---

### 2.4 Verticals as Consumers

**CU Edition, wealth, iCattle, ML, dashboards, etc.:**
- Consume Ring-0 via **commands, queries, and events**
- May not contain alternative ledger logic
- May not bypass Ring-0 invariants

**Integration Pattern:**

```
Vertical Service → HTTP/gRPC → Command Gateway → Ring-0
                                                    ↓
Vertical Service ← HTTP/gRPC ← Query API ← Projections
```

---

### 2.5 Regulatory Clarity

**For any CU:**
- We can state exactly which Ring-0 version and CU Edition version processed their transactions
- We can reconstruct events and projections from that code and data alone
- We can provide complete audit trail from commands → events → balances

**This is essential for APRA compliance and customer confidence.**

---

## 3. Scope Definitions

### 3.1 Ring-0 Core

**Repository:** `TuringCore-v3`

**Responsibilities:**
- Protocol (command envelopes, event envelopes, validation)
- Tenants (creation, lifecycle, isolation)
- Auth hooks (integration points to authN/Z)
- Event store (append-only, immutable)
- Projections (accounts, customers, transactions, balances)
- Ledger/postings (multi-leg, double-entry, FX)
- Basic deposits and payments semantics

**Hard Rules:**
- No CU-specific product logic
- No vertical-specific logic (wealth, iCattle, etc.)
- No UI/BFF code
- No analytics or ML models

---

### 3.2 CU Edition

**Repository:** `TuringCore-v3` (CU Edition package)

**Responsibilities:**
- Ring-0 + CU product templating
- CU configuration (fees, tiers, marketing names)
- CU-specific API surface (subset of Ring-0 APIs)
- CU deployment topology (Helm charts, Terraform)

**Dependencies:**
- Ring-0 Core vX.Y.Z (explicit version pinning)

**Hard Rules:**
- Must not alter Ring-0 semantics
- Must not bypass Ring-0 invariants
- Must be compatible with at least one supported Ring-0 version

---

### 3.3 Other Products (Ring-1+)

**Examples:**
- iCattle (livestock/carbon domain)
- Wealth (investments, pods, Turings)
- Analytics (ML models, risk scoring)
- UIs (dashboards, reporting)
- Data products (Data Mesh, data science)

**Responsibilities:**
- Reside in Ring-1+ and communicate via APIs/events
- May not depend on Ring-0 internals
- May not bypass Command Gateway

---

## 4. Enforcement

### 4.1 Architecture Rules

**Static Analysis:**
- Only Ring-0 modules may depend on low-level persistence and ledger primitives
- Ring-1+ code may not import Ring-0 internals that bypass the Command Gateway
- No direct balance UPDATEs outside projection services

**Automated Checks:**
```python
# Example architecture test
def test_no_ring1_imports_ring0_internals():
    """Ring-1+ services must not import Ring-0 internals."""
    ring1_services = ["wealth", "icattle", "analytics", "dashboards"]
    ring0_internals = ["ledger", "events", "persistence"]
    
    for service in ring1_services:
        imports = get_imports(f"src/{service}")
        for internal in ring0_internals:
            assert f"turingcore_v3.core.{internal}" not in imports
```

---

### 4.2 CI Rules

**Any PR touching Ring-0 must pass:**

1. **Protocol/ledger invariants tests**
   - Conservation of value
   - Double-entry balance
   - No negative balances (unless overdraft allowed)
   - Tenant isolation

2. **CU-Digital acceptance tests**
   - All TC-01 to TC-10 must pass
   - Ledger coherence verified
   - Idempotency verified

3. **Static checks**
   - No direct balance UPDATEs
   - No direct writes to projection tables outside projection services
   - No forbidden imports

**If any check fails, the PR is blocked.**

---

### 4.3 Code Review Requirements

**Ring-0 Changes:**
- Require approval from 2+ core architects
- Require explicit risk assessment
- Require migration plan for breaking changes

**CU Edition Changes:**
- Require approval from 1+ CU product owner
- Must not alter Ring-0 semantics
- Must pass CU-Digital acceptance tests

**Ring-1+ Changes:**
- Standard code review process
- Must not touch Ring-0 or CU Edition code

---

## 5. Change Control

### 5.1 Ring-0 Changes

**Requirements:**
- Technical review by core engineering
- Regression of CU-Digital and other edition test suites
- Version bump (semantic versioning)
- Release notes with impact analysis
- RedBelly notarization of artifacts

**Process:**
1. Create change ticket (Jira) with:
   - Description of change
   - Risk assessment
   - Impact analysis
   - Migration plan (if breaking)
   
2. Submit PR with:
   - Code changes
   - Test updates
   - Documentation updates
   
3. Pass all CI checks:
   - Unit tests
   - Integration tests
   - CU-Digital acceptance tests
   - Static analysis
   
4. Code review by 2+ core architects

5. Merge and tag release:
   - Semantic version bump
   - Release notes published
   - Artifacts notarized

6. Deploy to environments:
   - Dev → UAT → Pre-Prod → Prod
   - CU-Digital validation at each stage

---

### 5.2 CU Edition Changes

**Requirements:**
- Must not alter Ring-0 semantics
- Must be compatible with at least one supported Ring-0 version
- Must pass CU-Digital acceptance tests

**Process:**
1. Create change ticket with:
   - Description of change
   - Ring-0 version compatibility
   - Customer impact analysis
   
2. Submit PR with:
   - Code changes
   - Test updates
   - Documentation updates
   
3. Pass all CI checks:
   - Unit tests
   - CU-Digital acceptance tests
   
4. Code review by CU product owner

5. Merge and tag release:
   - Version bump
   - Release notes published

---

### 5.3 Ring-1+ Changes

**Requirements:**
- Must not touch Ring-0 or CU Edition code
- Must use only public APIs

**Process:**
- Standard code review process
- May follow lighter change control
- No impact on regulated deployments

---

## 6. Versioning Strategy

### 6.1 Ring-0 Versioning

**Semantic Versioning:**
- **Major:** Breaking changes to protocol or ledger semantics
- **Minor:** New features, backward-compatible
- **Patch:** Bug fixes, no API changes

**Example:**
- Ring-0 v1.0.0 → v1.1.0 (new command type added)
- Ring-0 v1.1.0 → v2.0.0 (breaking change to event schema)

---

### 6.2 CU Edition Versioning

**Follows Ring-0 versioning:**
- CU Edition 1.0.0 runs on Ring-0 Core 1.x.x
- CU Edition 2.0.0 runs on Ring-0 Core 2.x.x

**Compatibility Matrix:**

| CU Edition | Ring-0 Core | Status |
|------------|-------------|--------|
| 1.0.0 | 1.0.0 - 1.2.x | Supported |
| 1.1.0 | 1.2.0 - 1.5.x | Supported |
| 2.0.0 | 2.0.0 - 2.3.x | Current |

---

### 6.3 Deployment Versioning

**Each CU deployment specifies:**
- Ring-0 version (e.g., `ring0:2.0.3`)
- CU Edition version (e.g., `cu-edition:2.0.1`)
- Git commit hash
- Build timestamp
- Notarization ID (RedBelly)

**Example Deployment Manifest:**
```yaml
deployment:
  tenant: CU_DIGITAL
  ring0_version: "2.0.3"
  cu_edition_version: "2.0.1"
  git_commit: "a1b2c3d4"
  build_timestamp: "2025-01-15T10:30:00Z"
  notarization_id: "rb://notary/xyz123"
```

---

## 7. Testing Requirements

### 7.1 Ring-0 Testing

**Unit Tests:**
- Command validation
- Invariants (no negative balances, conservation of value)
- Event serialization/deserialization
- Projection logic

**Property Tests:**
- Ledger invariants (double-entry, balance)
- Event replay determinism
- Tenant isolation

**Integration Tests:**
- End-to-end command → event → projection flow
- Multi-tenant scenarios
- Concurrent load testing

**Acceptance Tests:**
- CU-Digital v0.1 suite (TC-01 to TC-10)

---

### 7.2 CU Edition Testing

**Unit Tests:**
- Product configuration
- API surface validation
- Deployment topology

**Integration Tests:**
- CU-Digital acceptance suite
- API contract validation

---

### 7.3 Ring-1+ Testing

**Unit Tests:**
- Service-specific logic

**Integration Tests:**
- API integration with Ring-0
- Event consumption

---

## 8. Evidence for Regulators

**For each CU Edition release, we can produce:**

1. **Version Information:**
   - Ring-0 version number
   - CU Edition version number
   - Git commit hash
   - Notarized artifact IDs

2. **Test Evidence:**
   - CU-Digital acceptance test run reports
   - Unit test coverage reports
   - Integration test results
   - Performance test results

3. **Change Documentation:**
   - List of changes (features, fixes)
   - Risk/impact analysis
   - Migration plan (if breaking)
   - Rollback plan

4. **Audit Trail:**
   - All commands logged
   - All events immutable
   - All state changes traceable
   - Complete reconstruction possible

**This is how "best practice" actually shows up in an APRA meeting.**

---

## 9. Governance

### 9.1 Ownership

**Ring-0 Core:**
- Owner: Core Engineering Team
- Approvers: Core Architects (2+ required)

**CU Edition:**
- Owner: CU Product Team
- Approvers: CU Product Owner + Core Architect

**Ring-1+ Products:**
- Owner: Product-specific teams
- Approvers: Product owners

---

### 9.2 Review Cadence

**Quarterly:**
- Review Ring-0 roadmap
- Review CU Edition roadmap
- Review architecture compliance

**Monthly:**
- Review change control metrics
- Review test coverage
- Review incident reports

**Weekly:**
- Review PRs touching Ring-0
- Review CU-Digital test results

---

### 9.3 Escalation

**Issues requiring escalation:**
- Ring-0 breaking changes
- CU Edition compatibility issues
- Architecture violations
- Test failures in production

**Escalation Path:**
1. Core Architect
2. CTO
3. CEO (for customer-impacting issues)

---

## 10. Summary

**This document is your governance spine: "best practice" becomes enforceable policy.**

**Key Takeaways:**

1. ✅ **Single Core Implementation** – One Ring-0, no forks
2. ✅ **Protocol-Only Mutation** – Command Gateway is the only entry point
3. ✅ **Verticals as Consumers** – Ring-1+ uses APIs, not internals
4. ✅ **Regulatory Clarity** – Complete audit trail, version tracking
5. ✅ **Enforcement** – Architecture tests, CI checks, code review
6. ✅ **Change Control** – Rigorous process for Ring-0 changes
7. ✅ **Versioning** – Semantic versioning, compatibility matrix
8. ✅ **Testing** – Unit, property, integration, acceptance
9. ✅ **Evidence** – Test reports, version info, audit trail
10. ✅ **Governance** – Clear ownership, review cadence, escalation

**This line is sacred. We don't cross it.**

---

## References

- [Ring-0 Core Scope](./RING0_CORE_SCOPE.md)
- [CU Edition Scope](./CU_EDITION_SCOPE.md)
- [Turing Protocol Specification](./TURING_PROTOCOL_V2.md)
- [Core Separation Principles](./06-core-separation-principles.md)

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-15  
**Owner:** Core Engineering Team  
**Reviewers:** Core Architects, CU Product Team  
**Status:** Governance Policy
