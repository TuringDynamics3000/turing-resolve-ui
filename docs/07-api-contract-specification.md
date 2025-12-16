# TuringCore-v3 API Contract Specification

## Executive Summary

This document defines the **minimal, stable command surface** that the digital twin (and any real credit union) uses to interact with TuringCore-v3. This is the **non-negotiable contract** that enforces the Turing Protocol and maintains strict separation between core and customers.

### Core Principle

**If it can't be done via these commands, it doesn't happen.**

No backdoors, no shortcuts, no "just for demo" hacks. This API surface is sufficient for:
- Onboarding a new CU tenant
- Configuring products
- Creating customers
- Opening accounts
- Posting money movements (salary in, spend out, internal transfers)

Everything else is built on top of these primitives.

---

## 1. Minimal Command Set

### 1.1 Tenant & Product Lifecycle

#### CreateTenant

**Purpose:** Creates a new logical credit union tenant on the shared TuringCore platform.

**Command Type:** `CreateTenant`

**Payload:**
```json
{
  "tenantCode": "CU_DIGITAL",
  "displayName": "CU Digital Twin",
  "region": "AU",
  "baseCurrency": "AUD",
  "timeZone": "Australia/Sydney",
  "regulatoryJurisdiction": "APRA",
  "businessType": "CREDIT_UNION"
}
```

**Fields:**
- `tenantCode` (string, required): Unique identifier for the tenant (uppercase, underscores)
- `displayName` (string, required): Human-readable name
- `region` (string, required): ISO 3166-1 alpha-2 country code
- `baseCurrency` (string, required): ISO 4217 currency code
- `timeZone` (string, required): IANA time zone identifier
- `regulatoryJurisdiction` (string, optional): Regulatory body (e.g., "APRA", "ASIC")
- `businessType` (string, optional): Type of financial institution

**Events Produced:**
- `TenantCreated`

**Invariants:**
- Tenant code must be unique across platform
- Currency must be supported by platform
- Time zone must be valid IANA identifier

---

#### UpsertProduct

**Purpose:** Create or update deposit/loan/term products. Idempotent by `productCode`.

**Command Type:** `UpsertProduct`

**Payload (Transaction Account):**
```json
{
  "productCode": "TXN_ACCOUNT_BASIC",
  "name": "Everyday Transaction Account",
  "productType": "DEPOSIT",
  "category": "TRANSACTION",
  "interest": {
    "rate": 0.0,
    "calculationMethod": "DAILY_BALANCE",
    "paymentFrequency": "MONTHLY"
  },
  "fees": {
    "monthlyFee": 0.0,
    "atmFeeOwn": 0.0,
    "atmFeeOther": 2.50
  },
  "constraints": {
    "minBalance": 0.0,
    "maxBalance": null,
    "allowOverdraft": false,
    "overdraftLimit": 0.0
  },
  "features": ["NPP_ENABLED", "BPAY_ENABLED", "CARD_ENABLED"]
}
```

**Payload (Savings Account):**
```json
{
  "productCode": "SAVINGS_STANDARD",
  "name": "Online Saver",
  "productType": "DEPOSIT",
  "category": "SAVINGS",
  "interest": {
    "baseRate": 0.015,
    "bonusRate": 0.030,
    "bonusConditions": {
      "minMonthlyDeposit": 200.0,
      "maxMonthlyWithdrawals": 1
    },
    "calculationMethod": "DAILY_BALANCE",
    "paymentFrequency": "MONTHLY"
  },
  "fees": {
    "monthlyFee": 0.0
  },
  "constraints": {
    "minBalance": 0.0,
    "maxBalance": 250000.0
  },
  "features": ["NPP_ENABLED", "BPAY_ENABLED"]
}
```

**Payload (Personal Loan):**
```json
{
  "productCode": "PL_CLASSIC",
  "name": "Personal Loan Classic",
  "productType": "LOAN",
  "category": "PERSONAL_LOAN",
  "interest": {
    "rate": 0.1199,
    "calculationMethod": "REDUCING_BALANCE",
    "paymentFrequency": "MONTHLY"
  },
  "fees": {
    "establishmentFee": 250.0,
    "monthlyFee": 10.0
  },
  "constraints": {
    "minAmount": 2000.0,
    "maxAmount": 50000.0,
    "termMonthsDefault": 36,
    "termMonthsOptions": [12, 24, 36, 48, 60]
  },
  "creditCriteria": {
    "minIncome": 30000.0,
    "maxDtiRatio": 0.40,
    "minCreditScore": 600
  }
}
```

**Fields:**
- `productCode` (string, required): Unique identifier for the product
- `name` (string, required): Human-readable product name
- `productType` (enum, required): `DEPOSIT`, `LOAN`, `TERM_DEPOSIT`, `CREDIT_CARD`
- `category` (string, optional): Sub-category for product type
- `interest` (object, required): Interest rate configuration
- `fees` (object, optional): Fee structure
- `constraints` (object, optional): Product limits and rules
- `features` (array, optional): Enabled features
- `creditCriteria` (object, optional): Lending criteria (for loans)

**Events Produced:**
- `ProductCreated` (if new)
- `ProductUpdated` (if existing)

**Invariants:**
- Product code must be unique within tenant
- Interest rates must be non-negative
- Constraints must be logically consistent (min < max)

---

### 1.2 Customer & Account Lifecycle

#### CreateCustomer

**Purpose:** Creates a member/customer in the system.

**Command Type:** `CreateCustomer`

**Payload:**
```json
{
  "externalRef": "CUST-000123",
  "person": {
    "firstName": "Jane",
    "lastName": "Smith",
    "dateOfBirth": "1988-05-17",
    "email": "jane.smith@example.com",
    "mobile": "+61400111222"
  },
  "address": {
    "line1": "10 Example Street",
    "line2": null,
    "suburb": "Newtown",
    "state": "NSW",
    "postcode": "2042",
    "country": "AU"
  },
  "employment": {
    "status": "FULL_TIME",
    "employer": "Example Corp",
    "occupation": "Software Engineer",
    "annualIncome": 85000.0
  },
  "riskProfile": {
    "segment": "RETAIL",
    "kycStatus": "SIMULATED_PASSED",
    "creditScore": 720
  }
}
```

**Fields:**
- `externalRef` (string, optional): External reference/customer number
- `person` (object, required): Personal details
  - `firstName` (string, required)
  - `lastName` (string, required)
  - `dateOfBirth` (string, required): ISO 8601 date
  - `email` (string, required): Valid email address
  - `mobile` (string, required): E.164 format phone number
- `address` (object, required): Residential address
- `employment` (object, optional): Employment details
- `riskProfile` (object, optional): Risk and compliance information

**Events Produced:**
- `CustomerCreated`

**Invariants:**
- Email must be unique within tenant (if provided)
- Mobile must be unique within tenant (if provided)
- Date of birth must indicate customer is at least 18 years old
- External ref must be unique within tenant (if provided)

---

#### OpenAccount

**Purpose:** Opens an account of a given product for a customer.

**Command Type:** `OpenAccount`

**Payload:**
```json
{
  "customerId": "cust_123456",
  "productCode": "TXN_ACCOUNT_BASIC",
  "accountAlias": "Everyday Account",
  "initialDeposit": 1000.00,
  "currency": "AUD",
  "accountPurpose": "PRIMARY_TRANSACTION"
}
```

**Fields:**
- `customerId` (string, required): ID of the customer opening the account
- `productCode` (string, required): Product code to use for this account
- `accountAlias` (string, optional): Customer-friendly name for the account
- `initialDeposit` (number, optional): Initial deposit amount (must be >= product min balance)
- `currency` (string, required): ISO 4217 currency code (must match tenant base currency)
- `accountPurpose` (string, optional): Purpose of the account

**Events Produced:**
- `AccountOpened`
- `FundsPosted` (if initialDeposit > 0)

**Invariants:**
- Customer must exist and be active
- Product must exist and be active
- Initial deposit must meet product minimum balance requirement
- Currency must match tenant base currency

---

### 1.3 Money Movements (Ledger / Postings)

#### PostEntry

**Purpose:** Post a multi-leg accounting entry to the ledger. This is the **only way** to move money in TuringCore.

**Command Type:** `PostEntry`

**Payload (Salary Deposit - External → Customer Account):**
```json
{
  "bookingDate": "2025-01-03",
  "valueDate": "2025-01-03",
  "currency": "AUD",
  "legs": [
    {
      "accountId": "GL_SALARY_CLEARING",
      "direction": "CREDIT",
      "amount": 3000.00
    },
    {
      "accountId": "ACC_123_TXN",
      "direction": "DEBIT",
      "amount": 3000.00
    }
  ],
  "narrative": "Salary - EMPLOYER XYZ",
  "tags": {
    "category": "INCOME",
    "source": "PAYROLL_SIM",
    "counterparty": "EMPLOYER_123"
  },
  "metadata": {
    "scenarioId": "steady-state-001",
    "syntheticDate": "2025-01-03"
  }
}
```

**Payload (Card Spend - Customer Account → External Merchant):**
```json
{
  "bookingDate": "2025-01-04",
  "valueDate": "2025-01-04",
  "currency": "AUD",
  "legs": [
    {
      "accountId": "ACC_123_TXN",
      "direction": "CREDIT",
      "amount": 45.60
    },
    {
      "accountId": "GL_CARD_CLEARING",
      "direction": "DEBIT",
      "amount": 45.60
    }
  ],
  "narrative": "COLES 0456",
  "tags": {
    "category": "GROCERIES",
    "channel": "POS",
    "merchantMcc": "5411"
  }
}
```

**Payload (Internal Transfer - Transaction → Savings):**
```json
{
  "bookingDate": "2025-01-05",
  "valueDate": "2025-01-05",
  "currency": "AUD",
  "legs": [
    {
      "accountId": "ACC_123_TXN",
      "direction": "CREDIT",
      "amount": 200.00
    },
    {
      "accountId": "ACC_123_SAVINGS",
      "direction": "DEBIT",
      "amount": 200.00
    }
  ],
  "narrative": "Transfer to savings",
  "tags": {
    "category": "TRANSFER",
    "channel": "ONLINE"
  }
}
```

**Fields:**
- `bookingDate` (string, required): ISO 8601 date when entry is recorded
- `valueDate` (string, required): ISO 8601 date when entry takes effect
- `currency` (string, required): ISO 4217 currency code
- `legs` (array, required): Array of posting legs (must balance)
  - `accountId` (string, required): Account to post to
  - `direction` (enum, required): `DEBIT` or `CREDIT`
  - `amount` (number, required): Positive amount
- `narrative` (string, required): Human-readable description
- `tags` (object, optional): Structured metadata for categorization
- `metadata` (object, optional): Additional context (e.g., scenario tracking)

**Events Produced:**
- `EntryPosted`
- `AccountBalanceUpdated` (for each affected account)

**Invariants:**
- All legs must use the same currency
- Sum of debits must equal sum of credits (balanced entry)
- All referenced accounts must exist and be active
- Posting must not violate account constraints (e.g., overdraft limits)
- Value date must be >= booking date

**Critical Rule:**
The Scenario Engine **never thinks in terms of "update balance"**. It only ever posts entries. Balances are derived from the ledger event stream.

---

## 2. The Command Envelope (Turing Protocol Gateway)

All commands are wrapped in a **standard envelope** that enables the Command Gateway to:
- Authenticate and authorize
- Enforce tenant and actor context
- Route to domain handler
- Run invariants
- Emit canonical events

### 2.1 Envelope Structure

```json
{
  "commandId": "7c1c3cf1-3da2-4a6c-baea-0329cfa25d9f",
  "tenantId": "CU_DIGITAL",
  "commandType": "CreateCustomer",
  "actor": {
    "actorType": "SYSTEM",
    "actorId": "TWIN_ORCHESTRATOR"
  },
  "timestamp": "2025-01-01T00:00:00Z",
  "payload": {
    "...": "domain-specific fields here"
  },
  "idempotencyKey": "seed-run-2025-01-cust-000123"
}
```

### 2.2 Envelope Fields

- **`commandId`** (string, required): Unique UUID for traceability and correlation
- **`tenantId`** (string, required): Tenant context for RLS and invariants
- **`commandType`** (string, required): Logical command name (e.g., `CreateCustomer`, `PostEntry`)
- **`actor`** (object, required): Who is issuing this command
  - `actorType` (enum): `SYSTEM`, `USER`, `SERVICE`
  - `actorId` (string): Identifier for the actor
- **`timestamp`** (string, required): ISO 8601 timestamp when command was issued
- **`payload`** (object, required): Domain-specific command payload (see command definitions above)
- **`idempotencyKey`** (string, optional): Allows safe retries without double-effects

### 2.3 Command Gateway Processing

**1. Validation:**
- Validate envelope structure
- Validate command type is recognized
- Validate payload against command schema

**2. Authentication & Authorization:**
- Verify actor has permission to issue this command type
- Verify actor has access to specified tenant

**3. Routing:**
- Route to appropriate domain command handler based on `commandType`

**4. Execution:**
- Execute functional core (pure business logic)
- Run invariant checks
- If invariants pass, emit canonical events
- If invariants fail, reject command with error

**5. Response:**
- Return `CommandAccepted` (202) if command accepted
- Return `ValidationError` (400) if envelope/payload invalid
- Return `Unauthorized` (401) if authentication fails
- Return `InvariantViolation` (422) if business rules violated

---

## 3. OpenAPI 3.0 Specification

### 3.1 Command Gateway Endpoint

```yaml
openapi: 3.0.3
info:
  title: TuringCore Command API
  version: 1.0.0
  description: |
    Public command API for TuringCore-v3 platform.
    All state changes must go through this API.

servers:
  - url: https://api.turingcore.internal/v1

paths:
  /tenants/{tenantId}/commands:
    post:
      summary: Submit a Turing Protocol command
      operationId: submitCommand
      tags:
        - Commands
      parameters:
        - name: tenantId
          in: path
          required: true
          description: Tenant identifier
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CommandEnvelope'
            examples:
              createCustomer:
                summary: Create a customer
                value:
                  commandId: "7c1c3cf1-3da2-4a6c-baea-0329cfa25d9f"
                  tenantId: "CU_DIGITAL"
                  commandType: "CreateCustomer"
                  actor:
                    actorType: "SYSTEM"
                    actorId: "TWIN_ORCHESTRATOR"
                  timestamp: "2025-01-01T00:00:00Z"
                  payload:
                    externalRef: "CUST-000123"
                    person:
                      firstName: "Jane"
                      lastName: "Smith"
                      dateOfBirth: "1988-05-17"
                      email: "jane.smith@example.com"
                      mobile: "+61400111222"
      responses:
        '202':
          description: Command accepted for processing
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CommandAccepted'
        '400':
          description: Validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '422':
          description: Command rejected by invariants
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/InvariantViolation'

components:
  schemas:
    CommandEnvelope:
      type: object
      required:
        - commandId
        - tenantId
        - commandType
        - actor
        - timestamp
        - payload
      properties:
        commandId:
          type: string
          format: uuid
          description: Unique identifier for this command
        tenantId:
          type: string
          description: Tenant context for this command
        commandType:
          type: string
          description: Logical command name
          enum:
            - CreateTenant
            - UpsertProduct
            - CreateCustomer
            - OpenAccount
            - PostEntry
        actor:
          $ref: '#/components/schemas/Actor'
        timestamp:
          type: string
          format: date-time
          description: When the command was issued
        idempotencyKey:
          type: string
          description: Optional key for idempotent retries
        payload:
          type: object
          description: Domain-specific command payload

    Actor:
      type: object
      required:
        - actorType
        - actorId
      properties:
        actorType:
          type: string
          enum: [SYSTEM, USER, SERVICE]
        actorId:
          type: string

    CommandAccepted:
      type: object
      properties:
        commandId:
          type: string
          format: uuid
        status:
          type: string
          enum: [ACCEPTED]
        correlationId:
          type: string
        acceptedAt:
          type: string
          format: date-time

    InvariantViolation:
      type: object
      properties:
        commandId:
          type: string
        error:
          type: string
        invariant:
          type: string
        details:
          type: object

    Error:
      type: object
      properties:
        error:
          type: string
        message:
          type: string
        details:
          type: object
```

### 3.2 Query APIs

```yaml
paths:
  /tenants/{tenantId}/customers:
    get:
      summary: List customers
      operationId: listCustomers
      tags:
        - Queries
      parameters:
        - name: tenantId
          in: path
          required: true
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
            maximum: 1000
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: List of customers
          content:
            application/json:
              schema:
                type: object
                properties:
                  customers:
                    type: array
                    items:
                      $ref: '#/components/schemas/CustomerSummary'
                  total:
                    type: integer
                  limit:
                    type: integer
                  offset:
                    type: integer

  /tenants/{tenantId}/accounts:
    get:
      summary: List accounts
      operationId: listAccounts
      tags:
        - Queries
      parameters:
        - name: tenantId
          in: path
          required: true
          schema:
            type: string
        - name: customerId
          in: query
          description: Filter by customer ID
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: List of accounts
          content:
            application/json:
              schema:
                type: object
                properties:
                  accounts:
                    type: array
                    items:
                      $ref: '#/components/schemas/AccountSummary'
                  total:
                    type: integer

  /tenants/{tenantId}/accounts/{accountId}/events:
    get:
      summary: Get events for an account
      operationId: getAccountEvents
      tags:
        - Queries
      parameters:
        - name: tenantId
          in: path
          required: true
          schema:
            type: string
        - name: accountId
          in: path
          required: true
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 100
      responses:
        '200':
          description: Event stream for account
          content:
            application/json:
              schema:
                type: object
                properties:
                  events:
                    type: array
                    items:
                      $ref: '#/components/schemas/EventEnvelope'

components:
  schemas:
    CustomerSummary:
      type: object
      properties:
        customerId:
          type: string
        externalRef:
          type: string
        fullName:
          type: string
        email:
          type: string
        segment:
          type: string
        kycStatus:
          type: string
        createdAt:
          type: string
          format: date-time

    AccountSummary:
      type: object
      properties:
        accountId:
          type: string
        customerId:
          type: string
        productCode:
          type: string
        accountAlias:
          type: string
        balance:
          type: number
        currency:
          type: string
        status:
          type: string
        openedAt:
          type: string
          format: date-time

    EventEnvelope:
      type: object
      properties:
        eventId:
          type: string
          format: uuid
        eventType:
          type: string
        tenantId:
          type: string
        entityId:
          type: string
        payload:
          type: object
        occurredAt:
          type: string
          format: date-time
        causationId:
          type: string
          description: Command ID that caused this event
```

---

## 4. Example Command Sequences

### 4.1 Bootstrap (Tenant and Products)

```
1. CreateTenant (CU_DIGITAL)
   → TenantCreated

2. UpsertProduct (TXN_ACCOUNT_BASIC)
   → ProductCreated

3. UpsertProduct (SAVINGS_STANDARD)
   → ProductCreated

4. UpsertProduct (TERM_6M)
   → ProductCreated

5. UpsertProduct (PL_CLASSIC)
   → ProductCreated
```

### 4.2 Seed (Customers and Accounts)

```
Loop N times (e.g., 500 customers):

1. CreateCustomer
   → CustomerCreated

2. OpenAccount (TXN)
   → AccountOpened
   → FundsPosted (initial deposit)

3. OpenAccount (Savings)
   → AccountOpened
   → FundsPosted (initial deposit)

4. (Optional) OpenAccount (Term Deposit)
   → AccountOpened
   → FundsPosted (initial deposit)

5. (Optional) OpenAccount (Personal Loan)
   → AccountOpened
   → LoanFacilityCreated
```

### 4.3 Simulate (30 Days of Transactions)

```
For each payday (every 14 days):
  For each customer:
    PostEntry (salary: GL_SALARY_CLEARING → ACC_TXN)
    → EntryPosted
    → AccountBalanceUpdated

For each day:
  For each customer:
    Random 0-5 times:
      PostEntry (spend: ACC_TXN → GL_CARD_CLEARING)
      → EntryPosted
      → AccountBalanceUpdated
    
    Random (40% probability):
      PostEntry (transfer: ACC_TXN → ACC_SAVINGS)
      → EntryPosted
      → AccountBalanceUpdated (both accounts)
```

### 4.4 Inspect (Validation)

```
1. GET /tenants/CU_DIGITAL/customers?limit=500
   → Verify 500 customers created

2. GET /tenants/CU_DIGITAL/accounts?limit=1000
   → Verify ~1000-1500 accounts created

3. GET /tenants/CU_DIGITAL/accounts/{accountId}/events
   → Verify event stream for sample account
   → Verify balance derivability from events
```

**All of this is done without any bypass of TuringCore.**

---

## 5. Action Checklist

### For TuringCore-v3 Repository

- [ ] **Lock the minimal command set**
  - Implement `CreateTenant`, `UpsertProduct`, `CreateCustomer`, `OpenAccount`, `PostEntry`
  - Ensure all go through Command Gateway

- [ ] **Define the envelope & OpenAPI**
  - Add command envelope schema
  - Add core query endpoints
  - Publish OpenAPI spec (version 1.0.0)

- [ ] **Enforce "command-only writes"**
  - Kill any remaining direct DB updates in core domains
  - Add tests ensuring all mutating operations go via command handlers

- [ ] **Generate client SDK**
  - Use OpenAPI generator to create Python client
  - Publish to internal package repository
  - Version with semver (e.g., `turingcore-client==1.0.0`)

### For Twin Repository

- [ ] **Wire the twin orchestrator**
  - Implement `api_client.py` around OpenAPI spec
  - Implement generators using only these commands
  - Never bypass the API

- [ ] **Use this as the non-negotiable contract**
  - Any future CU feature (real customer or twin) must go through this surface
  - No "shortcuts for demos"
  - If it can't be done via API, it can't be done

---

## 6. Success Criteria

**The API contract is successfully enforced when:**

1. ✅ **Minimal command set defined** and documented
2. ⏳ **Command Gateway implemented** in TuringCore-v3
3. ⏳ **OpenAPI spec published** and versioned
4. ⏳ **Client SDK generated** and available
5. ⏳ **Zero direct writes** to DB (except migrations)
6. ⏳ **Twin orchestrator uses only API** (validated by architecture tests)
7. ⏳ **All state changes produce events** (validated by protocol tests)

**When all criteria are met, the API contract is the single source of truth for all TuringCore interactions.**

---

## 7. Benefits

### Stability
A minimal, stable command surface reduces breaking changes and simplifies versioning.

### Testability
All commands go through a single gateway, making it easy to test invariants and protocol compliance.

### Security
Single entry point for state mutations enables comprehensive authentication, authorization, and audit logging.

### Separation
Clear API contract enforces separation between core and customers, preventing backdoors and shortcuts.

### Scalability
Well-defined command surface enables horizontal scaling of command handlers and event processors.

### Customer Confidence
Real credit unions see that they use the same APIs as the digital twin, building trust in the platform.

---

**This API contract is the foundation of TuringCore-v3's multi-tenant SaaS architecture and the key to successful credit union adoption.**
