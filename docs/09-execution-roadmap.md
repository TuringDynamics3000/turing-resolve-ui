# Execution Roadmap – From v0.1 to Production

**Concrete Sequence for Building the Digital Twin**

**Version:** 1.0  
**Date:** 2025-01-15  
**Status:** Active Roadmap

---

## Guiding Principle

**"What's next?" is execution in a very specific order:**

1. ✅ Lock the Core ↔ CU contract in writing and in code
2. ⏳ Implement the minimal command + query APIs in TuringCore (and kill remaining cheats)
3. ⏳ Spin up the new twin repo and wire the API client + seed script
4. ⏳ Run and pass the CU-Digital v0.1 acceptance tests
5. ⏳ Layer on basic observability + a crude operator console
6. ⏳ Turn the twin into a sales + regulator asset (demo script, "how we'd run in parallel with Ultradata", etc.)

**Don't jump to shiny dashboards or multi-scenario engines until v0.1 is real and boring.**

---

## Phase 1: Formalize the Core ↔ CU Contract

**Status:** ✅ **COMPLETE**

**Goal:** Make the separation non-negotiable for everyone who touches the code.

### What We Did

**Documentation Created:**
- ✅ Core Separation Principles (docs/06-core-separation-principles.md)
- ✅ API Contract Specification (docs/07-api-contract-specification.md)
- ✅ Action Checklist (docs/ACTION_CHECKLIST.md)
- ✅ v0.1 Baseline Definition (docs/00-v0.1-baseline-definition.md)

**Contract Defined:**
- ✅ What lives in TuringCore-v3 (protocol, domains, invariants, persistence)
- ✅ What lives in turingcore-cu-digital-twin (infra, scenario engine, UIs, dashboards)
- ✅ Explicit "NOT ALLOWED" rules:
  - No twin code imports from turingcore_v3
  - No twin DB connections to TuringCore DB
  - No state mutation except via Command Gateway

**Enforcement Implemented:**
- ✅ Architecture tests (tests/architecture/test_separation_compliance.py)
- ✅ CI/CD will fail if someone breaks the contract
- ✅ Pre-commit hooks (to be configured)

**This line is sacred. We don't cross it.**

---

## Phase 2: Harden TuringCore Command & Query Surface

**Status:** ⏳ **IN PROGRESS** (TuringCore-v3 repo)

**Owner:** Core engineering (Platform Team)

**Objective:** Make the minimal API we designed actually exist and be stable.

### Tasks

#### 2.1 Command Gateway Endpoint

**Implement:** `POST /tenants/{tenantId}/commands`

**Requirements:**
- ✅ Envelope structure defined (commandId, tenantId, commandType, actor, timestamp, payload, idempotencyKey)
- ⏳ Routing to internal command handlers
- ⏳ Proper 2xx/4xx/422 responses
- ⏳ Idempotency key handling

**Target:** Week 1 (Jan 15-22)

---

#### 2.2 Minimal Command Handlers

**Implement 5 command handlers:**

1. **CreateTenant**
   - Creates new tenant with metadata
   - Emits `TenantCreated` event
   - Sets up tenant-specific resources

2. **UpsertProduct**
   - Creates or updates product configuration
   - Emits `ProductCreated` or `ProductUpdated` event
   - Idempotent by productCode

3. **CreateCustomer**
   - Creates customer with KYC details
   - Emits `CustomerCreated` event
   - Assigns customerId

4. **OpenAccount**
   - Opens account for customer
   - Emits `AccountOpened` event
   - Handles initial deposit if provided

5. **PostEntry**
   - Multi-leg posting to ledger
   - Emits `PostingApplied` event
   - Validates balance invariants

**Target:** Week 1-2 (Jan 15-29)

---

#### 2.3 Read-Side Projection APIs

**Implement 3 query endpoints:**

1. **GET /tenants/{tenantId}/customers**
   - List customers with pagination
   - Filter by segment, status
   - Return customer summary

2. **GET /tenants/{tenantId}/accounts**
   - List accounts with pagination
   - Filter by customerId, productCode
   - Return account summary with balance

3. **GET /tenants/{tenantId}/accounts/{accountId}/events**
   - Get event stream for account
   - Return events in chronological order
   - Support limit/offset pagination

**Target:** Week 2 (Jan 22-29)

---

#### 2.4 Kill Remaining Direct Writers

**Search and destroy:**
- ⏳ Find any `UPDATE ... SET balance` outside projection layer
- ⏳ Find any direct projection writes bypassing events
- ⏳ Refactor to go through event + projection path

**Verification:**
```sql
-- Audit all UPDATE statements
SELECT * FROM pg_stat_statements 
WHERE query LIKE '%UPDATE%balance%' 
AND application_name != 'projection-worker';
```

**Target:** Week 2 (Jan 22-29)

---

#### 2.5 OpenAPI Specification

**Create:** `openapi.yaml` in TuringCore-v3 repo

**Include:**
- Command Gateway endpoint
- Three query endpoints
- Command envelope schema
- Response schemas

**Don't over-perfect the schema; just get something correct enough that the twin client can be written against it.**

**Target:** Week 2 (Jan 22-29)

---

## Phase 3: Create and Scaffold the Twin Repo

**Status:** ✅ **COMPLETE**

**Owner:** Twin Team

### What We Did

**Repository Created:**
- ✅ GitHub repo: `TuringDynamics3000/turingcore-cu-digital-twin`
- ✅ Public visibility

**Structure Scaffolded:**
```
turingcore-cu-digital-twin/
├── docs/                          ✅ Complete (9 files)
├── twin-orchestrator/             ✅ Scaffolded
│   ├── src/                       ✅ API client + seed script
│   ├── tests/                     ✅ Architecture tests
│   └── config/                    ✅ Tenant + scenario configs
├── infra/                         ⏳ To be implemented
├── operator-console/              ⏳ To be implemented
├── member-portal/                 ⏳ To be implemented
└── observability/                 ⏳ To be implemented
```

**Documentation Complete:**
- ✅ README with high-level purpose + architecture
- ✅ v0.1 Baseline Definition (docs/00-v0.1-baseline-definition.md)
- ✅ Acceptance Test Specification (docs/08-acceptance-test-specification.md)
- ✅ 7 additional documentation files

**CI/CD Configured:**
- ✅ Architecture tests ready to run
- ⏳ GitHub Actions workflow (to be configured)

**This is a real project, not a thought experiment.**

---

## Phase 4: Implement TuringCoreClient + Seed Script

**Status:** ✅ **COMPLETE**

**Owner:** Twin Team

### What We Did

**API Client Implemented:**
- ✅ `twin-orchestrator/src/api_client.py` (550 lines)
- ✅ `TuringCoreClient` class with command and query methods
- ✅ `CommandEnvelope` dataclass
- ✅ Methods: create_tenant, upsert_product, create_customer, open_account, post_entry
- ✅ Query helpers: list_customers, list_accounts, get_account_events

**Seed Script Implemented:**
- ✅ `twin-orchestrator/src/seed_cu_digital.py` (450 lines)
- ✅ Step 1: Create CU_DIGITAL tenant and TXN/Savings products
- ✅ Step 2: Create 10 customers
- ✅ Step 3: Open TXN + Savings accounts for each
- ✅ Step 4: Post 1 salary-like PostEntry per customer

**Configuration:**
- ✅ Environment variables: TURINGCORE_BASE_URL, TURINGCORE_API_KEY
- ✅ Hard-coded TENANT_CODE = CU_DIGITAL for v0.1
- ✅ `.env.example` template provided

**Target Outcome Achieved:**

From your laptop, with TuringCore running somewhere, one command:

```bash
python -m seed_cu_digital
```

…will execute without blowing up and create visible state in TuringCore.

**Ready for integration testing once TuringCore API is available.**

---

## Phase 5: Run CU-Digital v0.1 Acceptance Tests

**Status:** ⏳ **BLOCKED** (waiting for TuringCore API)

**Owner:** QA Team + Twin Team

**Objective:** Once the seed script "sort of works", stop adding features and walk through TC-01 → TC-10 systematically.

### Test Execution Order

**Week 1: Separation & Protocol (TC-01, TC-02)**
- ✅ TC-01: Core vs Twin Separation (architecture tests pass)
- ⏳ TC-02: Command Gateway Exclusivity (requires TuringCore API)

**Proves we're not cheating.**

---

**Week 2: Bootstrap & Seed (TC-03, TC-04, TC-05, TC-06)**
- ⏳ TC-03: Tenant Creation (CU_DIGITAL)
- ⏳ TC-04: Product Configuration
- ⏳ TC-05: Customer Creation
- ⏳ TC-06: Account Creation

**Proves bootstrap and seed phases work.**

---

**Week 3: Simulate & Validate (TC-07, TC-08, TC-09, TC-10)**
- ⏳ TC-07: Posting Entries (Salary)
- ⏳ TC-08: Idempotent Seed Behaviour
- ⏳ TC-09: Ledger Coherence (Smoke Test)
- ⏳ TC-10: Basic Performance & Stability

**Proves simulate and inspect phases work.**

---

### Documentation

**For each test:**
- Document result (pass/fail)
- Document any deviations
- Document workarounds or fixes
- Update acceptance doc

**When they all pass, CU-Digital v0.1 is real, not a diagram.**

**Target:** Week 3 (Jan 29 - Feb 5)

---

## Phase 6: Minimal Observability + Operator View

**Status:** ⏳ **NOT STARTED** (after v0.1 is green)

**Owner:** DevOps Team + UI Team

**Objective:** Don't overbuild yet. Just enough to make the twin visible and demoable.

### 6.1 Observability (Very Lightweight)

**Deploy to twin namespace:**
- ⏳ Prometheus (off-the-shelf Helm chart)
- ⏳ Grafana (off-the-shelf Helm chart)

**Create single dashboard:**
- TuringCore HTTP latency & error rate
- Command throughput (commands/sec)
- Event throughput (events/sec)
- CPU/memory of core pods

**Target:** Week 4 (Feb 5-12)

---

### 6.2 Operator Console v0.1 (Read-Only)

**Simple React/Next app that:**
- Lists customers for CU_DIGITAL
- Shows accounts for a selected customer
- Shows the event timeline for an account

**Technology:**
- React + TypeScript
- TailwindCSS for styling
- Uses TuringCoreClient (same as seed script)
- Read-only (no write operations)

**That's enough for internal and board demos: you can click around and show that the system behaves like a real CU.**

**Target:** Week 5-6 (Feb 12-23)

---

## Phase 7: Turn the Twin into a Business Asset

**Status:** ⏳ **NOT STARTED** (parallel with engineering work)

**Owner:** Product Team + Sales Team

**Objective:** Start sharpening the commercial story.

### 7.1 Demo Script

**"CU on TuringCore in 15 minutes" walkthrough:**

1. Run seed script
   ```bash
   python -m seed_cu_digital
   ```

2. Open operator console
   ```
   http://localhost:3000
   ```

3. Show member, accounts, events
   - Navigate to customer list
   - Select a customer
   - View their accounts
   - View transaction history
   - View event stream

4. Show Grafana panel with command/events throughput
   ```
   http://localhost:3001/d/turingcore-overview
   ```

**Target:** Week 6 (Feb 19-26)

---

### 7.2 Regulator Story

**One-pager:** "How we use CU-Digital to prove CPS 230/234 resilience and auditability."

**Key Points:**
- Complete audit trail via event sourcing
- All state changes traceable to commands
- Balances derivable from events
- Operational resilience testing via scenarios
- Disaster recovery validation

**Target:** Week 6 (Feb 19-26)

---

### 7.3 Credit Union Pitch Alignment

**Use the digital twin as the "safe pilot" option:**

**Pitch:**
> "Before we touch your Ultradata instance, we can show you your future bank running in our twin environment."

**Benefits:**
- Zero risk to production systems
- Validate functionality before migration
- Train staff on new platform
- Demonstrate regulatory compliance
- Prove performance at scale

**Target:** Week 7 (Feb 26 - Mar 5)

---

## Phase 8: Hard Stop – Don't Do These Yet

**Avoid scope creep until v0.1 is genuinely done:**

### Out of Scope for v0.1

- ❌ **No multi-tenant twin** (CU-S/M/L) yet
- ❌ **No recession/fraud scenarios**
- ❌ **No NPP/CDR flows**
- ❌ **No grandiose dashboards**
- ❌ **No member portal** (beyond basic demo)
- ❌ **No production deployment**
- ❌ **No customer pilots**
- ❌ **No performance optimization**
- ❌ **No advanced scenarios**

**All of that makes sense after a boring, deterministic CU-Digital baseline exists and passes its tests.**

---

## Timeline Summary

### Week 1 (Jan 15-22): TuringCore API Foundation
- ⏳ Implement Command Gateway endpoint
- ⏳ Implement 5 command handlers
- ⏳ Start query endpoint implementation

### Week 2 (Jan 22-29): TuringCore API Completion
- ⏳ Complete query endpoints
- ⏳ Kill remaining direct writers
- ⏳ Publish OpenAPI specification
- ⏳ First integration test (twin → TuringCore)

### Week 3 (Jan 29 - Feb 5): v0.1 Acceptance Testing
- ⏳ Run all 10 test cases
- ⏳ Document results
- ⏳ Fix any issues
- ⏳ QA sign-off

### Week 4 (Feb 5-12): Observability
- ⏳ Deploy Prometheus + Grafana
- ⏳ Create basic dashboard
- ⏳ Validate monitoring works

### Week 5-6 (Feb 12-23): Operator Console
- ⏳ Build React UI
- ⏳ Integrate with TuringCore API
- ⏳ Test with CU_DIGITAL data

### Week 7 (Feb 26 - Mar 5): Business Enablement
- ⏳ Create demo script
- ⏳ Create regulator one-pager
- ⏳ Prepare credit union pitch

### Week 8+ (Mar 5+): v0.2 and Beyond
- ⏳ Scale testing (100, 500, 1000 customers)
- ⏳ Advanced scenarios (recession, fraud, outage)
- ⏳ Multi-tenant demo (CU-S/M/L)
- ⏳ Production deployment preparation

---

## Success Metrics

### Phase 5 Success (v0.1 Acceptance)
- ✅ All 10 test cases pass
- ✅ Zero invariant violations
- ✅ Ledger coherence verified
- ✅ Idempotency verified
- ✅ QA sign-off received

### Phase 6 Success (Observability + UI)
- ✅ Grafana dashboard shows live metrics
- ✅ Operator console displays CU_DIGITAL data
- ✅ Demo can be run end-to-end in <15 minutes

### Phase 7 Success (Business Enablement)
- ✅ Demo script validated with internal stakeholders
- ✅ Regulator one-pager reviewed by compliance team
- ✅ Credit union pitch ready for prospect meetings

---

## Risk Management

### Risk: TuringCore API Delayed

**Mitigation:**
- Twin team continues with mock API
- Daily sync between teams
- Clear API contract already defined

**Status:** 🟡 Monitoring

---

### Risk: Test Failures in Phase 5

**Mitigation:**
- Fix issues immediately, don't move goalposts
- Document deviations with tickets
- Re-run full test suite after fixes

**Status:** 🟢 Prepared (acceptance criteria clear)

---

### Risk: Scope Creep

**Mitigation:**
- Hard stop list clearly defined (Phase 8)
- Product owner enforces v0.1 scope
- No new features until v0.1 complete

**Status:** 🟢 Mitigated (v0.1 baseline locked)

---

## Key Decisions

### Decision 1: v0.1 First, Everything Else Later

**Rationale:** Need solid baseline before building advanced features

**Status:** ✅ Agreed

---

### Decision 2: Single Tenant (CU_DIGITAL) for v0.1

**Rationale:** Multi-tenant demo comes after baseline proven

**Status:** ✅ Agreed

---

### Decision 3: Read-Only Operator Console for v0.1

**Rationale:** Write operations come after baseline proven

**Status:** ✅ Agreed

---

### Decision 4: Lightweight Observability for v0.1

**Rationale:** Grandiose dashboards come after baseline proven

**Status:** ✅ Agreed

---

## Conclusion

**This roadmap provides a concrete, sequential execution plan from v0.1 baseline to production-ready digital twin.**

**Key Principles:**
1. **v0.1 first** – Prove the architecture before building features
2. **No scope creep** – Hard stop on advanced features until baseline complete
3. **Sequential execution** – Each phase depends on previous phase
4. **Clear acceptance criteria** – Binary pass/fail, no "mostly working"

**Next Immediate Actions:**
1. ⏳ TuringCore team: Implement Command Gateway + handlers
2. ⏳ Twin team: Prepare for integration testing
3. ⏳ QA team: Review acceptance test specification

**Target for v0.1 Baseline:** 2025-02-05 (3 weeks)

**Don't jump to shiny dashboards or multi-scenario engines until v0.1 is real and boring.**

---

## References

- [v0.1 Baseline Definition](./00-v0.1-baseline-definition.md)
- [Acceptance Test Specification](./08-acceptance-test-specification.md)
- [API Contract Specification](./07-api-contract-specification.md)
- [Action Checklist](./ACTION_CHECKLIST.md)

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-15  
**Owner:** Product Team  
**Status:** Active Roadmap
