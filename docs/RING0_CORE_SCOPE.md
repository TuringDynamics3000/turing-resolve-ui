# Ring-0 Turing Protocol Core – Scope

**The Regulated Core**

**Version:** 1.0  
**Date:** 2025-01-15  
**Status:** Technical Specification

---

## 1. Purpose

Ring-0 defines the **Regulated Core** of TuringCore:

- The only code that can move money
- The only code that defines ledger semantics
- The only code that must be certified for regulated deployments (e.g. AU credit unions)

**Everything else in the platform is a consumer of Ring-0.**

---

## 2. Responsibilities of Ring-0

Ring-0 is responsible for:

### 2.1 Turing Protocol

**Command Envelope and Validation:**
- Command structure (commandId, tenantId, commandType, actor, timestamp, payload, idempotencyKey)
- Command validation (schema, business rules)
- Command routing to handlers

**Event Envelope and Metadata:**
- Event structure (eventId, tenantId, eventType, timestamp, causationId, correlationId, payload)
- Event metadata (tenant, causation, correlation)
- Event immutability guarantees

**Domain-Specific Command Handlers and Invariants:**
- CreateTenant
- UpsertProduct
- CreateCustomer
- OpenAccount
- PostEntry
- Invariant validation (no negative balances, conservation of value, etc.)

---

### 2.2 Tenancy & Security

**Tenant Model:**
- Tenant creation and lifecycle
- Tenant metadata (code, displayName, baseCurrency, timeZone)
- Tenant configuration

**Row-Level Security / Multi-Tenant Data Isolation:**
- PostgreSQL RLS policies
- Tenant-scoped queries
- Cross-tenant leakage prevention

**Integration Points to AuthN/Z:**
- Authentication hooks (not full IAM implementation)
- Authorization hooks (role-based access control)
- Actor attribution for commands

---

### 2.3 Ledger Engine

**Multi-Leg Postings and Double-Entry Semantics:**
- PostEntry command handler
- Multi-leg posting validation
- Double-entry balance (sum of legs = 0)
- Debit/credit semantics

**Balance Calculation Rules:**
- Current balance (all cleared transactions)
- Available balance (current - holds)
- Ledger balance (current + pending)

**FX Handling Core:**
- Multi-currency support (where applicable)
- FX rate management
- Currency conversion
- Feature-flagged in CU Edition if not needed

---

### 2.4 Event Store & Projections

**Append-Only Event Storage:**
- Immutable event log
- Event ordering guarantees
- Event replay capability

**Projection Pipelines:**
- **Accounts projection** (account summary, balances)
- **Customers projection** (customer summary, KYC status)
- **Transactions projection** (transaction history)
- **Balances projection** (real-time balance updates)

**Replay and Recovery Tooling:**
- Event replay from specific point in time
- Projection rebuild from events
- Disaster recovery procedures

---

### 2.5 Core Products (v1)

**Everyday Deposit Accounts:**
- Transaction accounts (checking)
- Basic features (deposits, withdrawals, transfers)

**Savings Accounts:**
- Online saver accounts
- Interest calculation (simple, compound)
- Bonus rate logic

**Basic Internal Transfers:**
- Account-to-account transfers
- Same-tenant only
- Real-time settlement

**Basic External Payments Skeleton:**
- NPP/BPAY integration points
- Direct Entry integration points
- **Note:** Scheme-specific logic NOT embedded in ledger (lives in Ring-1+ connectors)

---

## 3. Out of Scope for Ring-0

Ring-0 must **NOT** contain:

### 3.1 Product-Specific Logic

- ❌ CU-specific product catalogues (fees, tiers, marketing names)
- ❌ Wealth / investments / pods (Turings) logic
- ❌ iCattle or any livestock/carbon domain
- ❌ Complex fee engines and campaign pricing
- ❌ Business banking, treasury, sophisticated GL/reporting

---

### 3.2 Advanced Features

- ❌ Analytics, ML models, risk scoring
- ❌ Fraud detection algorithms
- ❌ AML/KYC orchestration (only hooks for external systems)
- ❌ Cards issuing/processing core
- ❌ Full lending lifecycle

---

### 3.3 UI/Integration Layer

- ❌ API gateways, BFF / UI glue
- ❌ Dashboards, reporting, or partner integrations
- ❌ Member portals, operator consoles
- ❌ Data products, Data Mesh

**These belong in Ring-1+ services that call Ring-0.**

---

## 4. Code Layout (Target)

Ring-0 should be concentrated in:

```
TuringCore-v3/
├── src/turingcore_v3/
│   ├── protocol/                    # Ring-0
│   │   ├── command_envelope.py
│   │   ├── event_envelope.py
│   │   └── validation.py
│   ├── core/                        # Ring-0
│   │   ├── ledger/
│   │   │   ├── posting.py
│   │   │   ├── balance.py
│   │   │   └── fx.py
│   │   ├── tenants/
│   │   │   ├── tenant.py
│   │   │   └── isolation.py
│   │   ├── accounts/
│   │   │   ├── account.py
│   │   │   └── product.py
│   │   ├── payments_basic/
│   │   │   ├── transfer.py
│   │   │   └── external.py
│   │   └── events/
│   │       ├── event_store.py
│   │       └── projections.py
│   ├── domains/                     # Ring-1+ (NOT Ring-0)
│   │   ├── wealth_*
│   │   ├── icattle_*
│   │   └── analytics_*
│   ├── frontend/                    # Ring-1+ (NOT Ring-0)
│   ├── dashboard/                   # Ring-1+ (NOT Ring-0)
│   ├── bff/                         # Ring-1+ (NOT Ring-0)
│   ├── ml/                          # Ring-1+ (NOT Ring-0)
│   └── data_products/               # Ring-1+ (NOT Ring-0)
```

**Clear separation between Ring-0 (core/) and Ring-1+ (domains/, frontend/, etc.).**

---

## 5. Hard Rules

### 5.1 No Direct Balance Updates

**Rule:** No SQL `UPDATE ... SET balance` on any account table.

**Rationale:** Balances are **derived** from events/postings, not stored directly.

**Enforcement:**
```python
# Architecture test
def test_no_direct_balance_updates():
    """No direct balance updates allowed."""
    sql_files = glob("src/**/*.sql", recursive=True)
    for sql_file in sql_files:
        content = read_file(sql_file)
        assert "UPDATE" not in content or "balance" not in content.lower()
```

**Exception:** Projection services may update balance projections, but only by consuming events.

---

### 5.2 Single Mutation Path

**Rule:** All state changes originate from `POST /tenants/{tenantId}/commands` (or equivalent gRPC entrypoint).

**Rationale:** Ensures complete audit trail and invariant checking.

**Enforcement:**
- HTTP access logs show 100% of writes to Command Gateway
- Database audit logs show zero direct writes
- Kafka audit logs show zero direct event production

**No module may bypass the Command Gateway.**

---

### 5.3 Tenant Isolation

**Rule:** Every event, projection, and query is tenant-scoped.

**Rationale:** Prevents cross-tenant data leakage.

**Enforcement:**
- PostgreSQL RLS policies on all tables
- Tenant ID in every query WHERE clause
- Tests prove no cross-tenant leakage under concurrent load

**Example RLS Policy:**
```sql
CREATE POLICY tenant_isolation ON accounts
  USING (tenant_id = current_setting('app.current_tenant_id')::TEXT);
```

---

### 5.4 Backward Compatibility & Versioning

**Rule:** Ring-0 follows semantic versioning.

**Breaking Changes:**
- Require **major version bump** (e.g., 1.x.x → 2.0.0)
- Require migration plan
- Require customer impact analysis
- Require rollback plan

**Non-Breaking Changes:**
- Minor version bump (e.g., 1.0.0 → 1.1.0)
- Backward compatible
- No migration required

**Patch Changes:**
- Patch version bump (e.g., 1.0.0 → 1.0.1)
- Bug fixes only
- No API changes

---

## 6. Testing Requirements

Ring-0 changes must be covered by:

### 6.1 Unit Tests

**Command Validation:**
```python
def test_create_customer_validation():
    """CreateCustomer command validates required fields."""
    command = CreateCustomerCommand(
        tenantId="CU_DIGITAL",
        # Missing required fields
    )
    with pytest.raises(ValidationError):
        command.validate()
```

**Invariants:**
```python
def test_no_negative_balance_without_overdraft():
    """Accounts cannot go negative without overdraft facility."""
    account = Account(balance=100.0, overdraft_limit=0.0)
    with pytest.raises(InvariantViolation):
        account.withdraw(150.0)
```

---

### 6.2 Property Tests

**Ledger Invariants:**
```python
@given(postings=st.lists(st.builds(Posting)))
def test_conservation_of_value(postings):
    """Sum of all posting legs must equal zero."""
    total = sum(leg.amount * (1 if leg.direction == "DEBIT" else -1) 
                for posting in postings 
                for leg in posting.legs)
    assert abs(total) < 0.01  # Within rounding tolerance
```

**Double-Entry:**
```python
@given(entries=st.lists(st.builds(Entry)))
def test_double_entry_balance(entries):
    """Every entry must balance (debits = credits)."""
    for entry in entries:
        debits = sum(leg.amount for leg in entry.legs if leg.direction == "DEBIT")
        credits = sum(leg.amount for leg in entry.legs if leg.direction == "CREDIT")
        assert abs(debits - credits) < 0.01
```

---

### 6.3 Replay Tests

**Event Log → Projections Determinism:**
```python
def test_projection_replay_determinism():
    """Replaying events produces same projections."""
    events = load_events_from_log()
    
    # First projection
    projections1 = rebuild_projections(events)
    
    # Second projection (replay)
    projections2 = rebuild_projections(events)
    
    assert projections1 == projections2
```

---

### 6.4 Multi-Tenant Tests

**Isolation Under Concurrent Load:**
```python
@pytest.mark.concurrent
def test_tenant_isolation_under_load():
    """Tenants cannot see each other's data under concurrent load."""
    tenant1_data = create_test_data("TENANT_1")
    tenant2_data = create_test_data("TENANT_2")
    
    # Concurrent operations
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = []
        for _ in range(100):
            futures.append(executor.submit(query_tenant_data, "TENANT_1"))
            futures.append(executor.submit(query_tenant_data, "TENANT_2"))
        
        results = [f.result() for f in futures]
    
    # Verify no cross-tenant leakage
    tenant1_results = [r for r in results if r["tenant_id"] == "TENANT_1"]
    tenant2_results = [r for r in results if r["tenant_id"] == "TENANT_2"]
    
    assert all(r["data"] in tenant1_data for r in tenant1_results)
    assert all(r["data"] in tenant2_data for r in tenant2_results)
```

---

## 7. Performance Requirements

### 7.1 Throughput

**Command Processing:**
- Target: >1,000 commands/sec per instance
- Measured: p50, p95, p99 latency

**Event Processing:**
- Target: >10,000 events/sec per instance
- Measured: event lag (time from command to projection update)

---

### 7.2 Latency

**Command Gateway:**
- p50: <50ms
- p95: <200ms
- p99: <500ms

**Query API:**
- p50: <20ms
- p95: <100ms
- p99: <200ms

---

### 7.3 Scalability

**Horizontal Scaling:**
- Command Gateway: Stateless, scales linearly
- Event Processors: Partitioned by tenant, scales linearly
- Query API: Read replicas, scales linearly

**Vertical Scaling:**
- Database: Aurora/Postgres with read replicas
- Kafka: Multi-broker cluster with partitioning

---

## 8. Security Requirements

### 8.1 Authentication

**Integration Points:**
- OAuth 2.0 / OIDC for user authentication
- API keys for service-to-service authentication
- mTLS for inter-service communication

---

### 8.2 Authorization

**Role-Based Access Control:**
- Tenant admin (full access to tenant data)
- Operator (read/write access to customer data)
- Member (read access to own data)
- System (internal service accounts)

---

### 8.3 Audit Trail

**All Commands Logged:**
- Command ID, tenant ID, actor, timestamp, payload
- Stored in immutable audit log
- Retained for 7 years (regulatory requirement)

**All Events Logged:**
- Event ID, tenant ID, event type, timestamp, causation ID, correlation ID, payload
- Stored in immutable event store
- Retained indefinitely

---

## 9. Operational Requirements

### 9.1 Monitoring

**Metrics:**
- Command throughput (commands/sec)
- Event throughput (events/sec)
- Event lag (time from command to projection)
- API latency (p50, p95, p99)
- Error rate (errors/sec)
- Invariant violations (count)

**Alerts:**
- Event lag >5 seconds
- API latency p95 >500ms
- Error rate >1%
- Invariant violations >0

---

### 9.2 Logging

**Structured Logging:**
- JSON format
- Tenant ID, command ID, event ID, correlation ID
- Log level (DEBUG, INFO, WARN, ERROR)
- Timestamp, service name, instance ID

**Log Retention:**
- INFO logs: 30 days
- ERROR logs: 90 days
- Audit logs: 7 years

---

### 9.3 Disaster Recovery

**Backup:**
- Database: Daily snapshots, retained for 30 days
- Event store: Continuous replication to S3
- Configuration: Version controlled in Git

**Recovery:**
- RTO (Recovery Time Objective): <4 hours
- RPO (Recovery Point Objective): <15 minutes
- Tested quarterly

---

## 10. Summary

**Ring-0 is the regulated core that must never get "polluted".**

**Key Responsibilities:**
1. ✅ Turing Protocol (commands, events, validation)
2. ✅ Tenancy & Security (isolation, RLS, auth hooks)
3. ✅ Ledger Engine (postings, balances, FX)
4. ✅ Event Store & Projections (immutable log, derived state)
5. ✅ Core Products (deposits, savings, basic transfers)

**Out of Scope:**
- ❌ Product-specific logic (CU, wealth, iCattle)
- ❌ Advanced features (ML, fraud, AML)
- ❌ UI/Integration layer (BFF, dashboards, portals)

**Hard Rules:**
1. ✅ No direct balance updates
2. ✅ Single mutation path (Command Gateway only)
3. ✅ Tenant isolation (RLS, scoped queries)
4. ✅ Backward compatibility (semantic versioning)

**Testing:**
- Unit tests (validation, invariants)
- Property tests (ledger invariants, double-entry)
- Replay tests (determinism)
- Multi-tenant tests (isolation under load)

**This is your formal definition of the thing that must never get "polluted".**

---

## References

- [Core vs CU Contract](./CORE_VS_CU_CONTRACT.md)
- [CU Edition Scope](./CU_EDITION_SCOPE.md)
- [Turing Protocol Specification](./TURING_PROTOCOL_V2.md)

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-15  
**Owner:** Core Engineering Team  
**Status:** Technical Specification
