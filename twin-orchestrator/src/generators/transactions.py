"""
Transaction Generator

Pure functions for generating realistic synthetic transactions based on customer
demographics, income bands, and account holdings.

These functions do NOT call TuringCore - they only return PlannedTransaction objects.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from random import Random
from typing import Any, Dict, Iterable, List

from models.account import AccountHandle
from models.customer import CustomerSeed
from models.scenario import SteadyStateScenarioConfig
from models.tenant import TenantConfig
from models.transaction import PlannedLeg, PlannedTransaction


# -------------------- Stable helpers --------------------


def _stable_hash(s: str) -> int:
    """
    Simple deterministic string hash (Python's built-in hash is salted per-process).
    """
    h = 0
    for ch in s:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return h or 1


def _simulation_start_date(scenario_cfg: SteadyStateScenarioConfig) -> date:
    """
    Use scenario startDate if provided, otherwise today's date.
    """
    scenario_raw = scenario_cfg.raw.get("scenario", {})
    start_str = scenario_raw.get("startDate")
    if start_str:
        try:
            return datetime.fromisoformat(start_str).date()
        except Exception:
            pass
    return date.today()


def _monthly_net_income_for_customer(customer: CustomerSeed) -> float:
    """
    Derive a deterministic monthly net income based on income_band and external_ref.
    This is NOT financially precise; it's just to drive synthetic flows.
    """
    band = (customer.income_band or "MEDIUM").upper()
    if band == "LOW":
        lo, hi = 2500.0, 4000.0
    elif band == "HIGH":
        lo, hi = 8000.0, 15000.0
    else:  # MEDIUM / unknown
        lo, hi = 4000.0, 8000.0

    h = _stable_hash(customer.external_ref + band)
    frac = (h % 1000) / 1000.0  # 0.0 – 0.999
    return lo + frac * (hi - lo)


def _pay_cycle_days_for_customer(customer: CustomerSeed) -> int:
    """
    Decide whether this customer is paid fortnightly or monthly, based only on external_ref.
    """
    h = _stable_hash("PAYCYCLE:" + customer.external_ref)
    return 14 if (h % 3 == 0) else 30


def _payday_offset_for_customer(customer: CustomerSeed, cycle_days: int) -> int:
    """
    Stable offset so customers don't all get paid on the same day.
    """
    h = _stable_hash("PAYOFFSET:" + customer.external_ref)
    return h % cycle_days


def _is_payday(customer: CustomerSeed, day_index: int) -> bool:
    """Check if this is a payday for the customer."""
    cycle = _pay_cycle_days_for_customer(customer)
    offset = _payday_offset_for_customer(customer, cycle)
    if day_index < offset:
        return False
    return (day_index - offset) % cycle == 0


def _is_bill_day(customer: CustomerSeed, day_index: int) -> bool:
    """
    Weekly-ish bill day with a stable offset per customer.
    """
    h = _stable_hash("BILLDAY:" + customer.external_ref)
    offset = h % 7
    return day_index % 7 == offset


# -------------------- Core generator per customer/day --------------------


def generate_daily_transactions_for_customer(
    tenant_cfg: TenantConfig,
    scenario_cfg: SteadyStateScenarioConfig,
    customer: CustomerSeed,
    day: int,
    rng: Random,
) -> List[PlannedTransaction]:
    """
    Generate a list of planned transactions for a given customer on a given simulated day.

    Model (deliberately simple but "feels real"):

    - Salary:
        * Monthly or fortnightly based on stable hash.
        * On payday: credit TXN_MAIN from GL_SALARY_CLEARING.
    - Everyday spend:
        * 0–6 POS/online spend events (debit TXN_MAIN → GL_MERCHANT).
    - Bills:
        * Once per week: 1–3 bill payments (debit TXN_MAIN → GL_BILLER).
    - Savings sweeps:
        * On payday: optional transfer TXN_MAIN → SAVINGS_MAIN if customer has savings segment.
        
    Args:
        tenant_cfg: Tenant configuration with base currency
        scenario_cfg: Scenario configuration with simulation parameters
        customer: Customer seed with demographics
        day: Day index (0-based) in the simulation
        rng: Random number generator for reproducibility
        
    Returns:
        List of PlannedTransaction objects for this customer on this day
    """
    results: List[PlannedTransaction] = []

    sim_start = _simulation_start_date(scenario_cfg)
    booking_date = sim_start + timedelta(days=day)
    value_date = booking_date  # you can offset value_date if you want float delays

    currency = tenant_cfg.base_currency

    monthly_income = _monthly_net_income_for_customer(customer)
    pay_cycle_days = _pay_cycle_days_for_customer(customer)

    # 1) Salary deposit on payday
    if _is_payday(customer, day):
        per_pay = monthly_income * (pay_cycle_days / 30.0)

        if per_pay > 0:
            results.append(
                _build_salary_transaction(
                    customer=customer,
                    booking_date=booking_date,
                    value_date=value_date,
                    currency=currency,
                    amount=per_pay,
                    pay_cycle_days=pay_cycle_days,
                )
            )

        # 1b) Optional savings sweep on payday
        # Rough rule: higher income / non-YOUTH customers more likely to save
        if _should_sweep_to_savings(customer, rng):
            sweep_amount = per_pay * 0.1  # 10% of pay into savings
            if sweep_amount > 0:
                results.append(
                    _build_savings_sweep_transaction(
                        customer=customer,
                        booking_date=booking_date,
                        value_date=value_date,
                        currency=currency,
                        amount=sweep_amount,
                    )
                )

    # 2) Everyday spend (POS/online)
    results.extend(
        _build_daily_spend_transactions(
            customer=customer,
            booking_date=booking_date,
            value_date=value_date,
            currency=currency,
            monthly_income=monthly_income,
            rng=rng,
        )
    )

    # 3) Bills (weekly-ish)
    if _is_bill_day(customer, day):
        results.extend(
            _build_bill_transactions(
                customer=customer,
                booking_date=booking_date,
                value_date=value_date,
                currency=currency,
                monthly_income=monthly_income,
                rng=rng,
            )
        )

    return results


# -------------------- Transaction builders --------------------


def _build_salary_transaction(
    customer: CustomerSeed,
    booking_date: date,
    value_date: date,
    currency: str,
    amount: float,
    pay_cycle_days: int,
) -> PlannedTransaction:
    """Build a salary deposit transaction."""
    cycle_label = "FORTNIGHTLY" if pay_cycle_days == 14 else "MONTHLY"

    legs = [
        PlannedLeg(
            account_alias="GL_SALARY_CLEARING",
            direction="DEBIT",
            amount=round(amount, 2),
        ),
        PlannedLeg(
            account_alias="TXN_MAIN",
            direction="CREDIT",
            amount=round(amount, 2),
        ),
    ]

    tags = {
        "type": "SALARY",
        "cycle": cycle_label,
        "externalRef": customer.external_ref,
    }

    return PlannedTransaction(
        customer_external_ref=customer.external_ref,
        booking_date=booking_date,
        value_date=value_date,
        currency=currency,
        legs=legs,
        narrative=f"Salary payment ({cycle_label.lower()})",
        tags=tags,
    )


def _should_sweep_to_savings(customer: CustomerSeed, rng: Random) -> bool:
    """Determine if customer should sweep funds to savings on payday."""
    seg = (customer.segment or "").upper()
    income = (customer.income_band or "").upper()

    # Heuristic: MEDIUM/HIGH income more likely to sweep, YOUTH less.
    if "YOUTH" in seg:
        base_prob = 0.2
    elif "SENIOR" in seg:
        base_prob = 0.4
    else:
        if income == "HIGH":
            base_prob = 0.7
        elif income == "MEDIUM":
            base_prob = 0.5
        else:
            base_prob = 0.25

    return rng.random() < base_prob


def _build_savings_sweep_transaction(
    customer: CustomerSeed,
    booking_date: date,
    value_date: date,
    currency: str,
    amount: float,
) -> PlannedTransaction:
    """Build a savings sweep transaction from TXN to SAVINGS."""
    legs = [
        PlannedLeg(
            account_alias="TXN_MAIN",
            direction="DEBIT",
            amount=round(amount, 2),
        ),
        PlannedLeg(
            account_alias="SAVINGS_MAIN",
            direction="CREDIT",
            amount=round(amount, 2),
        ),
    ]

    tags = {
        "type": "TRANSFER",
        "subtype": "SAVINGS_SWEEP",
        "externalRef": customer.external_ref,
    }

    return PlannedTransaction(
        customer_external_ref=customer.external_ref,
        booking_date=booking_date,
        value_date=value_date,
        currency=currency,
        legs=legs,
        narrative="Savings sweep from transaction account",
        tags=tags,
    )


def _build_daily_spend_transactions(
    customer: CustomerSeed,
    booking_date: date,
    value_date: date,
    currency: str,
    monthly_income: float,
    rng: Random,
) -> List[PlannedTransaction]:
    """
    Generate several POS/online spend transactions for the day.

    Rough budget:
      - 70% of income is "spendable"
      - divide roughly over the month and randomise a bit
    """
    results: List[PlannedTransaction] = []

    daily_spend_budget = (monthly_income * 0.7) / 30.0

    if daily_spend_budget < 40:
        min_tx, max_tx = 0, 2
    elif daily_spend_budget < 120:
        min_tx, max_tx = 1, 4
    else:
        min_tx, max_tx = 2, 6

    num_tx = rng.randint(min_tx, max_tx)

    # Avoid small or negative budgets
    if num_tx == 0 or daily_spend_budget <= 0:
        return results

    # Each transaction between 10 and, say, 1/4 of daily budget (capped)
    max_single = max(20.0, min(200.0, daily_spend_budget / 2.0))

    remaining = daily_spend_budget
    for i in range(num_tx):
        if remaining <= 0:
            break

        amount = rng.uniform(10.0, max_single)
        if amount > remaining * 1.5:
            amount = remaining * 0.8
        amount = max(5.0, amount)
        remaining -= amount

        legs = [
            PlannedLeg(
                account_alias="TXN_MAIN",
                direction="DEBIT",
                amount=round(amount, 2),
            ),
            PlannedLeg(
                account_alias="GL_MERCHANT",
                direction="CREDIT",
                amount=round(amount, 2),
            ),
        ]

        tags = {
            "type": "POS",
            "category": "DAILY_SPEND",
            "externalRef": customer.external_ref,
        }

        results.append(
            PlannedTransaction(
                customer_external_ref=customer.external_ref,
                booking_date=booking_date,
                value_date=value_date,
                currency=currency,
                legs=legs,
                narrative="Card / POS spend",
                tags=tags,
            )
        )

    return results


def _build_bill_transactions(
    customer: CustomerSeed,
    booking_date: date,
    value_date: date,
    currency: str,
    monthly_income: float,
    rng: Random,
) -> List[PlannedTransaction]:
    """
    Generate a few bill payments (BPAY/NPP direct debit) on a "bill day".
    """
    results: List[PlannedTransaction] = []

    # Approx total monthly bills = 20% of income; weekly slice ~ 1/4 of that.
    weekly_bill_budget = (monthly_income * 0.2) / 4.0

    if weekly_bill_budget <= 0:
        return results

    num_bills = rng.randint(1, 3)
    max_single = max(50.0, min(600.0, weekly_bill_budget))

    for i in range(num_bills):
        amount = rng.uniform(40.0, max_single)
        amount = round(amount, 2)

        legs = [
            PlannedLeg(
                account_alias="TXN_MAIN",
                direction="DEBIT",
                amount=amount,
            ),
            PlannedLeg(
                account_alias="GL_BILLER",
                direction="CREDIT",
                amount=amount,
            ),
        ]

        tags = {
            "type": "BILLPAY",
            "channel": "BPAY/NPP",
            "externalRef": customer.external_ref,
        }

        results.append(
            PlannedTransaction(
                customer_external_ref=customer.external_ref,
                booking_date=booking_date,
                value_date=value_date,
                currency=currency,
                legs=legs,
                narrative="Bill payment",
                tags=tags,
            )
        )

    return results


# -------------------- Whole-population iterator --------------------


def iter_all_transactions(
    tenant_cfg: TenantConfig,
    scenario_cfg: SteadyStateScenarioConfig,
    customers: List[CustomerSeed],
    rng: Random,
) -> Iterable[PlannedTransaction]:
    """
    Iterate over PlannedTransaction for all customers across all simulated days.

    Outer loop: day 0..simulation_days-1
    Inner loop: all customers
    
    Args:
        tenant_cfg: Tenant configuration
        scenario_cfg: Scenario configuration with simulation_days
        customers: List of all customer seeds
        rng: Random number generator for reproducibility
        
    Yields:
        PlannedTransaction objects one at a time
    """
    for day in range(scenario_cfg.simulation_days):
        for cust in customers:
            for tx in generate_daily_transactions_for_customer(
                tenant_cfg, scenario_cfg, cust, day, rng
            ):
                yield tx


# -------------------- Mapping to PostEntry payloads --------------------


def map_planned_transactions_to_postentry_payloads(
    planned: Iterable[PlannedTransaction],
    account_resolution: Dict[str, Dict[str, str]],
) -> Iterable[dict]:
    """
    Convert PlannedTransaction + account_resolution map into PostEntry command payloads.

    `account_resolution` example:

    {
      "CUST-000001": {
        "TXN_MAIN": "ACC_abc123",
        "SAVINGS_MAIN": "ACC_def456",
      },
      "GL": {
        "GL_SALARY_CLEARING": "GL_ACC_001",
        "GL_MERCHANT": "GL_ACC_002",
        "GL_BILLER": "GL_ACC_003",
      }
    }

    Returns dicts suitable for:

        client.post_entry(tenant_id, payload, idem_key=...)
        
    Args:
        planned: Iterable of PlannedTransaction objects
        account_resolution: Mapping from customer external_ref and "GL" to account aliases -> account IDs
        
    Yields:
        PostEntry payload dicts ready for API calls
    """
    for tx in planned:
        cust_map = account_resolution.get(tx.customer_external_ref, {})
        gl_map = account_resolution.get("GL", {})

        entry_legs: List[Dict[str, Any]] = []
        missing_alias = False

        for leg in tx.legs:
            alias = leg.account_alias
            if alias.startswith("GL_"):
                account_id = gl_map.get(alias)
            else:
                account_id = cust_map.get(alias)

            if not account_id:
                # If we can't resolve an alias, skip this whole transaction.
                missing_alias = True
                break

            entry_legs.append(
                {
                    "accountId": account_id,
                    "direction": leg.direction,
                    "amount": round(leg.amount, 2),
                    "tags": tx.tags,
                }
            )

        if missing_alias or not entry_legs:
            continue

        payload = {
            "currency": tx.currency,
            "bookingDate": tx.booking_date.isoformat(),
            "valueDate": tx.value_date.isoformat(),
            "narrative": tx.narrative,
            "customerRef": tx.customer_external_ref,
            "legs": entry_legs,
        }

        yield payload
