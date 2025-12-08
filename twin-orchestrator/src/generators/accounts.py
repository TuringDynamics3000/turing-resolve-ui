"""
Account Generator

Pure functions for planning which accounts each customer should hold based on
tenant product catalog, customer demographics, and stochastic rules.

These functions do NOT call TuringCore - they only return AccountPlan objects
and OpenAccount payloads.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date as _date
from random import Random
from typing import Dict, List, Optional

from models.account import AccountPlan
from models.customer import CustomerSeed
from models.tenant import ProductConfig, TenantConfig


# ---------- Internal product categorisation ----------


@dataclass
class ProductBuckets:
    """Categorized product catalog for easier assignment logic."""

    txn: List[ProductConfig]
    savings: List[ProductConfig]
    youth_saver: List[ProductConfig]
    term_deposits: List[ProductConfig]
    cards: List[ProductConfig]
    personal_loans: List[ProductConfig]
    home_loans: List[ProductConfig]


def _classify_products(tenant_cfg: TenantConfig) -> ProductBuckets:
    """
    Heuristically classify ProductConfig entries into buckets based on:
    - product_type
    - code/name patterns
    - constraints
    
    Args:
        tenant_cfg: Tenant configuration with products list
        
    Returns:
        ProductBuckets with categorized products
    """
    txn: List[ProductConfig] = []
    savings: List[ProductConfig] = []
    youth_saver: List[ProductConfig] = []
    term_deposits: List[ProductConfig] = []
    cards: List[ProductConfig] = []
    personal_loans: List[ProductConfig] = []
    home_loans: List[ProductConfig] = []

    for p in tenant_cfg.products:
        code_u = p.code.upper()
        name_u = p.name.upper()
        c = p.constraints or {}

        ptype = (p.product_type or "").upper()

        # Transaction accounts
        if ptype == "DEPOSIT" and (
            c.get("category") == "TXN"
            or "TXN" in code_u
            or "EVERYDAY" in name_u
            or "TRANSACTION" in name_u
        ):
            txn.append(p)
            continue

        # Savings
        if ptype == "DEPOSIT" and (
            c.get("category") == "SAVINGS"
            or "SAVER" in name_u
            or "SAVINGS" in name_u
        ):
            # Youth saver subset
            if "YOUTH" in name_u or c.get("segment") == "YOUTH":
                youth_saver.append(p)
            else:
                savings.append(p)
            continue

        # Term deposits
        if ptype == "TERM_DEPOSIT" or "TERM" in name_u or "TD" in code_u:
            term_deposits.append(p)
            continue

        # Cards
        if ptype == "CARD" or "CARD" in name_u or c.get("category") == "CARD":
            cards.append(p)
            continue

        # Loans (personal vs home)
        if ptype == "LOAN" or "LOAN" in name_u:
            if "HOME" in name_u or "MORTGAGE" in name_u or c.get("category") == "HOME_LOAN":
                home_loans.append(p)
            else:
                personal_loans.append(p)
            continue

    # Fallbacks: if we have DEPOSIT products but none classified as TXN,
    # treat first DEPOSIT as TXN; similarly for savings.
    if not txn:
        deposit_like = [p for p in tenant_cfg.products if (p.product_type or "").upper() == "DEPOSIT"]
        if deposit_like:
            txn.append(deposit_like[0])

    if not savings and not youth_saver:
        deposit_like = [p for p in tenant_cfg.products if (p.product_type or "").upper() == "DEPOSIT"]
        if len(deposit_like) > 1:
            savings.append(deposit_like[1])

    return ProductBuckets(
        txn=txn,
        savings=savings,
        youth_saver=youth_saver,
        term_deposits=term_deposits,
        cards=cards,
        personal_loans=personal_loans,
        home_loans=home_loans,
    )


# ---------- Public API: planning accounts ----------


def plan_accounts_for_customers(
    tenant_cfg: TenantConfig,
    customers: List[CustomerSeed],
    rng: Random,
) -> List[AccountPlan]:
    """
    Decide which products each customer should hold, based on:
    - CU product catalog (TXN, savings, youth saver, term deposit, card, loans)
    - Customer segment ("YOUTH", "RETAIL", "SENIOR", etc.)
    - Income band ("LOW", "MEDIUM", "HIGH")
    - Simple stochastic rules

    This is PURE: returns AccountPlan; no calls to TuringCore.
    
    Args:
        tenant_cfg: Tenant configuration with products
        customers: List of customer seeds
        rng: Random number generator for reproducibility
        
    Returns:
        List of AccountPlan objects specifying which products each customer should hold
    """
    buckets = _classify_products(tenant_cfg)

    plans: List[AccountPlan] = []

    for cust in customers:
        product_codes: List[str] = []

        # 1) Everyone gets a primary transaction account
        primary_txn = _pick_primary_txn(buckets, rng)
        if primary_txn:
            product_codes.append(primary_txn.code)

        # 2) Savings / Youth saver logic
        _maybe_add_savings_products(
            cust=cust,
            buckets=buckets,
            rng=rng,
            product_codes=product_codes,
        )

        # 3) Cards (credit/debit)
        _maybe_add_card_products(
            cust=cust,
            buckets=buckets,
            rng=rng,
            product_codes=product_codes,
        )

        # 4) Loans (personal / home) — keep volumes modest
        _maybe_add_loans(
            cust=cust,
            buckets=buckets,
            rng=rng,
            product_codes=product_codes,
        )

        # Ensure uniqueness of product codes
        unique_codes = list(dict.fromkeys(product_codes))

        plans.append(
            AccountPlan(
                customer_external_ref=cust.external_ref,
                product_codes=unique_codes,
            )
        )

    return plans


# ---------- Building OpenAccount payloads ----------


def build_open_account_payloads(
    tenant_cfg: TenantConfig,
    account_plans: List[AccountPlan],
    customer_handles: Dict[str, str],  # external_ref -> customer_id
    customers_by_ref: Optional[Dict[str, CustomerSeed]] = None,
) -> List[dict]:
    """
    Convert AccountPlan objects into OpenAccount command payloads.

    - `tenant_cfg` provides baseCurrency and product metadata.
    - `account_plans` says which products each customer should hold.
    - `customer_handles` maps external_ref -> TuringCore customerId.
    - `customers_by_ref` (optional) lets us embed segment/income metadata.

    Returns a list of payload dicts like:

    {
      "customerId": "...",
      "productCode": "...",
      "currency": "AUD",
      "openingBalance": 0.0,
      "metadata": { ... }
    }

    These are suitable for:

        client.open_account(tenant_id, payload, idem_key=...)
        
    Args:
        tenant_cfg: Tenant configuration with products and base currency
        account_plans: List of account plans for customers
        customer_handles: Mapping from external_ref to TuringCore customer_id
        customers_by_ref: Optional mapping from external_ref to CustomerSeed for metadata
        
    Returns:
        List of OpenAccount payload dicts ready for API calls
    """
    product_index: Dict[str, ProductConfig] = {p.code: p for p in tenant_cfg.products}
    payloads: List[dict] = []

    for plan in account_plans:
        cust_id = customer_handles.get(plan.customer_external_ref)
        if not cust_id:
            # Skip if we somehow don't have a handle for this customer
            continue

        cust_seed: Optional[CustomerSeed] = None
        if customers_by_ref is not None:
            cust_seed = customers_by_ref.get(plan.customer_external_ref)

        for code in plan.product_codes:
            product = product_index.get(code)
            if not product:
                continue

            metadata: Dict[str, object] = {
                "segment": getattr(cust_seed, "segment", None),
                "incomeBand": getattr(cust_seed, "income_band", None),
                "employmentStatus": getattr(cust_seed, "employment_status", None),
                "source": "CU_DIGITAL_TWIN",
            }

            payload = {
                "customerId": cust_id,
                "productCode": code,
                "currency": product.currency or tenant_cfg.base_currency,
                "openingBalance": 0.0,  # steady-state will fund accounts via PostEntry
                "metadata": {k: v for k, v in metadata.items() if v is not None},
            }

            payloads.append(payload)

    return payloads


# ---------- Helper functions ----------


def _pick_primary_txn(
    buckets: ProductBuckets,
    rng: Random,
) -> Optional[ProductConfig]:
    """Pick a primary transaction account product."""
    if not buckets.txn:
        return None
    # If multiple TXN products, bias to the first but allow some variety
    if len(buckets.txn) == 1:
        return buckets.txn[0]
    idx = rng.randint(0, len(buckets.txn) - 1)
    return buckets.txn[idx]


def _maybe_add_savings_products(
    cust: CustomerSeed,
    buckets: ProductBuckets,
    rng: Random,
    product_codes: List[str],
) -> None:
    """
    Simple rules:
    - YOUTH segment: if there is a youth saver, 90% chance to add one.
    - SENIOR: 80% chance of at least one savings account, 40% chance of term deposit.
    - RETAIL/other: 60% chance savings; 20% term deposit for MEDIUM/HIGH incomes.
    """
    seg = (cust.segment or "").upper()
    income = (cust.income_band or "").upper()

    # Youth saver
    if "YOUTH" in seg and buckets.youth_saver:
        if rng.random() < 0.9:
            product_codes.append(buckets.youth_saver[0].code)
        return  # youth saver is the savings vehicle

    # Seniors: high savings propensity
    if "SENIOR" in seg:
        if buckets.savings and rng.random() < 0.8:
            product_codes.append(buckets.savings[0].code)
        if buckets.term_deposits and rng.random() < 0.4:
            product_codes.append(buckets.term_deposits[0].code)
        return

    # Retail/others
    if buckets.savings and rng.random() < 0.6:
        product_codes.append(buckets.savings[0].code)

    if buckets.term_deposits and income in {"MEDIUM", "HIGH"} and rng.random() < 0.2:
        product_codes.append(buckets.term_deposits[0].code)


def _maybe_add_card_products(
    cust: CustomerSeed,
    buckets: ProductBuckets,
    rng: Random,
    product_codes: List[str],
) -> None:
    """
    Basic card logic:
    - HIGH income: 60% chance of a card.
    - MEDIUM income: 35% chance.
    - LOW income: 10% chance.
    - Seniors: cap at 20% regardless of income.
    """
    if not buckets.cards:
        return

    income = (cust.income_band or "").upper()
    seg = (cust.segment or "").upper()

    if "SENIOR" in seg:
        prob = 0.2
    elif income == "HIGH":
        prob = 0.6
    elif income == "MEDIUM":
        prob = 0.35
    else:
        prob = 0.1

    if rng.random() < prob:
        product_codes.append(buckets.cards[0].code)


def _maybe_add_loans(
    cust: CustomerSeed,
    buckets: ProductBuckets,
    rng: Random,
    product_codes: List[str],
) -> None:
    """
    Conservative loan assignment (synthetic):
    - Only customers >= 21 are eligible.
    - HIGH income: 15% chance of personal loan, 10% chance of home loan.
    - MEDIUM: 10% chance personal, 3% home.
    - LOW: 5% personal, 0% home.
    - Seniors: skew towards no new loans; maybe 5% personal only.
    """
    # Derive age from DOB
    today = _date.today()
    age_years = today.year - cust.date_of_birth.year - (
        (today.month, today.day) < (cust.date_of_birth.month, cust.date_of_birth.day)
    )

    if age_years < 21:
        return

    income = (cust.income_band or "").upper()
    seg = (cust.segment or "").upper()

    # Seniors: extremely low new-loan probability
    if "SENIOR" in seg:
        if buckets.personal_loans and rng.random() < 0.05:
            product_codes.append(buckets.personal_loans[0].code)
        return

    # Non-seniors
    if income == "HIGH":
        p_personal = 0.15
        p_home = 0.10
    elif income == "MEDIUM":
        p_personal = 0.10
        p_home = 0.03
    else:
        p_personal = 0.05
        p_home = 0.0

    if buckets.personal_loans and rng.random() < p_personal:
        product_codes.append(buckets.personal_loans[0].code)

    if buckets.home_loans and rng.random() < p_home:
        product_codes.append(buckets.home_loans[0].code)
