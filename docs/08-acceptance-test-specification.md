# CU-Digital v0.1 – Acceptance Test Specification

**Baseline Digital Twin on TuringCore-v3**

**Version:** 1.0  
**Date:** 2025-01-15  
**Status:** Draft

---

## 1. Purpose

Define clear, objective acceptance criteria for **CU-Digital v0.1** – the first synthetic Credit Union tenant running on TuringCore-v3 exclusively via the Turing Protocol.

### Goals

1. **Prove core ↔ CU separation** (no cheats, no backdoors)
2. **Prove end-to-end flow**: tenant → products → customers → accounts → postings → projections → events
3. **Establish repeatable baseline QA harness** for future scenarios (recession, fraud, CPS 230)

**Passing this spec = "the digital twin is alive and honest".**

---

## 2. Scope

### In Scope (v0.1)

**Single Tenant:**
- `CU_DIGITAL` tenant only

**Core Flows:**
- `CreateTenant` - Tenant provisioning
- `UpsertProduct` - Product configuration
- `CreateCustomer` - Member onboarding
- `OpenAccount` - Account opening
- `PostEntry` - Money movements (multi-leg postings)

**Basic Projections:**
- List customers
- List accounts
- Account events

**Data Scale:**
- Synthetic-but-simple data (hundreds of entities; not millions)
- Command-only state mutation via the Turing Protocol

### Out of Scope (v0.1)

**Advanced Banking Features:**
- Loans, arrears workflows
- Interest accrual, fees
- NPP/BPAY integration
- Card processing
- AML/fraud detection

**Advanced Scenarios:**
- CPS 230 outage simulations
- Recession stress testing
- Fraud detection scenarios

**User Interfaces:**
- Operator console UI (optional smoke only)
- Member portal UI (optional smoke only)
- Full observability stack (optional smoke only)

---

## 3. Preconditions

All tests assume the following components are deployed and configured:

### TuringCore-v3

**Deployment:**
- Deployable into a `turingcore` namespace (or equivalent)
- PostgreSQL, Kafka, Redis infrastructure available

**API Endpoints:**
- `POST /tenants/{tenantId}/commands` - Command Gateway
- `GET /tenants/{tenantId}/customers` - Customer projection
- `GET /tenants/{tenantId}/accounts` - Account projection
- `GET /tenants/{tenantId}/accounts/{accountId}/events` - Event stream

**Command Handlers Implemented:**
- `CreateTenant` - Tenant creation
- `UpsertProduct` - Product configuration
- `CreateCustomer` - Customer creation
- `OpenAccount` - Account opening
- `PostEntry` - Multi-leg posting

### Twin Repository (turingcore-cu-digital-twin)

**Components:**
- `TuringCoreClient` (as per API client specification)
- `seed_cu_digital.py` (or equivalent CLI)

**Configuration:**
- Environment variables set:
  - `TURINGCORE_BASE_URL`
  - `TURINGCORE_API_KEY`
  - `TURINGCORE_TENANT_ID` (optional)

### Environment

**Infrastructure:**
- Dev/demo cluster reachable from the twin orchestrator
- Test API key provisioned with permissions for tenant bootstrap
- Network connectivity between twin and TuringCore services

---

## 4. High-Level Acceptance Criteria

CU-Digital v0.1 is **accepted** when all of the following are true:

### 4.1 Protocol-Only Writes

Every state mutation for `CU_DIGITAL` is observable as:

1. **A command** hitting the Command Gateway (`POST /tenants/{tenantId}/commands`)
2. **A corresponding event** in the event store/event API
3. **A change in projections** consistent with the event stream

**No direct database writes. No backdoors. No shortcuts.**

### 4.2 Separation Holds

The twin **never**:

1. Connects to TuringCore DB directly
2. Writes directly to event topics (Kafka)
3. Imports core code from TuringCore-v3 repository

**Enforced by architecture tests that fail CI/CD builds on violations.**

### 4.3 CU_DIGITAL Baseline

**Tenant:**
- Tenant `CU_DIGITAL` exists with expected metadata

**Products:**
- `TXN_ACCOUNT_BASIC` exists
- `SAVINGS_STANDARD` exists

**Customers:**
- At least 10 customers created for v0.1
- Each customer has:
  - 1× TXN account
  - 1× Savings account

**Transactions:**
- At least 1 `PostEntry` salary-like transaction per customer posted successfully

### 4.4 Ledger Coherence (Smoke Level)

For a sample of accounts:

1. **Balance in projection** = sum of postings from events (within rounding tolerance)
2. **No invariant-violation errors** logged by TuringCore during the seed run

### 4.5 Idempotent Seed

Re-running the same `seed_cu_digital` command with the same config:

1. **Does not create duplicate** tenants/products/customers/accounts
2. **Maintains balances** as expected (idempotency keys respected)

---

## 5. Test Cases

### TC-01 – Core vs Twin Separation

**Objective:** Ensure no tight coupling or DB access from the twin side.

**Steps:**

1. Inspect twin repo (`turingcore-cu-digital-twin`):
   - Search for imports of `turingcore_v3` (or equivalent core packages)
   - Search for any DB connection strings referencing TuringCore DB hosts

2. Check CI/linters:
   - Confirm there is a rule failing builds if those patterns appear

**Pass Criteria:**

- ✅ No forbidden imports or DB references exist
- ✅ CI/linters enforce the rule (a deliberate violation causes CI to fail)

**Test Command:**
```bash
cd twin-orchestrator
pytest tests/architecture/test_separation_compliance.py -v
```

---

### TC-02 – Command Gateway Exclusivity

**Objective:** Verify all writes go through `/tenants/{tenantId}/commands`.

**Steps:**

1. Deploy TuringCore with HTTP access logging enabled at API gateway level
2. Run `seed_cu_digital.py`
3. Examine HTTP logs for the duration of the run

**Pass Criteria:**

- ✅ All POST requests that mutate state are to `/tenants/{tenantId}/commands`
- ✅ No other mutating endpoints were called
- ✅ No DB migrations or admin scripts ran during seed

**Verification:**
```bash
# Example log analysis
grep "POST" turingcore-api-gateway.log | grep -v "/tenants/.*/commands"
# Should return no results
```

---

### TC-03 – Tenant Creation (CU_DIGITAL)

**Objective:** Confirm `CU_DIGITAL` tenant is created correctly.

**Steps:**

1. Clear TuringCore state (fresh dev environment)
2. Run only the tenant+product part of `seed_cu_digital` (or run full seed, then verify)
3. Query TuringCore (via admin/projection API or CLI) for tenant with code `CU_DIGITAL`

**Expected:**

Tenant exists with:
- `tenantCode` = `"CU_DIGITAL"`
- `displayName` = `"CU Digital Twin"`
- `baseCurrency` = `"AUD"`
- `timeZone` = `"Australia/Sydney"`

**Pass Criteria:**

- ✅ Tenant record matches expected values
- ✅ One corresponding `TenantCreated` event exists in event stream

**Test Command:**
```bash
python -m seed_cu_digital
# Verify via API:
curl -H "Authorization: Bearer $TURINGCORE_API_KEY" \
  $TURINGCORE_BASE_URL/tenants/CU_DIGITAL
```

---

### TC-04 – Product Configuration

**Objective:** Validate products exist and aligned with config.

**Steps:**

1. After tenant seed, query product projections for `CU_DIGITAL`
2. Inspect products with codes:
   - `TXN_ACCOUNT_BASIC`
   - `SAVINGS_STANDARD`

**Expected:**

Both products exist with correct:
- `productType` = `"DEPOSIT"`
- Interest rates:
  - `TXN_ACCOUNT_BASIC`: `rate = 0.0`
  - `SAVINGS_STANDARD`: `baseRate = 0.015`, `bonusRate = 0.030`
- `monthlyFee` = `0.0`

**Pass Criteria:**

- ✅ Products present and match the payloads used in `UpsertProduct`
- ✅ `ProductCreated`/`ProductUpdated` events present for each product

**Test Command:**
```bash
curl -H "Authorization: Bearer $TURINGCORE_API_KEY" \
  $TURINGCORE_BASE_URL/tenants/CU_DIGITAL/products
```

---

### TC-05 – Customer Creation

**Objective:** Ensure customers are created via `CreateCustomer` and returned via projections.

**Steps:**

1. Run `seed_cu_digital` with `count=10`
2. Call `GET /tenants/CU_DIGITAL/customers?limit=20`

**Expected:**

- At least 10 customers returned
- Each contains:
  - `customerId`
  - `externalRef` like `CUST-000001`, `CUST-000002`, …
  - `fullName` composed from first/last names

**Pass Criteria:**

- ✅ The count matches expectation (10 customers)
- ✅ Each seeded `externalRef` appears exactly once
- ✅ For a sample customer, a `CustomerCreated` event exists in their event stream

**Test Command:**
```bash
curl -H "Authorization: Bearer $TURINGCORE_API_KEY" \
  "$TURINGCORE_BASE_URL/tenants/CU_DIGITAL/customers?limit=20" | jq '.customers | length'
```

---

### TC-06 – Account Creation

**Objective:** Confirm TXN and Savings accounts are correctly opened for each customer.

**Steps:**

1. For a sample of 3–5 customers from TC-05, call:
   ```
   GET /tenants/CU_DIGITAL/accounts?customerId={customerId}
   ```
2. Inspect returned accounts

**Expected:**

At least 2 accounts per sampled customer:
- One with `productCode` = `"TXN_ACCOUNT_BASIC"`
- One with `productCode` = `"SAVINGS_STANDARD"`

**Pass Criteria:**

- ✅ Account list meets expectations (2 accounts per customer)
- ✅ Each account has:
  - A valid `accountId`
  - A balance consistent with initial deposit:
    - TXN: `100.0 AUD`
    - Savings: `0.0 AUD`
- ✅ `AccountOpened` events exist for each account

**Test Command:**
```bash
# Get first customer ID
CUSTOMER_ID=$(curl -s -H "Authorization: Bearer $TURINGCORE_API_KEY" \
  "$TURINGCORE_BASE_URL/tenants/CU_DIGITAL/customers?limit=1" | jq -r '.customers[0].customerId')

# Get accounts for that customer
curl -H "Authorization: Bearer $TURINGCORE_API_KEY" \
  "$TURINGCORE_BASE_URL/tenants/CU_DIGITAL/accounts?customerId=$CUSTOMER_ID"
```

---

### TC-07 – Posting Entries (Salary)

**Objective:** Verify `PostEntry` commands create events and update balances correctly.

**Steps:**

1. For a sample customer:
   - Capture initial TXN account balance via `GET /accounts`
   - Run `seed_sample_transactions` (inside `seed_cu_digital` or as a separate step)
   - Requery the same account
   - Fetch `GET /accounts/{accountId}/events`

**Expected:**

- A `PostEntry` command was sent for a salary (check logs or instrumentation)
- Account balance increased by salary amount (within rounding)
- Event stream contains an event (or events) representing:
  - Debit to `GL_SALARY_CLEARING`
  - Credit to TXN account

**Pass Criteria:**

- ✅ Balances changed as expected
- ✅ Event history matches the multi-leg posting semantics
- ✅ No invariant failures or negative-balance anomalies logged

**Test Command:**
```bash
# Get first account ID
ACCOUNT_ID=$(curl -s -H "Authorization: Bearer $TURINGCORE_API_KEY" \
  "$TURINGCORE_BASE_URL/tenants/CU_DIGITAL/accounts?limit=1" | jq -r '.accounts[0].accountId')

# Get events for that account
curl -H "Authorization: Bearer $TURINGCORE_API_KEY" \
  "$TURINGCORE_BASE_URL/tenants/CU_DIGITAL/accounts/$ACCOUNT_ID/events"
```

---

### TC-08 – Idempotent Seed Behaviour

**Objective:** Ensure repeatable seed runs do not create duplicates.

**Steps:**

1. Start with a clean environment or note current counts:
   - Customers count for `CU_DIGITAL`
   - Accounts count for `CU_DIGITAL`

2. Run `seed_cu_digital` **twice** with identical config

3. Re-query:
   - Customer count
   - Accounts count

**Expected:**

After the second run:
- Customer count has **not doubled**
- Accounts count per customer remains **2, not 4**
- Balances reflect only **one set of initial deposits** (no double credits)

**Pass Criteria:**

- ✅ Idempotent behaviour holds (thanks to idempotency keys)
- ✅ TuringCore returns "already processed" semantics or silently ignores duplicates without corrupting state

**Test Command:**
```bash
# First run
python -m seed_cu_digital
COUNT_1=$(curl -s -H "Authorization: Bearer $TURINGCORE_API_KEY" \
  "$TURINGCORE_BASE_URL/tenants/CU_DIGITAL/customers?limit=1000" | jq '.customers | length')

# Second run
python -m seed_cu_digital
COUNT_2=$(curl -s -H "Authorization: Bearer $TURINGCORE_API_KEY" \
  "$TURINGCORE_BASE_URL/tenants/CU_DIGITAL/customers?limit=1000" | jq '.customers | length')

# Verify counts are equal
[ "$COUNT_1" -eq "$COUNT_2" ] && echo "✓ Idempotent" || echo "✗ Not idempotent"
```

---

### TC-09 – Ledger Coherence (Smoke Test)

**Objective:** Balance = sum(postings) for sample accounts.

**Steps:**

1. Select 3–5 TXN accounts
2. For each:
   - Read balance from account projection
   - Fetch events from `/accounts/{id}/events`
   - Locally sum all `PostEntry` legs affecting that account (respecting debit/credit sign)

**Expected:**

`projection_balance` ≈ `sum_of_postings` (within rounding error)

**Pass Criteria:**

- ✅ All sampled accounts satisfy this equality
- ✅ Any mismatch is investigated and resolved (v0.1 does not ship with unexplained deltas)

**Test Script:**
```python
# twin-orchestrator/tests/integration/test_ledger_coherence.py
def test_ledger_coherence():
    client = TuringCoreClient()
    accounts = client.list_accounts("CU_DIGITAL", limit=5)["accounts"]
    
    for account in accounts:
        account_id = account["accountId"]
        projection_balance = account["balance"]
        
        events = client.get_account_events("CU_DIGITAL", account_id)["events"]
        computed_balance = sum_postings_from_events(events, account_id)
        
        assert abs(projection_balance - computed_balance) < 0.01, \
            f"Balance mismatch for {account_id}: {projection_balance} != {computed_balance}"
```

---

### TC-10 – Basic Performance & Stability

**Objective:** Ensure the baseline scenario completes without instability.

**Steps:**

1. Configure `seed_cu_digital` for:
   - 100 customers
   - 30 days of simple salary + spend postings (if implemented)

2. Run the scenario and time the execution

3. Monitor:
   - CPU/memory for TuringCore pods
   - Error logs / invariant violations

**Expected:**

- Seed completes within an acceptable window for dev (e.g. **<10–15 minutes**)
- No pod crashes, restarts, or OOM
- No invariant-violation logs

**Pass Criteria:**

- ✅ Seed completes successfully within target window
- ✅ Cluster remains stable (no pod restarts)
- ✅ No invariant violations logged

**Test Command:**
```bash
time python -m seed_cu_digital --customers=100 --days=30

# Monitor pods
kubectl get pods -n turingcore -w

# Check logs for errors
kubectl logs -n turingcore deployment/turingcore-api | grep -i "error\|violation"
```

---

## 6. Exit Criteria for CU-Digital v0.1

CU-Digital v0.1 can be declared **"baseline ready"** when:

### 6.1 All Test Cases Pass

- ✅ All TC-01 → TC-10 pass without unresolved issues

### 6.2 Deviations Documented

Any deviations have documented:
- Root cause
- Decision (fix now vs defer)
- Ticket ID

### 6.3 End-to-End Repeatability

The full seed process (tenant + products + customers + accounts + salary postings):
- ✅ Can be run end-to-end from a clean environment with a **single command**
- ✅ Is **repeatable** (same config, same result) using idempotency keys

### 6.4 Independent QA Validation

QA can independently run these tests using:
- ✅ The twin repository (`turingcore-cu-digital-twin`)
- ✅ The published OpenAPI specification
- ✅ A minimal runbook (this document)

---

## 7. Test Execution Checklist

### Pre-Test Setup

- [ ] TuringCore-v3 deployed to dev/demo cluster
- [ ] PostgreSQL, Kafka, Redis infrastructure available
- [ ] API endpoints accessible from twin orchestrator
- [ ] Test API key provisioned
- [ ] Twin repository cloned and dependencies installed
- [ ] Environment variables configured (`.env` file)

### Test Execution

- [ ] TC-01: Core vs Twin Separation
- [ ] TC-02: Command Gateway Exclusivity
- [ ] TC-03: Tenant Creation (CU_DIGITAL)
- [ ] TC-04: Product Configuration
- [ ] TC-05: Customer Creation
- [ ] TC-06: Account Creation
- [ ] TC-07: Posting Entries (Salary)
- [ ] TC-08: Idempotent Seed Behaviour
- [ ] TC-09: Ledger Coherence (Smoke Test)
- [ ] TC-10: Basic Performance & Stability

### Post-Test Validation

- [ ] All test cases passed
- [ ] Deviations documented in issue tracker
- [ ] Test results shared with team
- [ ] Baseline declared ready (or issues identified for resolution)

---

## 8. Success Metrics

### Technical Metrics

- **Architecture tests**: 100% pass rate
- **Integration tests**: 100% pass rate (TC-01 to TC-10)
- **Seed execution time**: <15 minutes for 100 customers × 30 days
- **Idempotency**: 100% (no duplicates on re-run)
- **Ledger coherence**: 100% (balance = sum of postings)
- **Invariant violations**: 0

### Operational Metrics

- **Pod stability**: 0 crashes/restarts during seed
- **API availability**: 100% during seed execution
- **Error rate**: 0% for command submissions

---

## 9. Next Steps After v0.1 Acceptance

Once CU-Digital v0.1 is accepted:

### Immediate (Week 1-2)

1. **Scale testing**: Increase to 500 customers, validate performance
2. **Documentation**: Create demo playbook for sales team
3. **CI/CD integration**: Add acceptance tests to automated pipeline

### Short-Term (Week 3-4)

1. **Advanced scenarios**: Implement recession, fraud, outage scenarios
2. **UI integration**: Connect operator console and member portal
3. **Observability**: Deploy Grafana dashboards for monitoring

### Medium-Term (Week 5-10)

1. **Production readiness**: Deploy to staging environment
2. **Pilot customers**: Onboard 2-3 credit unions for pilot program
3. **Regulatory walkthrough**: Prepare APRA CPS 230/234 demonstrations

---

## 10. References

- [Turing Protocol Specification](./TURING_PROTOCOL_V2.md)
- [Core Separation Principles](./06-core-separation-principles.md)
- [API Contract Specification](./07-api-contract-specification.md)
- [Architecture Documentation](./02-architecture.md)
- [Action Checklist](./ACTION_CHECKLIST.md)

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-15  
**Owner:** TuringCore Platform Team  
**Reviewers:** Architecture Team, QA Team, Product Team
