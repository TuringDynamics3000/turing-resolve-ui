"""
Ledger Invariants

Functions for checking ledger invariants against TuringCore projections and event streams.

These are the fundamental invariants that MUST hold for any correct ledger implementation.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple

from api_client import TuringCoreClient


@dataclass
class InvariantResult:
    """Result of running a single invariant check."""
    name: str
    passed: bool
    details: str = ""


def check_value_conservation(
    client: TuringCoreClient,
    tenant_id: str,
    sample_size: int = 50,
) -> InvariantResult:
    """
    Invariant: For sampled accounts, projection balance ~= sum(postings in event log).

    This is a smoke-level check: we don't try to prove global conservation,
    just that projections are consistent with events for a sample.
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID to check
        sample_size: Number of accounts to sample
        
    Returns:
        InvariantResult with pass/fail status and details
    
    Implementation steps:
    1. List N accounts via client.list_accounts
    2. For each account, call client.get_account_events
    3. Compute sum of postings from events
    4. Compare with projection balance
    5. Aggregate failures
    """
    # TODO:
    # - list N accounts via client.list_accounts
    # - for each, call client.get_account_events
    # - compute sum of postings and compare to projection balance
    # - aggregate failures
    return InvariantResult(
        name="ledger_value_conserved_sampled",
        passed=False,
        details="Not implemented",
    )


def check_no_negative_balances_without_overdraft(
    client: TuringCoreClient,
    tenant_id: str,
    sample_size: int = 50,
) -> InvariantResult:
    """
    Invariant: No account that is not configured for overdraft is negative.

    Needs product metadata / constraints to know which products allow overdraft.
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID to check
        sample_size: Number of accounts to sample
        
    Returns:
        InvariantResult with pass/fail status and details
        
    Implementation steps:
    1. List accounts via client.list_accounts
    2. Join with product config (from tenant_cfg) if needed
    3. Flag any non-overdraft account with negative balance
    """
    # TODO:
    # - list accounts
    # - join with product config (from tenant_cfg) if needed; here you may pass it in
    # - flag any non-overdraft account with negative balance
    return InvariantResult(
        name="no_negative_balances_without_overdraft",
        passed=False,
        details="Not implemented",
    )
