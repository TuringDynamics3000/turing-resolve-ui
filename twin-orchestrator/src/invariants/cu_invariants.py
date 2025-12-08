"""
CU-Specific Invariants

Functions for checking CU-specific invariants against TuringCore projections.

These are higher-level invariants specific to the CU Digital Twin scenario:
1. Customer count matches expected
2. Account count matches expected
3. Transaction count matches expected
"""

from __future__ import annotations

from typing import Dict, Tuple

from api_client import TuringCoreClient
from models.scenario import SteadyStateScenarioConfig


def check_customer_count(
    client: TuringCoreClient,
    tenant_id: str,
    expected_count: int,
) -> Tuple[bool, str]:
    """
    Check that the number of customers matches expected.
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID to check
        expected_count: Expected number of customers
        
    Returns:
        (passed, message) tuple
        
    Implementation will:
    1. Query customers via client.list_customers()
    2. Count total customers
    3. Compare with expected_count
    4. Return (True, "OK") if matched, (False, error_message) if mismatched
    """
    # TODO: implement
    raise NotImplementedError


def check_account_count(
    client: TuringCoreClient,
    tenant_id: str,
    expected_min: int,
    expected_max: int,
) -> Tuple[bool, str]:
    """
    Check that the number of accounts is within expected range.
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID to check
        expected_min: Minimum expected number of accounts
        expected_max: Maximum expected number of accounts
        
    Returns:
        (passed, message) tuple
        
    Implementation will:
    1. Query accounts via client.list_accounts()
    2. Count total accounts
    3. Check that expected_min <= count <= expected_max
    4. Return (True, "OK") if in range, (False, error_message) if out of range
    """
    # TODO: implement
    raise NotImplementedError


def check_transaction_count(
    client: TuringCoreClient,
    tenant_id: str,
    expected_min: int,
) -> Tuple[bool, str]:
    """
    Check that the number of transactions is at least expected minimum.
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID to check
        expected_min: Minimum expected number of transactions
        
    Returns:
        (passed, message) tuple
        
    Implementation will:
    1. Query all account events via client.get_account_events()
    2. Count PostingApplied events
    3. Check that count >= expected_min
    4. Return (True, "OK") if >= min, (False, error_message) if < min
    """
    # TODO: implement
    raise NotImplementedError


def run_all_cu_invariants(
    client: TuringCoreClient,
    tenant_id: str,
    scenario_cfg: SteadyStateScenarioConfig,
) -> Dict[str, Tuple[bool, str]]:
    """
    Run all CU-specific invariants and return results.
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID to check
        scenario_cfg: Scenario configuration with expected counts
        
    Returns:
        Dict mapping invariant name to (passed, message) tuple
    """
    expected_customers = scenario_cfg.num_customers
    expected_accounts_min = expected_customers  # At least 1 account per customer
    expected_accounts_max = expected_customers * 5  # At most 5 accounts per customer
    expected_transactions_min = expected_customers * scenario_cfg.simulation_days  # At least 1 tx per customer per day
    
    return {
        "customer_count": check_customer_count(client, tenant_id, expected_customers),
        "account_count": check_account_count(client, tenant_id, expected_accounts_min, expected_accounts_max),
        "transaction_count": check_transaction_count(client, tenant_id, expected_transactions_min),
    }
