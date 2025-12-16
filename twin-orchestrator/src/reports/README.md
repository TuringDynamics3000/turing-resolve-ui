# Shadow Migration Reporting

Board-grade PDF report generator for Shadow Migration Daily Reconciliation Reports.

## Purpose

Converts shadow run JSON data into APRA/auditor-portable PDF evidence. This is the final conversion layer between engineering proof and board/regulator confidence.

## Usage

```bash
python shadow_pdf_report.py <json_path> <output_pdf>
```

Example:
```bash
python shadow_pdf_report.py \
  shadow_runs/2025-12-08-cu-alpha.json \
  reports/SHADOW_DAILY_RECON_2025-12-08_CU_ALPHA.pdf
```

## JSON Contract

Expected input structure:

```json
{
  "date": "2025-12-08",
  "tenant": "CU_ALPHA_SHADOW",
  "system_versions": {
    "ultradata": "v9.4.2",
    "turingcore": "v3.2.1"
  },
  "transaction_counts": {
    "total": 128442,
    "deposits": 86112,
    "withdrawals": 29441,
    "loan_repayments": 12889
  },
  "balance_recon": {
    "checked": 142221,
    "mismatches": 0,
    "exceptions": []
  },
  "gl_recon": [
    {"gl": "GL_CASH_AT_BANK", "ultra": 912334223.22, "turing": 912334223.22}
  ],
  "interest_fees": {
    "interest_delta": 0.00,
    "fee_delta": 0.00
  },
  "product_invariants": {
    "loan_amortisation": "PASS",
    "bonus_saver": "PASS",
    "overdraft_caps": "PASS",
    "term_deposit_maturity": "PASS"
  },
  "ledger_invariants": {
    "value_conservation": "PASS",
    "no_illegal_negatives": "PASS",
    "tenant_isolation": "PASS"
  },
  "anomalies": [],
  "hashes": {
    "ledger_hash": "abc123...",
    "product_config_hash": "pchg789..."
  },
  "status": "GREEN"
}
```

## Report Sections

1. **Cover Page**: Tenant, date, system versions, overall status
2. **Executive Attestation**: One-page summary with control domain status
3. **Transaction Mirroring Summary**: UltraData vs TuringCore transaction counts
4. **Member Balance Reconciliation**: Account-level balance matching
5. **General Ledger Reconciliation**: GL line-by-line comparison
6. **Interest & Fee Reconciliation**: Interest and fee deltas
7. **Product Invariant Results**: All 4 product invariants status
8. **Ledger & Protocol Invariants**: Core ledger invariants status
9. **Anomalies & Exceptions**: Classified anomalies (if any)
10. **Auditor Appendix**: Cryptographic hashes for verification

## Cutover Gate Integration

This report feeds the 90-day cutover gate:
- 30 consecutive GREEN days required
- Zero GL variance mandatory
- Zero product/ledger breaches mandatory
- Immutable audit trail via cryptographic hashes

## Dependencies

```bash
pip install reportlab
```

## Board Statement Template

> "Every night your UltraData production system is mirrored transaction-for-transaction into a fully isolated TuringCore shadow bank. Every balance, every GL line, every interest run, and every product rule is independently reconciled and verified under invariant control. We will not seek cutover authority until 90 consecutive days show zero unreconciled variance."
