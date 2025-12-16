# Member Portal Boundaries

## Hard Boundaries

The Member Portal is a **read-only** interface. These boundaries are non-negotiable.

### What Members CAN Do

- View account balance (always shows "Balance as of [timestamp]")
- View transaction history (read-only list)
- View payment status (status only, no modification)
- Refresh page (re-queries current state)

### What Members CANNOT Do

- Initiate payments (no write endpoints exposed)
- Transfer funds (no mutation endpoints)
- Modify account details (no PUT/PATCH endpoints)
- Cancel pending payments (no DELETE endpoints)
- Edit transaction descriptions (no mutation endpoints)

## Mandatory UI Copy

Every Member Portal page MUST display:

> "Viewing only. To make changes, visit your Credit Union branch or call support."

All balance displays MUST include:

> "Balance as of [timestamp]"

## Technical Enforcement

### API Layer

Member Portal API is READ ONLY. No POST, PUT, PATCH, DELETE endpoints.

### CI Enforcement

The Digital Twin CI workflow blocks any PR that introduces:
- Write-capable endpoints in member routes
- Balance computation logic
- Payment initiation code

### Why These Boundaries Exist

1. Regulatory Compliance: Members must use authenticated channels for transactions
2. Fraud Prevention: Read-only prevents unauthorized fund movement
3. Audit Trail: All mutations go through proper banking channels with full logging
4. Liability: Credit Union retains control over all financial operations
