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
