# Core-CU Separation Principles

## Executive Summary

The TuringCore-v3 and CU Digital Twin repositories are **strictly separated** to ensure architectural integrity, protocol enforcement, and real-world customer simulation.

### Core Principle

**TuringCore-v3 is a sealed, protocol-enforcing platform.** The only state mutation path is:

```
Turing Protocol Command API → Invariant Engine → Event Store → Projections
```

**No CU-specific logic, no "just for demo" hacks, no digital-twin shortcuts in the core repo.**

**The CU Digital Twin is a first-class external customer.** It lives in a separate repository, separate namespace, and ideally separate AWS account per environment stage. It talks to TuringCore only via public APIs and events, treating TuringCore images and charts as immutable artifacts.

## Why This Matters

### The Risk

Without strict separation, teams will inevitably:
- Add "just this one shortcut" to speed up demos
- Create backdoor APIs for internal tools
- Bypass invariants for "special cases"
- Import core packages directly into twin code
- Write directly to databases "just for seeding"

**Result:** The architecture degrades into the unstructured mess TuringCore was designed to replace.

### The Solution

Enforce separation through:
1. **Code and repository boundaries** – No cross-imports, no database access
2. **API-only contracts** – OpenAPI/gRPC schemas as the only integration surface
3. **Turing Protocol enforcement** – Single command gateway with invariants and RLS on every write
4. **CI/CD guardrails** – Tests that fail builds if anything bypasses the protocol
5. **Environment isolation** – Core and CU twin separated at infrastructure and IAM levels

## 1. Structural Separation

### Repository Boundaries

#### TuringCore-v3 Repository

**Contains:**
- Turing Protocol definitions (commands, events, invariants)
- Core domains (accounts, customers, postings, tenants, auth, compliance)
- Persistence, projections, event store, RLS configuration
- API gateway and transport layer
- Functional cores (pure business logic)
- Imperative shells (I/O orchestration)

**Explicitly Does NOT Contain:**
- Scenario engines
- Digital twin logic
- CU-specific product configurations
- Sales/demo code
- Seed data or fake data generators
- UI components (operator console, member portal)

#### turingcore-cu-digital-twin Repository

**Contains:**
- Infrastructure for twin environment (EKS, Helm, Terraform)
- Twin orchestrator / scenario engine
- Operator console and member portal demo
- Observability stack and APRA/CDR view layers
- Synthetic data generators
- Scenario configurations
- Demo playbooks and documentation

**Consumes TuringCore As:**
- Docker images (from ECR)
- Helm charts (versioned)
- OpenAPI/gRPC client SDK
- Public APIs only

### Hard Rule: No Source Code Imports

**If a file in the twin repository imports a module from `turingcore_v3` source, that is a hard violation.**

The only allowed coupling is via:
- Network/API calls
- Well-defined client SDK (generated from OpenAPI/gRPC specs)
- Published container images
- Versioned Helm charts

### Enforcement

Implement architecture tests that scan dependencies and fail if:
```python
# FORBIDDEN in twin repository
from turingcore_v3.domains.accounts import AccountService
from turingcore_v3.persistence import Database

# ALLOWED in twin repository
from turingcore_client import TuringCoreAPIClient  # Generated from OpenAPI
```

## 2. Single Mutating Entry Point: Command Gateway

### The Problem

If multiple paths exist to mutate state, invariants cannot be enforced universally.

### The Solution

**All state changes go through a Command Gateway** inside TuringCore-v3.

### Command Gateway Architecture

**Endpoint:** `POST /tenants/{tenantId}/commands`

**Request Format:**
```json
{
  "commandType": "OpenAccount",
  "commandId": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "CU_DIGITAL",
  "timestamp": "2025-01-15T10:30:00Z",
  "payload": {
    "customerId": "CUST-123",
    "productCode": "TXN_ACCOUNT_BASIC",
    "initialDeposit": 1000.00
  },
  "metadata": {
    "source": "twin-orchestrator",
    "correlationId": "scenario-steady-state-001"
  }
}
```

**Gateway Responsibilities:**
1. Authenticate principal (CU, operator, twin orchestrator)
2. Validate tenant and permissions
3. Route to relevant domain command handler
4. Execute functional core (pure business logic)
5. Run invariant checks
6. Emit canonical events if invariants pass
7. Store events in event store
8. Update projections (read models)
9. Return command result

### Forbidden Patterns

**No module is allowed to write directly to:**
- Event store tables
- Projection tables
- Balance, limit, or status fields
- Any aggregate state

### Code-Level Enforcement

**Single Persistence Layer:**
```python
# ONLY this interface is allowed to write
class EventStore:
    def append_events(self, events: List[Event]) -> None:
        """Append events to the event store. Only accepts Event structs."""
        pass

# FORBIDDEN - no direct aggregate updates
# def update_balance(account_id: str, new_balance: Decimal) -> None:
#     db.execute("UPDATE accounts SET balance = ? WHERE id = ?", new_balance, account_id)
```

**Deprecate/Delete:**
- Any previous "update row" code
- Direct balance writers
- Projection updaters outside projection services

### Twin Orchestrator Compliance

**The Scenario Engine issues only commands.**

**It never:**
- Inserts events directly
- Writes to projections
- Touches database or Kafka directly (except read-only event consumption)
- Bypasses the command gateway

## 3. API-First Contracts

### Command and Query APIs

#### Commands (Write Path)

**Single generic endpoint** with consistent envelope:
- `commandType` – Type of command (e.g., "OpenAccount", "PostTransaction")
- `commandId` – Unique identifier for idempotency
- `tenantId` – Tenant context for RLS
- `payload` – Command-specific data
- `metadata` – Correlation, source, timestamps

**Fully described via OpenAPI or Protocol Buffers (gRPC).**

#### Queries (Read Path)

**Read-only endpoints for projections:**
- `GET /tenants/{tenantId}/customers`
- `GET /accounts/{accountId}`
- `GET /accounts/{accountId}/transactions`
- `GET /accounts/{accountId}/events`
- `GET /tenants/{tenantId}/products`

**All queries respect tenant isolation via PostgreSQL RLS.**

### Client SDK Generation

**The twin orchestrator uses a generated client:**
```python
# Generated from OpenAPI specification
from turingcore_client import TuringCoreAPIClient

client = TuringCoreAPIClient(
    base_url="https://api.turingcore.internal",
    api_key=os.environ["TURINGCORE_API_KEY"]
)

# Type-safe, versioned API calls
result = client.commands.open_account(
    tenant_id="CU_DIGITAL",
    customer_id="CUST-123",
    product_code="TXN_ACCOUNT_BASIC",
    initial_deposit=1000.00
)
```

**No hand-coded URLs sprinkled through the codebase.**

### Versioning Discipline

**TuringCore-v3 tagged with semantic versioning:**
- `v3.1.0`, `v3.2.0`, `v3.3.0`, etc.

**Twin repository pins to specific version:**
```yaml
# twin-orchestrator/requirements.txt
turingcore-client==3.1.0

# infra/helm/values-turingcore.yaml
image:
  repository: xxx.dkr.ecr.ap-southeast-2.amazonaws.com/turingcore-v3
  tag: 3.1.0
```

**Backwards-compatible protocol changes (additive) do not break the twin.**

**Breaking protocol changes require:**
- Bumping major version (e.g., v3.x.x → v4.0.0)
- Updating twin repository to use new version
- Migration guide for existing tenants

**This enforces that even your own twin cannot rely on internal, unstable details.**

## 4. Guardrails Inside the Twin Repository

### Rules for Scenario Engine

#### Allowed
- Calling TuringCore APIs for commands and queries
- Consuming events from Kafka via subscriber (read-only) for analytics/validation
- Generating synthetic data locally
- Orchestrating scenario execution
- Logging and metrics collection

#### Not Allowed
- Producing events directly into TuringCore's Kafka topics
- Writing directly to any TuringCore database or cache
- Invoking "internal" admin endpoints not exposed to real customers
- Bypassing authentication or authorization
- Importing TuringCore source code packages

### Rules for UIs (Operator Console & Member Portal)

**Treat TuringCore like any other backend:**
- Call auth service / API gateway
- Use only the same APIs a real CU frontend would use
- Respect tenant context and permissions

**No "debug" endpoints that bypass permissions or invariants.**

**If you need a debug view (e.g., raw events):**
- Add a read-only observation API in TuringCore
- Protect it with a special role (e.g., `ROLE_OBSERVER`)
- Do not create a backdoor

### Architecture Tests in Twin Repository

**Add tests that fail if:**

```python
# test_architecture_compliance.py
import ast
import os

def test_no_turingcore_imports():
    """Ensure no files import from turingcore_v3 source."""
    for root, dirs, files in os.walk("twin-orchestrator/src"):
        for file in files:
            if file.endswith(".py"):
                with open(os.path.join(root, file)) as f:
                    tree = ast.parse(f.read())
                    for node in ast.walk(tree):
                        if isinstance(node, ast.Import):
                            for alias in node.names:
                                assert not alias.name.startswith("turingcore_v3"), \
                                    f"Forbidden import in {file}: {alias.name}"

def test_no_direct_db_connections():
    """Ensure no config contains TuringCore DB connection strings."""
    forbidden_patterns = [
        "postgresql://turingcore",
        "TURINGCORE_DB_HOST",
        "TURINGCORE_DB_PASSWORD"
    ]
    for root, dirs, files in os.walk("twin-orchestrator"):
        for file in files:
            if file.endswith((".yaml", ".yml", ".env", ".py")):
                with open(os.path.join(root, file)) as f:
                    content = f.read()
                    for pattern in forbidden_patterns:
                        assert pattern not in content, \
                            f"Forbidden DB access in {file}: {pattern}"

def test_only_api_client_usage():
    """Ensure all TuringCore interactions go through API client."""
    # Implementation: scan for direct HTTP calls to TuringCore endpoints
    # without using the generated client SDK
    pass
```

**These tests are boring but effective.**

## 5. Turing Protocol Enforcement Checks (Automated)

### Protocol Conformance Tests (in TuringCore-v3 Repository)

**For each domain:**

```python
# test_protocol_conformance.py
from hypothesis import given, strategies as st

@given(st.builds(OpenAccountCommand))
def test_open_account_produces_valid_events(command):
    """For all valid commands, we only ever produce valid event sequences."""
    events = handle_command(command)
    assert all(isinstance(e, Event) for e in events)
    assert all(e.tenant_id == command.tenant_id for e in events)
    assert all(e.event_id is not None for e in events)

def test_replay_maintains_invariants():
    """Generate random command sequences, replay events, verify invariants."""
    commands = generate_random_command_sequence(count=1000)
    events = []
    for command in commands:
        events.extend(handle_command(command))
    
    # Rebuild projections from events
    projections = rebuild_projections_from_events(events)
    
    # Verify invariants
    assert_balance_derivability(projections, events)
    assert_event_integrity(events)
    assert_tenant_isolation(projections)
    assert_idempotency(commands, events)
    assert_audit_completeness(projections, events)
```

**Global Invariants:**
- Sum of postings for an account = projection balance
- No event with missing `tenant_id`
- No cross-tenant references in events
- Event hash chain unbroken
- All state changes have corresponding events

**These tests must pass before any image/tag is published.**

### "No Direct Writes" Safety Net

**Search/scan core code for forbidden patterns:**

```bash
# CI/CD pipeline check
#!/bin/bash

# Forbidden patterns
FORBIDDEN=(
  "UPDATE accounts SET balance"
  "UPDATE projections"
  "INSERT INTO events"
  "DELETE FROM ledger_events"
)

for pattern in "${FORBIDDEN[@]}"; do
  if grep -r "$pattern" turingcore_v3/; then
    echo "ERROR: Forbidden direct write pattern found: $pattern"
    exit 1
  fi
done

echo "✓ No forbidden direct write patterns found"
```

**Maintain a small allow-list for migrations only (and audit them ruthlessly).**

### Twin Conformance Tests (in Twin Repository)

**Scenario tests that:**

```python
# test_scenario_conformance.py
def test_steady_state_scenario_conformance():
    """Verify steady state scenario respects protocol."""
    # Run scenario
    orchestrator = TwinOrchestrator(config="steady-state.yaml")
    result = orchestrator.run_scenario()
    
    # Verify all state changes went through commands
    assert result.commands_issued > 0
    assert result.direct_db_writes == 0
    
    # Pull events from Kafka
    events = consume_events_for_tenant("CU_DIGITAL")
    
    # Reconstruct state client-side
    client_state = reconstruct_state_from_events(events)
    
    # Query projections from API
    api_state = query_projections_from_api("CU_DIGITAL")
    
    # Ensure they match
    assert client_state == api_state

def test_api_surface_conformance():
    """Verify twin uses only paths defined in OpenAPI."""
    # Load OpenAPI spec
    spec = load_openapi_spec("turingcore-v3-api.yaml")
    allowed_paths = set(spec["paths"].keys())
    
    # Capture all HTTP calls made by twin
    with http_call_monitor() as monitor:
        orchestrator = TwinOrchestrator(config="steady-state.yaml")
        orchestrator.run_scenario()
    
    # Verify all calls match OpenAPI spec
    for call in monitor.calls:
        assert call.path in allowed_paths, \
            f"Twin made call to undocumented endpoint: {call.path}"
```

**This proves the twin is also a Protocol-respecting citizen.**

## 6. Environment Isolation

### Infrastructure Separation

**Development:**
```
AWS Account: dev-turingcore
├── VPC: turingcore-dev
│   └── Namespace: turingcore
│       └── TuringCore-v3 services
└── VPC: cu-digital-twin-dev
    └── Namespace: cu-digital-twin
        └── Twin orchestrator, UIs, observability
```

**Production:**
```
AWS Account: prod-turingcore
├── VPC: turingcore-prod
│   └── Namespace: turingcore
│       └── TuringCore-v3 services
└── VPC: cu-digital-twin-prod
    └── Namespace: cu-digital-twin
        └── Twin orchestrator, UIs, observability
```

### IAM Isolation

**TuringCore IAM roles:**
- Cannot access twin orchestrator resources
- Cannot read twin configuration
- Cannot assume twin service roles

**Twin IAM roles:**
- Cannot access TuringCore database directly
- Cannot write to TuringCore event store
- Can only call TuringCore public APIs
- Can consume (read-only) from Kafka event topics

### Network Isolation

**TuringCore services:**
- Exposed only via API gateway
- Database not accessible from twin VPC
- Event store not accessible from twin VPC

**Twin services:**
- Call TuringCore via public API endpoints
- Consume events via Kafka (read-only)
- No direct network access to TuringCore internals

## 7. Enforcement Checklist

### Code Review Checklist

**For TuringCore-v3 PRs:**
- [ ] No CU-specific logic added
- [ ] No demo shortcuts or backdoors
- [ ] All state changes go through command gateway
- [ ] Invariants enforced on all write paths
- [ ] No direct writes to projections
- [ ] Protocol conformance tests pass

**For Twin Repository PRs:**
- [ ] No imports from `turingcore_v3` source
- [ ] No direct database connections to TuringCore
- [ ] All TuringCore interactions via API client
- [ ] Architecture tests pass
- [ ] Scenario conformance tests pass

### CI/CD Pipeline Checks

**TuringCore-v3 Pipeline:**
```yaml
- name: Protocol Conformance Tests
  run: pytest tests/protocol_conformance/
  
- name: Invariant Tests
  run: pytest tests/invariants/
  
- name: No Direct Writes Check
  run: ./scripts/check_no_direct_writes.sh
  
- name: Publish Image (only if all tests pass)
  run: docker push turingcore-v3:${VERSION}
```

**Twin Repository Pipeline:**
```yaml
- name: Architecture Compliance Tests
  run: pytest tests/architecture/
  
- name: Scenario Conformance Tests
  run: pytest tests/scenarios/
  
- name: API Surface Tests
  run: pytest tests/api_conformance/
  
- name: Deploy Twin (only if all tests pass)
  run: helm upgrade twin ./helm/
```

## 8. Benefits of Strict Separation

### Architectural Integrity
- TuringCore remains a pure, protocol-enforcing platform
- No erosion of invariants over time
- No "special cases" that bypass rules

### Real-World Validation
- Twin demonstrates that external customers can use TuringCore successfully
- No hidden dependencies on internal details
- Proves APIs are sufficient for all operations

### Sales Credibility
- Prospects see exactly what they would use
- No "demo magic" that doesn't work in production
- Transparent about capabilities and limitations

### Regulatory Confidence
- Clear separation of concerns
- Complete audit trails via event sourcing
- No backdoors or shortcuts that could compromise compliance

### Team Discipline
- Clear boundaries prevent scope creep
- Forces API design to be customer-centric
- Automated tests enforce separation continuously

## 9. Summary

**The separation between TuringCore-v3 and the CU Digital Twin is not optional—it is foundational to the architecture.**

By enforcing this separation through code structure, API contracts, automated tests, and infrastructure isolation, we ensure that:

1. **TuringCore remains a sealed, protocol-enforcing platform** with no shortcuts or backdoors
2. **The Turing Protocol is the only path for state mutation**, ensuring invariants hold universally
3. **The digital twin is a first-class external customer**, proving that real credit unions can successfully use the platform
4. **APIs are sufficient for all operations**, with no hidden dependencies on internal implementation details
5. **Architectural integrity is maintained over time**, as automated tests prevent erosion

**This discipline is what separates TuringCore-v3 from the unstructured legacy systems it aims to replace.**
