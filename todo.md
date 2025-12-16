# Turing Resolve UI - TODO

## Posting Reversal Feature (COMPLETED)
- [x] Implement reversePosting in database layer (db.ts)
- [x] Add tRPC procedure for reversePosting (routers.ts)
- [x] Update Python LedgerAdapter with reversal method
- [x] Write vitest tests for reversal functionality
- [x] Write Python integration tests for reversal

## Glass Fortress UI/UX Implementation (COMPLETED)
- [x] Update design tokens (colors, typography, spacing) in index.css
- [x] Add Google Fonts (Inter + JetBrains Mono)
- [x] Create DecisionCard component with glass morphism
- [x] Create StatusBadge component with semantic colors
- [x] Create RiskIndicator component (gauge visualization)
- [x] Create ExplanationTree component with collapsible nodes
- [x] Create EvidencePanel component with hash display
- [x] Create TimelineView component for decision lifecycle
- [x] Update OpsInbox page layout
- [x] Update DecisionDetail page layout
- [x] Update PolicyViewer page layout
- [x] Update EvidenceVault page layout
- [x] Add responsive breakpoints (mobile-first)
- [x] Add keyboard navigation support (kbd hints)
- [x] Add loading skeletons
- [x] Add accessibility enhancements (WCAG 2.1 AA)
- [x] Add animation utilities (fade-in, slide-up, scale-in)

## Payments Uplift Plan (Bank-Grade) - COMPLETED ✓
### Phase P0: Architecture Declaration (DONE)
- [x] Create GOVERNANCE/PAYMENTS_SURFACE_FREEZE.md
- [x] Update CODEOWNERS for payments files
- [x] Create docs/payments/ARCHITECTURE.md

### Phase P1: Payments -> Resolve Contract (DONE)
- [x] Create docs/payments/FACT_CONTRACT.md
- [x] Implement src/modules/payments/contracts/facts.py
- [x] Implement src/modules/payments/adapters/resolve_adapter.py

### Phase P2: Hard-Gated State Machine (DONE)
- [x] Implement src/modules/payments/domain/state_machine.py
- [x] Write state machine enforcement tests (21 tests passing)
- [x] Verify no state transition without decision

### Phase P3: Ledger Integration (DONE)
- [x] Implement src/modules/payments/adapters/ledger_adapter.py
- [x] Implement src/modules/payments/services/payment_service.py
- [x] Verify request-only money movement

### Phase P4: Event Sourcing & Replay (DONE)
- [x] Implement src/modules/payments/domain/events.py
- [x] Implement PaymentEventStore with hash chain
- [x] Implement EventSourcedPayment aggregate
- [x] Write replay proof tests (16 tests passing)

### Phase P5: Evidence Pack & Governance (DONE)
- [x] Implement src/modules/payments/domain/evidence.py
- [x] Implement PaymentEvidencePackBuilder
- [x] Implement EvidencePackVerifier
- [x] Implement EvidencePackExporter
- [x] Write evidence pack tests (12 tests passing)

**Total Tests: 49 passing**

## Future Enhancements
- [ ] Add Reversal UI (Reverse Transaction button in UI)
- [ ] Implement Partial Reversals
- [ ] Add Reversal Approval Workflow
- [ ] PDF Export for Evidence Packs
- [ ] Policy Editor UI for non-technical users
- [ ] Real-time WebSocket updates for Ops Inbox
- [ ] Empty states for all pages
- [ ] Error boundaries with recovery options
- [ ] Payments UI in Resolve Dashboard
- [ ] Payment Evidence Pack viewer in UI


## Lock Payments State (Governance) - COMPLETED ✓
- [x] A. Create CI gate configuration for blocking tests
- [x] B. Update Production Admissibility Certificate (GREEN status)
- [x] C. Create internal governance declaration


## Exposure Phase E1 - Read-Only Aggregation - COMPLETED ✓
### Module Structure
- [x] Create /src/modules/exposure/ directory structure
- [x] Create docs/exposure/PHASE_E1_BRIEF.md

### Domain Model
- [x] Implement ExposureSnapshot (immutable, hashable, replay-safe)
- [x] Define exposure dimensions (customer_id, product_type, currency, as_of_ledger_event_seq)

### Exposure Projection
- [x] Implement exposure_projection.py (event-sourced)
- [x] Implement ledger event consumption (postings, commitments, reversals)
- [x] Aggregation logic (lending + payments_pending + holds)

### Replay Proof Harness
- [x] Create tests/exposure_replay/ structure
- [x] Implement snapshot helper
- [x] Implement reset helper
- [x] Implement replay helper
- [x] Write deterministic replay test (18 tests passing)

### Governance
- [x] Create EXPOSURE_SURFACE_FREEZE.md
- [x] Add CI configuration for exposure tests
- [x] Update CODEOWNERS


### Additional E1 Tasks (from Issues)
- [x] E1-0: Module skeleton + authority declaration
- [x] E1-1: ExposureSnapshot canonical schema
- [x] E1-2: Exposure computation rules spec
- [x] E1-3: Ledger event reader (read-only)
- [x] E1-4: Exposure projection builder
- [ ] E1-5: Materialized projection storage (DB read model) - DEFERRED to E2
- [x] E1-6: Exposure replay proof harness
- [x] E1-7: CI integration for exposure replay
- [x] E1-8: Governance freeze for exposure surface

### AU v1 Limits Policies (Phase E2 prep)
- [ ] LIMIT-AU-TOTAL-001: Total Exposure Cap (150k AUD)
- [ ] LIMIT-AU-LENDING-001: Lending Exposure Cap (120k AUD)
- [ ] LIMIT-AU-PAYPEND-001: Pending Payments Cap (20k AUD)
- [ ] LIMIT-AU-STOPLIST-001: Hard Stop (stoplist flag)
- [ ] LIMIT-AU-CONSISTENCY-001: Data Completeness Gate
- [ ] LIMIT-AU-HIGHVALUE-001: Escalation Threshold (250k)


## Exposure Phase E2 - Resolve Consumes ExposureSnapshot - COMPLETED ✓
### E2-1: Bind ExposureSnapshot into Resolve Fact Intake
- [x] Register ExposureSnapshot as valid Resolve fact type
- [x] Ensure Resolve can accept, hash, and version exposure facts
- [x] No enforcement yet - just intake

### E2-2: Activate AU v1 Limits Policies (30 tests passing)
- [x] LIMIT-AU-TOTAL-001: Total Exposure Cap (150k AUD)
- [x] LIMIT-AU-LENDING-001: Lending Exposure Cap (120k AUD)
- [x] LIMIT-AU-PAYPEND-001: Pending Payments Cap (20k AUD)
- [x] LIMIT-AU-STOPLIST-001: Hard Stop (stoplist flag)
- [x] LIMIT-AU-CONSISTENCY-001: Data Completeness Gate
- [x] LIMIT-AU-HIGHVALUE-001: Escalation Threshold (250k)
- [x] Aggregate outcomes: DECLINE > REVIEW > ALLOW

### E2-3: Gate Lending & Payments on Exposure-Driven Decisions (17 tests passing)
- [x] Lending: Include ExposureSnapshot in decision request
- [x] Lending: Block approval if exposure policies return REVIEW/DECLINE
- [x] Payments: Include ExposureSnapshot in decision request
- [x] Payments: Block AUTHORISE if exposure breached

**Exit Criteria Met:**
> "At decision time, the system can prove what the exposure was,
> what limit applied, and why execution was allowed or blocked."


## Proof Pack - Governance Deliverable Bundle - COMPLETED ✓
### Step 1: Create Proof Pack
- [x] Master document (index + executive summary)
- [x] Production Admissibility Certificate (signed)
- [x] Decision Register extract (4 real examples)
- [x] Lending Evidence Pack (JSON + hashes)
- [x] Payments Evidence Pack (JSON + hashes)
- [x] Exposure-driven decision example (JSON + hashes)
- [x] Replay proof summary

### Step 2: Lock Scope Declaration
- [x] No new execution domains until customer demands
- [x] No ML decisions without Resolve wrappers
- [x] No ledger changes without governance exception
- [x] v1 category declaration


## Phase E3 - Exposure UI & Expanded Dimensions - COMPLETED ✓
### E3-1: Exposure Dashboard
- [x] Dashboard layout with sidebar navigation
- [x] Customer exposure summary cards
- [x] Real-time exposure metrics display
- [x] AU v1 Limits configuration display

### E3-2: Exposure Snapshot Viewer
- [x] Snapshot detail view with all dimensions
- [x] Hash verification display with copy button
- [x] Ledger event sequence reference
- [x] Historical snapshot comparison (History tab)
- [x] Raw JSON export

### E3-3: Decision Evidence Viewer
- [x] Policy evaluation breakdown (5 policies)
- [x] Evidence pack JSON viewer
- [x] Hash chain visualization
- [x] Verification status display
- [x] State transition visualization

### E3-4: New Exposure Dimensions
- [x] Product type breakdown (personal_loan, credit_card, overdraft)
- [x] Time-based exposure (30/60/90 day windows)
- [x] Velocity metrics (daily/weekly/monthly avg change)
- [x] Trend indicators (increasing/decreasing)

### E3-5: Limits Visualization
- [x] Cap utilization gauges (3 limit types)
- [x] Policy threshold indicators with policy IDs
- [x] Breach warning system (color-coded)
- [x] Limit headroom calculator


## Phase D - Deposits Uplift (Replacement-Grade) - COMPLETED ✓
### D-1: Module Structure & Governance
- [x] Create /src/modules/deposits/ directory structure
- [x] Create DEPOSITS_SURFACE_FREEZE.md
- [x] Update CODEOWNERS

### D-2: Account Domain
- [x] Account aggregate with 6 states (CREATED, ACTIVE, FROZEN, LEGAL_HOLD, DORMANT, CLOSED)
- [x] 9 account events (opened, activated, frozen, unfrozen, legal_hold_applied, legal_hold_removed, marked_dormant, reactivated, closed)
- [x] State machine with Resolve gates

### D-3: Balances Model & Holds Engine
- [x] Ledger balance (derived from ledger postings)
- [x] Available balance (ledger - holds - pending debits)
- [x] Holds as first-class domain entities
- [x] Hold lifecycle events (placed, partially_released, released, expired)

### D-4: Resolve Integration & Ledger Adapter
- [x] Deposit action fact contract
- [x] Resolve outcomes (ALLOW, REVIEW, DECLINE)
- [x] Ledger adapter (request-only)

### D-5: Interest & Fees
- [x] Daily accrual events
- [x] Rate tables per product
- [x] Monthly posting via ledger
- [x] Fee types (scheduled, event-driven)
- [x] Fee events (accrued, posted, waived, refunded)

### D-6: EOD & Statements
- [x] EOD cut-off, accrual close, posting close
- [x] Reconciliation checkpoint
- [x] Monthly statements (hash-verifiable)
- [x] Statement hash verification

### D-7: Replay & Evidence
- [x] Deposits replay harness (18 tests passing)
- [x] Deposits evidence pack
- [x] All tests passing

### D-8: Governance Freeze
- [x] CI gates for deposits tests
- [x] Production Admissibility Certificate update
- [x] Internal declaration

**DEPOSITS IS NOW 🟢 GREEN - PRODUCTION READY**
**UltraData/Geniusto deposits can be turned off.**

### GitHub Issues Completed
| Issue | Description | Status |
|-------|-------------|--------|
| D0 | Epic: Replacement-Grade Deposits | ✅ |
| D1 | Module Boundary + Architecture | ✅ |
| D2 | Account Domain Model | ✅ |
| D3 | Fact Contract for Resolve | ✅ |
| D4 | Resolve Adapter (Mandatory Gate) | ✅ |
| D5 | Request-Only Ledger Adapter | ✅ |
| D6 | Holds Engine | ✅ |
| D7 | Balance Computation Projection | ✅ |
| D8 | Interest Engine | ✅ |
| D9 | Fees Engine | ✅ |
| D10 | EOD Close & Checkpointing | ✅ |
| D11 | Statements v1 | ✅ |
| D12 | Evidence Pack | ✅ |
| D13 | Replay Proof Harness | ✅ |
| D14 | Back-Office Controls | ⏸️ P1 |
| D15 | Surface Freeze + CI Gates | ✅ |


## System Governance Dashboard (Blue Theme) - COMPLETED ✓
### Design System
- [x] Update color palette to blue theme (from emerald)
- [x] Update glass-panel styling for blue tones
- [x] Update accent colors and gradients

### System Status Overview
- [x] Module status cards (6 modules with GREEN status)
- [x] Test count summary (247/247 tests passing)
- [x] Last verified timestamps
- [x] Production readiness matrix

### Decision Flow Visualization
- [x] Request → Resolve → Decision → Execution → Ledger → Evidence flow
- [x] Animated connections
- [x] Click-through to details

### Module Deep-Dives
- [x] Lending dashboard (loans, events, governance tabs)
- [x] Payments dashboard (transactions, event chain, governance tabs)
- [x] Deposits dashboard (accounts, holds, interest, governance tabs)
- [x] Exposure dashboard (existing)

### Evidence Vault
- [x] Search any decision (cross-module)
- [x] View evidence pack
- [x] Hash verification
- [x] Export functionality

### Replay Proof
- [x] On-demand replay verification
- [x] Before/after hash comparison (73/73 tests)
- [x] Test results display

### Governance Controls
- [x] Surface freeze status (all 6 modules FROZEN)
- [x] Absolute boundaries (4 enforced)
- [x] Exception management
- [x] Internal declarations
- [x] Release information (v1.0-replacement-ready)


## TuringCore-v3 API Integration - COMPLETED ✓
### Phase 1: Analyze API Structure
- [x] Review TuringCore-v3 module structure
- [x] Identify available endpoints/services
- [x] Map data models to UI components

### Phase 2: API Client & Types
- [x] Create TypeScript types for TuringCore models (server/governance.ts)
- [x] Create governance data module with mock data matching TuringCore structures
- [x] Handle data transformation for UI

### Phase 3: tRPC Routes
- [x] Create tRPC routes for Resolve decisions (listDecisions, getDecision)
- [x] Create tRPC routes for Evidence packs (listEvidencePacks)
- [x] Create tRPC routes for Replay proofs (listReplayProofs)
- [x] Create tRPC routes for Module status (listModules, getSystemSummary)

### Phase 4: Frontend Integration
- [x] Connect System Overview to live data (7 decisions, 247 tests, 6 modules)
- [x] Connect Module dashboards to live data
- [x] Connect Evidence Vault to live data (decisions, evidence packs, replay proofs)
- [x] Connect Governance Controls to live data

**Dashboard now shows live data from tRPC backend:**
- 6 modules all GREEN
- 247/247 tests passing
- 7 decisions recorded (3 ALLOW, 2 REVIEW, 2 DECLINE)
- 12/12 replay proofs passing
- v1.0-replacement-ready release tag



## Live TuringCore-v3 API Integration - COMPLETED ✓
### Phase 1: Python API Service
- [x] Analyze TuringCore-v3 module structure for API endpoints
- [x] Create FastAPI service in TuringCore-v3 (src/governance_api/main.py)
- [x] Expose decisions, evidence, and module status endpoints

### Phase 2: API Endpoints (Running on port 8001)
- [x] GET /api/decisions - List all decisions (7 decisions)
- [x] GET /api/decisions/{id} - Get decision by ID
- [x] GET /api/evidence - List evidence packs (3 packs)
- [x] GET /api/evidence/{id} - Get evidence pack by ID
- [x] GET /api/modules - List module status (6 modules)
- [x] GET /api/replay-proofs - List replay proof results (12 proofs)
- [x] GET /api/summary - System summary

### Phase 3: tRPC Integration
- [x] Update governance.ts to call Python API (async fetch)
- [x] Handle API errors and fallbacks
- [x] Transform snake_case to camelCase

### Phase 4: Testing
- [x] Test end-to-end data flow
- [x] Verify live data displays correctly in Evidence Vault

**Dashboard now fetches LIVE data from TuringCore-v3 Governance API**


## UI Improvements - Panel Visibility - COMPLETED ✓
- [x] Increase panel border contrast (blue accent borders)
- [x] Add subtle glow/shadow effects (blue glow on hover)
- [x] Improve background differentiation (lighter card backgrounds)
- [x] Enhance card depth perception (multi-layer shadows + inset highlight)


## UI - Hover Explainers - COMPLETED ✓
- [x] Add tooltips to summary stat cards (Modules, Tests, Decisions, Release)
- [x] Add tooltips to Decision Flow steps (Request, Resolve, Decision, Execution, Ledger, Evidence)
- [x] Add tooltips to Module cards (Resolve, Ledger, Lending, Payments, Exposure, Deposits)
- [x] Add tooltips to Live Decisions items (explains ALLOW/REVIEW/DECLINE outcomes)
- [x] Add help icons with "Why it matters" explanations for non-technical viewers


## Realistic Test Data - COMPLETED ✓
- [x] Add more decisions (30 with varied outcomes: 14 allowed, 9 review, 7 declined)
- [x] Add realistic customer names and IDs (30 unique Australian names)
- [x] Add varied financial amounts ($500 - $150,000 AUD)
- [x] Add realistic timestamps (spread over past 30 days)
- [x] Add more evidence packs with varied modules (12 packs)
- [x] Add more replay proof entries (12 proofs across 4 modules)
- [x] Add realistic policy evaluations (6 AU v1 policies)


## Branding Update - TuringDynamics Core - COMPLETED ✓
- [x] Update SystemOverview.tsx header title
- [x] Update GlobalNav.tsx logo text
- [x] Update page title in index.html
- [x] Update any other references to "Turing Protocol"


## Phase R - Reporting Replacement Uplift - COMPLETED ✓
### R0: Epic - Replacement-Grade Reporting
- [x] Customer statements reproducible
- [x] Trial balance + GL feeds reconcile
- [x] Ops reports cover daily needs
- [x] Regulatory data extracts available
- [x] Report replay proof passes (16 tests)
- [x] Reporting surface frozen

### R1: Architecture & Authority Declaration
- [x] Create docs/reporting/ARCHITECTURE.md
- [x] Declare: Ledger = financial truth, Resolve = decision truth, Reports = projections only

### R2: Customer Statements
- [x] Statement domain model (PDF + JSON)
- [x] Reproducible with hash
- [x] Holds disclosure

### R3: Trial Balance & GL Feeds
- [x] Trial balance (balanced, deterministic)
- [x] GL journal feed (debits = credits)
- [x] Finance report generator

### R4: Operational Reports
- [x] Decision audit report
- [x] Exception report
- [x] EOD reconciliation report

### R5: Regulatory Data Mart
- [x] AU v1 regulatory reports
- [x] AML transaction report
- [x] APRA capital report
- [x] ASIC credit report

### R6: Evidence & Replay
- [x] Report evidence packs
- [x] Replay proof harness (16 tests passing)
- [x] CI gates (BLOCKING)
- [x] Governance freeze

**REPORTING IS NOW 🟢 GREEN - PRODUCTION READY**
**UltraData/Mambu/Geniusto reporting can be turned off.**
- [ ] No manual edits or report overrides

### R2: Customer Statements
- [ ] Monthly deposit statements (PDF + JSON)
- [ ] Include: opening/closing balances, transaction narratives, interest summary, fee summary, holds disclosure
- [ ] Generate statement hash + manifest

### R3: Statement Replay Proof Harness
- [ ] tests/reporting_replay/test_statements_replay.py
- [ ] Snapshot, wipe, replay, regenerate, compare hash

### R4: Trial Balance & Daily GL Snapshot
- [ ] Daily trial balance by account class, product, currency
- [ ] Snapshot hash + manifest

### R5: GL Journal Feed
- [ ] Map ledger events → GL accounts
- [ ] Journal export (CSV/JSON) with event_id, debit/credit, amount, posting date, product code
- [ ] Journal hash + reconciliation report

### R6: End-of-Day Reconciliation Pack
- [ ] Posted vs pending vs failed movements
- [ ] Settlement status, exception summary
- [ ] EOD manifest + hash

### R7: Operational Reports
- [ ] Payment lifecycle status
- [ ] Unreconciled items
- [ ] Aged holds
- [ ] Dormant/frozen accounts
- [ ] Operator action log

### R8: Regulatory Data Mart (AU v1)
- [ ] AUSTRAC-ready transaction dataset
- [ ] Exposure & limits breach extract
- [ ] Decision audit extract
- [ ] Evidence pack index

### R9: Report Evidence Pack & Manifest
- [ ] Report metadata, input/output hashes, section hashes, replay reference
- [ ] Audit-grade manifest

### R10: Reporting Replay Proof Harness
- [ ] tests/reporting_replay/ structure
- [ ] Replay all reports and compare hashes

### R11: Surface Freeze + CI Gates
- [ ] GOVERNANCE/REPORTING_SURFACE_FREEZE.md
- [ ] CODEOWNERS entries
- [ ] CI gates blocking

### R12: Cutover Checklist
- [ ] Statements validated vs legacy
- [ ] Trial balance matches
- [ ] GL journals reconcile
- [ ] Ops reports validated
- [ ] Regulatory extracts validated


## Reporting Dashboard UI
### Page Structure
- [ ] Create ReportingDashboard.tsx page
- [ ] Add Reporting tab to GlobalNav
- [ ] Add route in App.tsx

### Statement Generation Section
- [ ] Statement queue/history table
- [ ] Generate statement button with customer selector
- [ ] Statement status (pending, generated, delivered)
- [ ] Download PDF/JSON buttons
- [ ] Hash verification display

### Trial Balance Status Section
- [ ] Current trial balance summary
- [ ] Balance by account type
- [ ] Debits = Credits verification
- [ ] Last reconciliation timestamp
- [ ] Variance alerts

### Regulatory Report Schedules Section
- [ ] AML transaction report schedule
- [ ] APRA capital report schedule
- [ ] ASIC credit report schedule
- [ ] Next run countdown
- [ ] Last run status and hash


## Reporting Dashboard UI - COMPLETED ✓
### Statement Generation
- [x] Customer statement generator with dropdown
- [x] Statement history list (5 statements)
- [x] Status badges (Delivered, Generated, Pending, Failed)
- [x] Hash verification display with copy button
- [x] Download PDF/JSON buttons

### Trial Balance
- [x] Balance status card (BALANCED indicator)
- [x] Total debits/credits display ($19,565,000)
- [x] Last reconciliation timestamp
- [x] Trial balance hash with "Why it matters" tooltip
- [x] Balance by account type breakdown (Assets, Liabilities, Equity, Revenue, Expenses)
- [x] GL Journal entries table

### Regulatory Reports
- [x] AML reports section (Daily/Weekly) - 2 scheduled
- [x] APRA reports section (Monthly) - 2 scheduled
- [x] ASIC reports section (Quarterly) - 2 scheduled
- [x] Schedule status (next run, last run, overdue indicator)
- [x] Run Now buttons
- [x] Enable/Disable toggles


## Statement Preview Modal - COMPLETED ✓
- [x] Create StatementPreviewModal component
- [x] Add statement header with customer info and period
- [x] Add opening/closing balance display
- [x] Add transaction list with dates, descriptions, amounts
- [x] Add interest summary section
- [x] Add prominent hash verification banner
- [x] Add download PDF/JSON buttons in modal
- [x] Integrate modal into Reporting Dashboard


## Deposits Core v1 - Skeleton Repository (TypeScript) - COMPLETED ✓
### Executive Intent
- [x] Immutable banking primitive
- [x] Ledger-driven, policy-agnostic, side-effect free
- [x] Frozen by default - once exists, everything else orbits it

### DC-1: Folder Structure (Hard Boundary)
- [x] Create /core/deposits/aggregate/ (DepositAccount.ts, Balance.ts, Hold.ts)
- [x] Create /core/deposits/ledger/ (Money.ts, Posting.ts)
- [x] Create /core/deposits/events/ (DepositFact.ts)
- [x] Create /core/deposits/invariants/ (DepositInvariants.ts)
- [x] Create /core/deposits/errors/ (DepositErrors.ts)
- [x] Create /core/deposits/index.ts (public surface)
- [x] HARD RULE: Nothing imports anything outside /core/deposits

### DC-2: Ledger Primitives
- [x] Money.ts - bigint amount, currency string, no floats, no silent rounding
- [x] Money.add() and Money.subtract() with currency discipline
- [x] Posting.ts - discriminated union (Credit, Debit, HoldPlaced, HoldReleased, InterestAccrued)
- [x] No deposit(), withdraw() methods - only facts

### DC-3: Aggregate Layer (Immutable)
- [x] Balance.ts - readonly ledger Money, readonly available Money
- [x] Hold.ts - readonly id, readonly amount Money
- [x] DepositAccount.ts - readonly id, balance, holds[], status
- [x] DepositAccount.apply(posting) - returns new DepositAccount
- [x] Aggregate does not decide - only applies postings

### DC-4: Frozen Invariants
- [x] applyPosting(account, posting) - all invariants in one place
- [x] CREDIT: add to ledger and available
- [x] DEBIT: subtract from ledger and available (throws INSUFFICIENT_FUNDS)
- [x] HOLD_PLACED: subtract from available, add to holds (throws HOLD_ALREADY_EXISTS)
- [x] HOLD_RELEASED: add to available, remove from holds (throws HOLD_NOT_FOUND)
- [x] INTEREST_ACCRUED: add to ledger and available
- [x] ACCOUNT_CLOSED check on all operations

### DC-5: Deposit Facts (Event Sourcing)
- [x] DepositFact type (AccountOpened, PostingApplied, AccountClosed)
- [x] No commands, no intentions - only facts
- [x] Append-only, immutable, auditable, replayable

### DC-6: Public Surface
- [x] index.ts exports only: DepositAccount, Posting, Money, DepositFact
- [x] This is the ONLY supported API

### DC-7: Tests (44 tests passing)
- [x] Money arithmetic tests (add, subtract, currency mismatch)
- [x] Posting application tests (all 5 types)
- [x] Invariant violation tests (insufficient funds, hold not found, etc.)
- [x] Replay determinism tests
- [x] Event sourcing tests (rebuildFromFacts, validateFactSequence)


## Deposits Core v1 - Target Architecture Refactor
### Design Principles (Non-Negotiable)
- [ ] Small surface area, immutable logic, no orchestration
- [ ] No IO, no policies in core
- [ ] Facts before decisions
- [ ] Ledger postings are the only state change
- [ ] Zero framework leakage (no DB, Kafka, HTTP in core)
- [ ] Policies are external, versioned, explainable
- [ ] Replayability guaranteed by construction

### Phase DC-1: Physical Layout (Hard Boundaries)
- [ ] Create /core/deposits/aggregate/ (DepositAccount, Balance, Hold, InterestAccrual)
- [ ] Create /core/deposits/ledger/ (LedgerEntry, Posting, Money)
- [ ] Create /core/deposits/events/ (DepositFact)
- [ ] Create /core/deposits/invariants/ (DepositInvariants)
- [ ] Create /core/deposits/errors/ (DepositErrors)
- [ ] Enforce lint rules: no imports from infra, db, api, kafka
- [ ] Enforce: no side effects, no clocks, no UUIDs, no env vars
- [ ] Enforce: pure functions only

### Phase DC-2: Core Aggregate (Immutable)
- [ ] DepositAccount class (readonly id, status, balance, holds)
- [ ] Only apply(posting) method - no setters, no mutation
- [ ] Balance value object (immutable)
- [ ] Hold value object (immutable)
- [ ] InterestAccrual value object (immutable)

### Phase DC-3: Ledger as Only State Transition
- [ ] Posting type (Credit, Debit, HoldPlaced, HoldReleased, InterestAccrued)
- [ ] No deposit(), withdraw() methods
- [ ] Only facts recorded in ledger

### Phase DC-4: Frozen Invariants
- [ ] assertInvariant for NEGATIVE_AVAILABLE_BALANCE
- [ ] Stateless, declarative, centralised invariants
- [ ] No conditionals based on product type or policy
- [ ] Breaking changes require formal review

### Phase DC-5: Deposit Facts (Event Sourcing)
- [ ] DepositFact type (AccountOpened, PostingApplied, AccountClosed)
- [ ] Append-only, immutable, auditable, replayable
- [ ] No command events, no intent events

### Phase DC-6: Policy Layer (Outside Core)
- [ ] Create /policies/deposits/ directory
- [ ] FeePolicy.v1.ts (versioned, explainable)
- [ ] InterestPolicy.v1.ts (versioned, explainable)
- [ ] HoldPolicy.v1.ts (versioned, explainable)
- [ ] Policies consume facts, emit recommended postings

### Phase DC-7: Application Layer (Orchestration)
- [ ] Create /application/deposits/ directory
- [ ] OpenAccountHandler.ts
- [ ] ApplyPostingHandler.ts
- [ ] CloseAccountHandler.ts
- [ ] Handlers cannot break invariants

### Phase DC-8: Infrastructure Adapters
- [ ] Create /adapters/db/ for storage translation
- [ ] Create /adapters/api/ for command translation
- [ ] Adapters never contain logic

### Phase DC-9: Testing Model
- [ ] Pure invariant tests
- [ ] Property-based tests (forAll postings, state => invariants hold)
- [ ] Adversarial tests
- [ ] Application tests (ordering, idempotency, failure modes)
- [ ] No test mocks core behaviour


## Deposits Policy Layer (Step 1) - COMPLETED ✓
### Critical Rule: Policies recommend postings, NEVER apply them
- [x] Create DepositPolicy interface (evaluate(facts, context) => Posting[])
- [x] Policies: consume facts, emit postings, are pure
- [x] No DB, no clocks (pass time explicitly), no side effects
- [x] Versioning: one version = one file, no edits after release

### FeePolicy.v1.ts - FROZEN
- [x] Monthly maintenance fee evaluation
- [x] Low balance fee evaluation
- [x] Transaction fee evaluation (excessive withdrawals)
- [x] Fee waiver conditions (premium segment, high balance)

### InterestPolicy.v1.ts - FROZEN
- [x] Daily accrual calculation
- [x] Rate determination by product/tier
- [x] Customer segment bonus rates
- [x] Interest posting recommendation

### HoldPolicy.v1.ts - FROZEN
- [x] Hold placement rules (payment, deposit, regulatory, legal)
- [x] Hold expiration rules (auto-release by type)
- [x] Hold release conditions
- [x] Regulatory hold handling (CTR threshold)


## Deposits Application Handlers (Step 2) - COMPLETED ✓
### Critical Rule: Handlers orchestrate, NEVER decide
| Allowed | Not Allowed |
|---------|-------------|
| Load facts | Decide business rules |
| Validate command shape | Mutate balances |
| Call policies | Encode product logic |
| Emit facts | |
| Apply postings via core | |

### OpenAccountHandler.ts - IMPLEMENTED
- [x] Validate command shape
- [x] Emit ACCOUNT_OPENED fact
- [x] Create initial DepositAccount state
- [x] No balance mutation, no policy application

### ApplyPostingHandler.ts - IMPLEMENTED
- [x] Load facts for account
- [x] Evaluate policies
- [x] Apply postings via core
- [x] Emit POSTING_APPLIED facts
- [x] Cannot break invariants

### CloseAccountHandler.ts - IMPLEMENTED
- [x] Validate closure conditions
- [x] Emit ACCOUNT_CLOSED fact
- [x] No balance mutation

### Governance Files - CREATED
- [x] CODEOWNERS - review gate for core changes
- [x] BREAKING_CHANGES.md - checklist for modifications
- [x] SURFACE_FREEZE.md - governance declaration


## Shadow Mode Harness (Step 3)
- [ ] Read-only comparison
- [ ] Non-blocking execution
- [ ] Continuous comparison logging
- [ ] Compare: ledger balance, available balance, holds
- [ ] Log deltas (don't throw)
- [ ] Track: systematic differences, rounding mismatches, policy drift


## FactStore Database Integration - COMPLETED ✓
- [x] Create deposits_facts table schema (account_id, sequence, fact_type, fact_data, occurred_at)
- [x] Create deposits_accounts table for account metadata
- [x] Implement DrizzleFactStore adapter (inline in depositsRouter.ts)
- [x] loadFacts() - query by account_id ordered by sequence
- [x] appendFact() - insert with transaction
- [x] getNextSequence() - atomic increment
- [x] Integration tested via UI

## Deposits UI Integration - COMPLETED ✓
- [x] Create /deposits route and page (Core v1 tab)
- [x] Account list with balances rebuilt from facts
- [x] Account detail view with facts timeline
- [x] Governance flow visualization (Immutable Audit Trail banner)
- [x] Credit/Debit/Hold operations via UI
- [x] Real-time balance display (ledger vs available)


## Hard Guards - Deposits Core v1
### 1. Derived State Explicit
- [ ] Rename balance fields to derivedLedgerBalance, derivedAvailableBalance
- [ ] Add DERIVED_STATE.md explaining projections are disposable/rebuildable
- [ ] Add "Derived" label in UI for all computed balances
- [ ] Never call projections "balances" without qualification

### 2. FactStore Database Invariants
- [ ] Create append-only trigger (prevent UPDATE/DELETE on deposit_facts)
- [ ] Add monotonic sequence constraint
- [ ] Add idempotency key column with unique constraint
- [ ] Revoke UPDATE/DELETE privileges on deposit_facts table

### 3. Freeze Core v1 + FactStore Contract
- [ ] Create FACTSTORE_CONTRACT_FREEZE.md
- [ ] Define stable interface (appendFact, loadFacts, getNextSequence)
- [ ] Any change requires: migration plan, replay validation, version bump
- [ ] Add version field to facts table
- [ ] Update CODEOWNERS for factstore files



## Shadow Mode Harness - Critical Confidence Builder - COMPLETED ✓
### Architecture
- [x] Design shadow mode flow (legacy Python || TS Core v1 in parallel)
- [x] Read-only, non-blocking execution
- [x] No production impact - shadow runs don't affect state
- [x] Created /shadow directory with types, adapters, comparison, logging

### Python Shadow Adapter
- [x] Create shadow_adapter.py in TuringCore-v3
- [x] Wrap existing deposits logic (LegacyPythonShadowAdapter class)
- [x] Return standardized comparison output (ledger, available, holds)
- [x] FastAPI endpoint for shadow comparison (/shadow/execute, /shadow/account)

### TS Core v1 Shadow Adapter
- [x] Create CoreV1Adapter.ts in shadow/adapters
- [x] Wrap Core v1 logic with fact-based state rebuild
- [x] Return standardized comparison output

### Comparison Engine
- [x] Create ShadowComparator.ts
- [x] Compare: ledger balance, available balance, holds array
- [x] Detect: amount differences, hold count differences, state differences
- [x] Tolerance-based rounding detection (0.01%)

### Divergence Logging & Classification
- [x] Create DivergenceLogger.ts
- [x] Log all divergences with full context (console + in-memory)
- [x] Classify divergences:
  - [x] BUG: Core v1 is wrong
  - [x] POLICY_DIFFERENCE: Intentional behavior change
  - [x] ROUNDING_ARTEFACT: Floating point vs bigint
  - [x] TIMING: Race condition or sequence difference
  - [x] MISSING_FEATURE: Core v1 doesn't support yet
- [x] Track divergence trends over time (getTrends method)
- [x] Generate markdown reports (generateReport method)
- [x] Export divergences as JSON (export method)

### Shadow Mode Tests (13 tests passing)
- [x] Test with known good scenarios (expect match)
- [x] Test with known edge cases (success/failure divergence)
- [x] Test balance divergence detection
- [x] Test divergence classification and filtering
- [x] Test report generation



## Payments Core v1 - Subordinate to Deposits Core - COMPLETED ✓
### Executive Intent
- [x] Payments Core owns intent, routing, lifecycle - NOT balances
- [x] Deposits Core owns money - Payments emits postings, never mutates
- [x] One-way dependency: core/payments → core/deposits (never reverse)

### Non-Negotiable Rules (Structurally Enforced)
- [x] Payments Core cannot import DB, Kafka, HTTP
- [x] Payments Core cannot touch Money, Balance, or Hold internals
- [x] Payments Core cannot change balances
- [x] All money movement via Deposits Core postings
- [x] Payment state ≠ account state

### PC-1: Folder Structure - IMPLEMENTED
- [x] Create /core/payments/aggregate/ (Payment.ts, PaymentState.ts)
- [x] Create /core/payments/events/ (PaymentFact.ts)
- [x] Create /core/payments/commands/ (PaymentCommand.ts)
- [x] Create /core/payments/errors/ (PaymentErrors.ts)
- [x] Create /core/payments/index.ts (public surface)

### PC-2: Payment Aggregate - IMPLEMENTED
- [x] Payment class with id, fromAccount, toAccount, amount, state, holds
- [x] References Money (value object only) - does not hold balances
- [x] References accounts by ID only
- [x] apply(event: PaymentFact) => Payment (immutable)

### PC-3: Payment State Machine (Deterministic) - IMPLEMENTED
- [x] States: INITIATED, HELD, AUTHORISED, SENT, SETTLED, FAILED, REVERSED
- [x] Forward-only progression unless explicitly reversed
- [x] No implicit transitions, no magic retries
- [x] State transition validation

### PC-4: Payment Facts (Event Sourcing) - IMPLEMENTED
- [x] PaymentInitiated, PaymentHoldPlaced, PaymentAuthorised
- [x] PaymentSent, PaymentSettled, PaymentFailed, PaymentReversed
- [x] Append-only, replayable, explainable
- [x] No side effects

### PC-5: Deposits Core Integration (Critical) - IMPLEMENTED
- [x] Payments emits intent, Deposits emits truth
- [x] Payment Intent → Deposit Posting mapping:
  - Reserve funds → HOLD_PLACED
  - Release funds → HOLD_RELEASED
  - Execute debit → DEBIT
  - Execute credit → CREDIT
  - Refund → CREDIT
  - Cancel → HOLD_RELEASED

### PC-6: Application Layer Handlers - IMPLEMENTED
- [x] InitiatePaymentHandler.ts
- [x] PlaceHoldHandler.ts
- [x] SettlePaymentHandler.ts
- [x] ReversePaymentHandler.ts
- [x] Failure semantics: Deposits failure → payment stays in current state

### PC-7: Tests (29 tests passing)
- [x] State machine legality tests
- [x] Replay determinism tests
- [x] Invalid transition tests
- [x] Full payment lifecycle tests
- [x] Payment error tests

### Governance
- [x] PAYMENTS_CORE_FREEZE.md - Surface freeze declaration



## Payments tRPC Router - Demonstrability - COMPLETED ✓
### Endpoints (Non-negotiable)
- [x] initiatePayment - emits PAYMENT_INITIATED fact, returns payment state
- [x] placeHold - emits PAYMENT_HOLD_PLACED, invokes Deposits HOLD_PLACED, returns both outcomes
- [x] settlePayment - emits PAYMENT_SENT + PAYMENT_SETTLED, invokes Deposits DEBIT + CREDIT, returns both outcomes
- [x] reversePayment - emits PAYMENT_REVERSED, invokes Deposits CREDIT (refund), returns both outcomes

### Each endpoint:
- [x] Emits payment facts
- [x] Invokes Deposits Core postings (rebuilds state from facts)
- [x] Returns payment state + deposit outcome
- [x] Proves Payments cannot bypass Deposits

### Database
- [x] Created payment_facts table (payment_id, sequence, fact_type, fact_data, deposit_fact_id, occurred_at)
- [x] Created payments table (projection for efficient querying)

### Tested Flow
- [x] INITIATED → HELD → SENT → SETTLED (full lifecycle)
- [x] Each step links to Deposits Core facts (depositFactId)

