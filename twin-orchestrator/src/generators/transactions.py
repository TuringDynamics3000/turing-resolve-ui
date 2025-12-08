"""
Transaction Generator

Pure functions for generating planned transactions (ledger-agnostic)
that will be converted to PostEntry commands.

These functions do NOT call TuringCore - they only return PlannedTransaction objects.
"""

from __future__ import annotations

from datetime import date
from random import Random
from typing import Dict, Iterable, List

from models.account import AccountHandle
from models.customer import CustomerSeed
from models.scenario import SteadyStateScenarioConfig
from models.tenant import TenantConfig
from models.transaction import PlannedTransaction


def generate_daily_transactions_for_customer(
    tenant_cfg: TenantConfig,
    scenario_cfg: SteadyStateScenarioConfig,
    customer: CustomerSeed,
    day: int,
    rng: Random,
) -> List[PlannedTransaction]:
    """
    Generate a list of planned transactions for a given customer on a given simulated day.

    Examples:
    - Salary into TXN on day N if it's "payday" (e.g., every 14 days)
    - Point-of-sale spend (groceries, fuel, dining)
    - Online purchases (e-commerce)
    - BPAY payments (utilities, bills)
    - Internal transfers (TXN -> SAVINGS)
    
    Args:
        tenant_cfg: Tenant configuration
        scenario_cfg: Scenario configuration
        customer: CustomerSeed for this customer
        day: Simulated day index (0 to simulation_days-1)
        rng: Random number generator for reproducibility
        
    Returns:
        List of PlannedTransaction objects for this customer on this day
        
    Implementation will:
    - Check if it's payday (e.g., day % 14 == 0) -> generate salary credit
    - Generate 0-5 random transactions per day based on customer segment:
      * YOUTH: More online purchases, dining, entertainment
      * RETAIL: Groceries, fuel, utilities
      * SENIOR: Fewer transactions, more conservative spending
    - Use income_band to determine transaction amounts
    - Return list of PlannedTransaction objects with symbolic account aliases
    """
    raise NotImplementedError


def iter_all_transactions(
    tenant_cfg: TenantConfig,
    scenario_cfg: SteadyStateScenarioConfig,
    customers: List[CustomerSeed],
    rng: Random,
) -> Iterable[PlannedTransaction]:
    """
    Iterate over PlannedTransaction for all customers across all simulated days.

    This is the main generator the scenario will consume.
    
    Args:
        tenant_cfg: Tenant configuration
        scenario_cfg: Scenario configuration with simulation_days
        customers: List of CustomerSeed objects
        rng: Random number generator for reproducibility
        
    Yields:
        PlannedTransaction objects one at a time
        
    This is memory-efficient as it generates transactions on-the-fly
    rather than loading all transactions into memory.
    """
    for day in range(scenario_cfg.simulation_days):
        for cust in customers:
            for tx in generate_daily_transactions_for_customer(
                tenant_cfg, scenario_cfg, cust, day, rng
            ):
                yield tx


def map_planned_transactions_to_postentry_payloads(
    planned: Iterable[PlannedTransaction],
    account_resolution: Dict[str, Dict[str, str]],
) -> Iterable[dict]:
    """
    Convert PlannedTransaction + an account resolution map into PostEntry payloads.

    `account_resolution` might look like:
    {
        "CUST-000001": {
            "TXN_MAIN": "ACC_abc123",
            "SAVINGS_MAIN": "ACC_def456",
        },
        "GL": {
            "GL_SALARY_CLEARING": "GL_ACC_001",
            "GL_CARD_CLEARING": "GL_ACC_002",
        }
    }

    Returns dicts suitable for:
        client.post_entry(tenant_id, payload, idem_key=...)
        
    Args:
        planned: Iterator of PlannedTransaction objects
        account_resolution: Mapping from symbolic aliases to concrete accountIds
        
    Yields:
        PostEntry payload dicts ready to send to TuringCore
        
    Implementation will:
    - For each PlannedTransaction:
      * Look up customer's account resolution map
      * For each PlannedLeg:
        - Resolve account_alias to concrete accountId
        - Build leg dict with accountId, direction, amount, currency
      * Build PostEntry payload with:
        - entryType (derived from narrative/tags)
        - description (narrative)
        - valueDate
        - legs (resolved)
      * Yield payload dict
    """
    raise NotImplementedError
