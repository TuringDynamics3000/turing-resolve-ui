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

## Future Enhancements
- [ ] Add Reversal UI (Reverse Transaction button in UI)
- [ ] Implement Partial Reversals
- [ ] Add Reversal Approval Workflow
- [ ] PDF Export for Evidence Packs
- [ ] Policy Editor UI for non-technical users
- [ ] Real-time WebSocket updates for Ops Inbox
- [ ] Empty states for all pages
- [ ] Error boundaries with recovery options
