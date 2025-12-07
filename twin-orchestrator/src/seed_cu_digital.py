"""
CU-Digital Seed Script

This is the "hello world" of the digital twin: create tenant, create products,
create customers/accounts, and post some transactions.

All writes go via submit_command → command envelope → TuringCore.
No direct database access, no imports from turingcore_v3 source.

Usage:
    python -m seed_cu_digital

Environment Variables:
    TURINGCORE_BASE_URL: Base URL for TuringCore API (required)
    TURINGCORE_API_KEY: API key for authentication (required)
"""

from __future__ import annotations

import random
from typing import Any, Dict, List

from api_client import TuringCoreClient


TENANT_CODE = "CU_DIGITAL"


def tenant_payload() -> Dict[str, Any]:
    """Generate tenant creation payload."""
    return {
        "tenantCode": TENANT_CODE,
        "displayName": "CU Digital Twin",
        "region": "AU",
        "baseCurrency": "AUD",
        "timeZone": "Australia/Sydney",
        "regulatoryJurisdiction": "APRA",
        "businessType": "CREDIT_UNION",
    }


def product_payloads() -> List[Dict[str, Any]]:
    """Generate product creation payloads."""
    return [
        {
            "productCode": "TXN_ACCOUNT_BASIC",
            "name": "Everyday Transaction Account",
            "productType": "DEPOSIT",
            "category": "TRANSACTION",
            "interest": {
                "rate": 0.0,
                "calculationMethod": "DAILY_BALANCE",
                "paymentFrequency": "MONTHLY",
            },
            "fees": {
                "monthlyFee": 0.0,
                "atmFeeOwn": 0.0,
                "atmFeeOther": 2.50,
            },
            "constraints": {
                "minBalance": 0.0,
                "maxBalance": None,
                "allowOverdraft": False,
                "overdraftLimit": 0.0,
            },
            "features": ["NPP_ENABLED", "BPAY_ENABLED", "CARD_ENABLED"],
        },
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
                    "maxMonthlyWithdrawals": 1,
                },
                "calculationMethod": "DAILY_BALANCE",
                "paymentFrequency": "MONTHLY",
            },
            "fees": {
                "monthlyFee": 0.0,
            },
            "constraints": {
                "minBalance": 0.0,
                "maxBalance": 250000.0,
            },
            "features": ["NPP_ENABLED", "BPAY_ENABLED"],
        },
        {
            "productCode": "TERM_6M",
            "name": "6 Month Term Deposit",
            "productType": "TERM_DEPOSIT",
            "category": "TERM_DEPOSIT",
            "interest": {
                "rate": 0.045,
                "calculationMethod": "SIMPLE",
                "paymentFrequency": "MATURITY",
            },
            "fees": {
                "establishmentFee": 0.0,
                "earlyRedemptionFee": 50.0,
            },
            "constraints": {
                "minAmount": 1000.0,
                "maxAmount": 1000000.0,
                "termMonths": 6,
            },
        },
    ]


def fake_customer(idx: int) -> Dict[str, Any]:
    """
    Generate a fake customer for testing.

    For v0.1, this is minimal and deterministic. In v0.2, you can use
    the Faker library or load from configuration for more realistic data.

    Args:
        idx: Customer index (1-based)

    Returns:
        Customer payload for CreateCustomer command
    """
    # Minimal, deterministic-ish faker for v0.1
    first_names = ["Alex", "Jordan", "Taylor", "Sam", "Casey", "Morgan", "Riley", "Avery"]
    last_names = ["Smith", "Nguyen", "Brown", "Wilson", "Khan", "Lee", "Garcia", "Patel"]

    first = random.choice(first_names)
    last = random.choice(last_names)

    return {
        "externalRef": f"CUST-{idx:06d}",
        "person": {
            "firstName": first,
            "lastName": last,
            # For v0.1 just pick a rough DOB range
            "dateOfBirth": "1990-01-01",
            "email": f"{first.lower()}.{last.lower()}.{idx}@example.com",
            "mobile": f"+61400{idx:06d}"[-10:],  # Ensure 10 digits
        },
        "address": {
            "line1": f"{10 + idx} Example Street",
            "line2": None,
            "suburb": "Newtown",
            "state": "NSW",
            "postcode": "2042",
            "country": "AU",
        },
        "employment": {
            "status": "FULL_TIME",
            "employer": "Example Corp",
            "occupation": "Software Engineer",
            "annualIncome": random.uniform(50000, 120000),
        },
        "riskProfile": {
            "segment": "RETAIL",
            "kycStatus": "SIMULATED_PASSED",
            "creditScore": random.randint(600, 850),
        },
    }


def seed_tenant_and_products(client: TuringCoreClient) -> None:
    """
    Bootstrap phase: Create tenant and products.

    Args:
        client: TuringCore API client
    """
    print(f"Creating tenant {TENANT_CODE} ...")
    try:
        client.create_tenant(tenant_payload())
        print(f"✓ Tenant {TENANT_CODE} created")
    except RuntimeError as e:
        if "already exists" in str(e).lower():
            print(f"⚠ Tenant {TENANT_CODE} already exists (idempotent)")
        else:
            raise

    print("Upserting products ...")
    for p in product_payloads():
        try:
            client.upsert_product(TENANT_CODE, p)
            print(f"✓ Product {p['productCode']} upserted")
        except RuntimeError as e:
            print(f"✗ Failed to upsert product {p['productCode']}: {e}")
            raise


def seed_customers_and_accounts(
    client: TuringCoreClient, count: int = 10
) -> List[Dict[str, Any]]:
    """
    Seed phase: Create customers and open accounts.

    Args:
        client: TuringCore API client
        count: Number of customers to create

    Returns:
        List of created customers with their IDs
    """
    created_customers: List[Dict[str, Any]] = []

    print(f"\nCreating {count} customers and opening accounts ...")

    for i in range(count):
        cust_payload = fake_customer(i + 1)
        idem_key = f"CreateCustomer:{TENANT_CODE}:{cust_payload['externalRef']}"

        try:
            cust_resp = client.create_customer(TENANT_CODE, cust_payload, idem_key)
            customer_id = cust_resp.get("customerId")

            if not customer_id:
                raise RuntimeError(f"No customerId returned for index {i}")

            print(f"✓ Created customer {customer_id} ({cust_payload['externalRef']})")

            # Open TXN + Savings accounts
            txn_payload = {
                "customerId": customer_id,
                "productCode": "TXN_ACCOUNT_BASIC",
                "accountAlias": "Everyday Account",
                "initialDeposit": 100.0,
                "currency": "AUD",
            }
            sav_payload = {
                "customerId": customer_id,
                "productCode": "SAVINGS_STANDARD",
                "accountAlias": "Online Saver",
                "initialDeposit": 0.0,
                "currency": "AUD",
            }

            txn_resp = client.open_account(
                TENANT_CODE,
                txn_payload,
                idem_key=f"OpenAccount:TXN:{customer_id}",
            )
            sav_resp = client.open_account(
                TENANT_CODE,
                sav_payload,
                idem_key=f"OpenAccount:SAV:{customer_id}",
            )

            txn_account_id = txn_resp.get("accountId")
            sav_account_id = sav_resp.get("accountId")

            print(f"  ✓ Opened TXN account {txn_account_id}")
            print(f"  ✓ Opened SAV account {sav_account_id}")

            created_customers.append(
                {
                    "customerId": customer_id,
                    "externalRef": cust_payload["externalRef"],
                    "txnAccountId": txn_account_id,
                    "savAccountId": sav_account_id,
                }
            )

        except RuntimeError as e:
            print(f"✗ Failed to create customer {i + 1}: {e}")
            # Continue with other customers rather than failing completely
            continue

    return created_customers


def seed_sample_transactions(
    client: TuringCoreClient,
    customers: List[Dict[str, Any]],
) -> None:
    """
    Simulate phase: Post sample transactions for customers.

    In v0.1, we post a couple of salary and spend entries per customer.
    In v0.2, you'll drive this from realistic transaction patterns based
    on customer demographics and product features.

    Args:
        client: TuringCore API client
        customers: List of created customers with account IDs
    """
    print(f"\nPosting sample transactions for {len(customers)} customers ...")

    for cust in customers:
        cust_id = cust["customerId"]
        txn_account_id = cust.get("txnAccountId")
        sav_account_id = cust.get("savAccountId")

        if not txn_account_id:
            print(f"⚠ Skipping transactions for {cust_id} (no TXN account)")
            continue

        try:
            # Post salary deposit (external → TXN account)
            salary_amount = random.uniform(2000, 5000)
            salary_payload = {
                "bookingDate": "2025-01-03",
                "valueDate": "2025-01-03",
                "currency": "AUD",
                "legs": [
                    {
                        "accountId": "GL_SALARY_CLEARING",
                        "direction": "CREDIT",
                        "amount": round(salary_amount, 2),
                    },
                    {
                        "accountId": txn_account_id,
                        "direction": "DEBIT",
                        "amount": round(salary_amount, 2),
                    },
                ],
                "narrative": "Salary - EMPLOYER XYZ",
                "tags": {
                    "category": "INCOME",
                    "source": "PAYROLL_SIM",
                },
            }
            client.post_entry(
                TENANT_CODE,
                salary_payload,
                idem_key=f"Salary:{cust_id}:2025-01-03",
            )
            print(f"✓ Posted salary entry for {cust_id} (${salary_amount:.2f})")

            # Post a couple of spend transactions (TXN account → external)
            for j in range(random.randint(1, 3)):
                spend_amount = random.uniform(10, 200)
                spend_payload = {
                    "bookingDate": f"2025-01-{4 + j:02d}",
                    "valueDate": f"2025-01-{4 + j:02d}",
                    "currency": "AUD",
                    "legs": [
                        {
                            "accountId": txn_account_id,
                            "direction": "CREDIT",
                            "amount": round(spend_amount, 2),
                        },
                        {
                            "accountId": "GL_CARD_CLEARING",
                            "direction": "DEBIT",
                            "amount": round(spend_amount, 2),
                        },
                    ],
                    "narrative": f"COLES {random.randint(100, 999)}",
                    "tags": {
                        "category": "GROCERIES",
                        "channel": "POS",
                        "merchantMcc": "5411",
                    },
                }
                client.post_entry(
                    TENANT_CODE,
                    spend_payload,
                    idem_key=f"Spend:{cust_id}:2025-01-{4 + j:02d}:{j}",
                )

            # Maybe post an internal transfer (TXN → Savings)
            if sav_account_id and random.random() < 0.5:
                transfer_amount = random.uniform(50, 500)
                transfer_payload = {
                    "bookingDate": "2025-01-10",
                    "valueDate": "2025-01-10",
                    "currency": "AUD",
                    "legs": [
                        {
                            "accountId": txn_account_id,
                            "direction": "CREDIT",
                            "amount": round(transfer_amount, 2),
                        },
                        {
                            "accountId": sav_account_id,
                            "direction": "DEBIT",
                            "amount": round(transfer_amount, 2),
                        },
                    ],
                    "narrative": "Transfer to savings",
                    "tags": {
                        "category": "TRANSFER",
                        "channel": "ONLINE",
                    },
                }
                client.post_entry(
                    TENANT_CODE,
                    transfer_payload,
                    idem_key=f"Transfer:{cust_id}:2025-01-10",
                )
                print(f"  ✓ Posted transfer to savings (${transfer_amount:.2f})")

        except RuntimeError as e:
            print(f"✗ Failed to post transactions for {cust_id}: {e}")
            continue


def inspect_results(client: TuringCoreClient) -> None:
    """
    Inspect phase: Query projections to verify results.

    Args:
        client: TuringCore API client
    """
    print("\n" + "=" * 70)
    print("INSPECTION RESULTS")
    print("=" * 70)

    try:
        # List customers
        customers_resp = client.list_customers(TENANT_CODE, limit=1000)
        customers = customers_resp.get("customers", [])
        print(f"\n✓ Total customers: {len(customers)}")

        # List accounts
        accounts_resp = client.list_accounts(TENANT_CODE, limit=1000)
        accounts = accounts_resp.get("accounts", [])
        print(f"✓ Total accounts: {len(accounts)}")

        # Show sample account balances
        if accounts:
            print("\nSample account balances:")
            for acc in accounts[:5]:
                print(
                    f"  {acc.get('accountId')}: "
                    f"{acc.get('productCode')} - "
                    f"${acc.get('balance', 0):.2f} {acc.get('currency')}"
                )

        # Show event stream for first account (if any)
        if accounts:
            first_account_id = accounts[0].get("accountId")
            events_resp = client.get_account_events(TENANT_CODE, first_account_id, limit=10)
            events = events_resp.get("events", [])
            print(f"\n✓ Events for account {first_account_id}: {len(events)}")
            if events:
                print("\nSample events:")
                for event in events[:3]:
                    print(f"  {event.get('eventType')} at {event.get('occurredAt')}")

    except Exception as e:
        print(f"✗ Inspection failed: {e}")

    print("\n" + "=" * 70)


def main() -> None:
    """Main entry point for seed script."""
    print("=" * 70)
    print("CU-DIGITAL SEED SCRIPT")
    print("=" * 70)
    print("\nThis script demonstrates the Turing Protocol separation:")
    print("- All writes go via Command Gateway")
    print("- No direct database access")
    print("- No imports from turingcore_v3 source")
    print("- Idempotent operations (safe to re-run)")
    print("\n" + "=" * 70 + "\n")

    try:
        with TuringCoreClient() as client:
            # Bootstrap: Create tenant and products
            seed_tenant_and_products(client)

            # Seed: Create customers and accounts
            customers = seed_customers_and_accounts(client, count=10)

            # Simulate: Post sample transactions
            if customers:
                seed_sample_transactions(client, customers)
            else:
                print("\n⚠ No customers created, skipping transactions")

            # Inspect: Verify results
            inspect_results(client)

            print("\n✓ CU-Digital seed complete.")
            print("\nNext steps:")
            print("1. Run architecture tests: pytest tests/architecture/")
            print("2. Validate invariants: python -m validate_invariants")
            print("3. Run full scenario: python -m run_scenario steady-state")

    except Exception as e:
        print(f"\n✗ Seed failed: {e}")
        raise


if __name__ == "__main__":
    main()
