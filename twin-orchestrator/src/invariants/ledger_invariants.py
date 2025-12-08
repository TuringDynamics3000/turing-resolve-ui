"""
Ledger Invariants

Functions for checking ledger invariants against TuringCore projections and event streams.

These are the fundamental invariants that MUST hold for any correct ledger implementation:
1. Conservation of value (sum of all postings = 0)
2. Double-entry balance (debits = credits for each entry)
3. No negative balances (unless overdraft allowed)
4. Event-projection consistency (balances derivable from events)
5. Idempotency (no duplicate events)
"""

from __future__ import annotations

from typing import Dict, List, Tuple

from api_client import TuringCoreClient


def check_conservation_of_value(
    client: TuringCoreClient,
    tenant_id: str,
) -> Tuple[bool, str]:
    """
    Check that the sum of all postings across all accounts equals zero.
    
    This is the fundamental invariant: money cannot be created or destroyed,
    only moved between accounts.
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID to check
        
    Returns:
        (passed, message) tuple
        
    Implementation will:
    1. Query all account events via client.get_account_events()
    2. Sum all posting legs (DEBIT positive, CREDIT negative)
    3. Check that abs(total) < 0.01 (within rounding tolerance)
    4. Return (True, "OK") if passed, (False, error_message) if failed
    """
    # TODO: implement
    raise NotImplementedError


def check_double_entry_balance(
    client: TuringCoreClient,
    tenant_id: str,
) -> Tuple[bool, str]:
    """
    Check that every entry has balanced legs (debits = credits).
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID to check
        
    Returns:
        (passed, message) tuple
        
    Implementation will:
    1. Query all account events via client.get_account_events()
    2. For each PostingApplied event:
       - Sum debits
       - Sum credits
       - Check that abs(debits - credits) < 0.01
    3. Return (True, "OK") if all passed, (False, error_message) if any failed
    """
    # TODO: implement
    raise NotImplementedError


def check_no_negative_balances(
    client: TuringCoreClient,
    tenant_id: str,
) -> Tuple[bool, str]:
    """
    Check that no accounts have negative balances (unless overdraft allowed).
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID to check
        
    Returns:
        (passed, message) tuple
        
    Implementation will:
    1. Query all accounts via client.list_accounts()
    2. For each account:
       - Check if balance < 0
       - If so, check if overdraft_limit > 0
       - If not, record violation
    3. Return (True, "OK") if all passed, (False, error_message) if any failed
    """
    # TODO: implement
    raise NotImplementedError


def check_event_projection_consistency(
    client: TuringCoreClient,
    tenant_id: str,
) -> Tuple[bool, str]:
    """
    Check that account balances are derivable from event stream.
    
    This is the critical invariant for event sourcing: projections must be
    consistent with events.
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID to check
        
    Returns:
        (passed, message) tuple
        
    Implementation will:
    1. Query all accounts via client.list_accounts()
    2. For each account:
       - Query events via client.get_account_events(account_id)
       - Replay events to compute balance
       - Compare with projection balance
       - Check that abs(computed - projection) < 0.01
    3. Return (True, "OK") if all passed, (False, error_message) if any failed
    """
    # TODO: implement
    raise NotImplementedError


def check_idempotency(
    client: TuringCoreClient,
    tenant_id: str,
) -> Tuple[bool, str]:
    """
    Check that there are no duplicate events (idempotency violation).
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID to check
        
    Returns:
        (passed, message) tuple
        
    Implementation will:
    1. Query all account events via client.get_account_events()
    2. Build set of (commandId, eventType) tuples
    3. Check for duplicates
    4. Return (True, "OK") if no duplicates, (False, error_message) if duplicates found
    """
    # TODO: implement
    raise NotImplementedError


def run_all_ledger_invariants(
    client: TuringCoreClient,
    tenant_id: str,
) -> Dict[str, Tuple[bool, str]]:
    """
    Run all ledger invariants and return results.
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID to check
        
    Returns:
        Dict mapping invariant name to (passed, message) tuple
    """
    return {
        "conservation_of_value": check_conservation_of_value(client, tenant_id),
        "double_entry_balance": check_double_entry_balance(client, tenant_id),
        "no_negative_balances": check_no_negative_balances(client, tenant_id),
        "event_projection_consistency": check_event_projection_consistency(client, tenant_id),
        "idempotency": check_idempotency(client, tenant_id),
    }
