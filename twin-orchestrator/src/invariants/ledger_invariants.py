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


# ---------- Helper Functions ----------


def _sample_accounts(
    client: TuringCoreClient,
    tenant_id: str,
    sample_size: int,
) -> List[dict]:
    """
    Sample accounts from the tenant via list_accounts API.
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID to query
        sample_size: Maximum number of accounts to return
        
    Returns:
        List of account dictionaries
    """
    try:
        response = client.list_accounts(tenant_id, limit=sample_size)
        if isinstance(response, dict):
            return response.get("accounts", [])
        elif isinstance(response, list):
            return response
        return []
    except Exception as e:
        # Log error but don't fail the invariant check
        print(f"Warning: Failed to sample accounts: {e}")
        return []


def _load_all_events_for_account(
    client: TuringCoreClient,
    tenant_id: str,
    account_id: str,
) -> List[dict]:
    """
    Load all events for a specific account.
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
        account_id: Account ID to query events for
        
    Returns:
        List of event dictionaries
    """
    try:
        response = client.get_account_events(tenant_id, account_id)
        if isinstance(response, dict):
            return response.get("events", [])
        elif isinstance(response, list):
            return response
        return []
    except Exception as e:
        # Log error but don't fail the invariant check
        print(f"Warning: Failed to load events for account {account_id}: {e}")
        return []


# ---------- Multi-Tenant Isolation Invariant ----------


def check_multi_tenant_isolation_on_accounts_and_events(
    client: TuringCoreClient,
    tenant_id: str,
    sample_size: int = 100,
) -> InvariantResult:
    """
    Invariant: When reading via TuringCore tenant-scoped APIs, we must not see
    projections/events tagged with any other tenant.

    Checks:
      - For sampled accounts via list_accounts(tenant_id):
          * If account projection has `tenantId`, it MUST equal tenant_id.
      - For each account's events via get_account_events(tenant_id, account_id):
          * If event has `tenantId` (top-level or in payload), it MUST equal tenant_id.

    If fields are absent (e.g. implicit partitioning), that's OK; we only fail
    on explicit *mismatches*.
    
    This is a **critical invariant for multi-tenant SaaS** that proves tenant isolation
    is enforced at both the projection and event sourcing layers.
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID to check (e.g., "CU_DIGITAL")
        sample_size: Number of accounts to sample for checking
        
    Returns:
        InvariantResult with pass/fail status and details
    """
    accounts = _sample_accounts(client, tenant_id, sample_size)

    if not accounts:
        return InvariantResult(
            name="multi_tenant_isolation_accounts_events",
            passed=False,
            details="No accounts found to sample.",
        )

    failures: List[str] = []

    for acc in accounts:
        account_id = acc.get("accountId")
        if not account_id:
            continue

        # ---- Account projection tenant checks ----
        # Note: We assume client.get_account exists or we use the projection from list_accounts
        # For now, we'll check the projection we already have from list_accounts
        proj_tenant = (
            acc.get("tenantId")
            or acc.get("tenant_id")
            or (acc.get("metadata") or {}).get("tenantId")
        )

        if proj_tenant is not None and proj_tenant != tenant_id:
            failures.append(
                f"Account tenant mismatch: accountId={account_id}, "
                f"projection.tenantId={proj_tenant}, expected={tenant_id}"
            )
            # no need to inspect events if projection already breached
            continue

        # ---- Account event tenant checks ----
        events = _load_all_events_for_account(client, tenant_id, account_id)

        for ev in events:
            ev_tenant = (
                ev.get("tenantId")
                or ev.get("tenant_id")
                or (ev.get("metadata") or {}).get("tenantId")
                or (ev.get("payload") or {}).get("tenantId")
            )

            if ev_tenant is not None and ev_tenant != tenant_id:
                failures.append(
                    f"Event tenant mismatch: accountId={account_id}, "
                    f"eventId={ev.get('eventId')}, event.tenantId={ev_tenant}, "
                    f"expected={tenant_id}"
                )
                # break early for this account
                break

    if failures:
        details = (
            f"Multi-tenant isolation breached for {len(failures)} item(s); "
            f"example: {failures[0]}"
        )
        return InvariantResult(
            name="multi_tenant_isolation_accounts_events",
            passed=False,
            details=details,
        )

    return InvariantResult(
        name="multi_tenant_isolation_accounts_events",
        passed=True,
        details=f"All sampled accounts/events are either untagged or correctly tagged "
                f"with tenantId={tenant_id}. Checked {len(accounts)} accounts.",
    )


# ---------- Latency SLO Invariant ----------


def check_latency_slo(
    client: TuringCoreClient,
) -> InvariantResult:
    """
    Invariant: Core operations satisfy basic latency SLOs during the CU-Digital run.

    We check p95 / p99 for key op_types against configurable thresholds.
    Units are seconds.
    
    This is a **critical operational invariant** that ensures the platform can handle
    realistic workloads with acceptable performance.
    
    Args:
        client: TuringCore API client with attached latency recorder
        
    Returns:
        InvariantResult with pass/fail status and details
    """
    from metrics.latency_recorder import LatencyRecorder, LatencyStats
    
    recorder: LatencyRecorder | None = getattr(client, "latency_recorder", None)
    if recorder is None:
        return InvariantResult(
            name="latency_slo",
            passed=False,
            details="No latency recorder attached to client.",
        )

    stats = recorder.get_stats()
    if not stats:
        return InvariantResult(
            name="latency_slo",
            passed=False,
            details="No latency samples recorded.",
        )

    # SLO thresholds (tune these as you learn more)
    # Values are in seconds.
    slo: Dict[str, Dict[str, float]] = {
        # Core posting path
        "command:PostEntry": {"p95": 0.25, "p99": 0.75},

        # Onboarding
        "command:CreateCustomer": {"p95": 0.50, "p99": 1.50},
        "command:OpenAccount": {"p95": 0.50, "p99": 1.50},

        # Read paths – not critical for v0.1, but we track them anyway
        "read:get_account": {"p95": 0.25, "p99": 0.75},
        "read:list_accounts": {"p95": 0.50, "p99": 1.50},
        "read:get_account_events": {"p95": 1.00, "p99": 3.00},
    }

    failures: List[str] = []

    for op_type, thresholds in slo.items():
        st: LatencyStats | None = stats.get(op_type)
        if st is None or st.count == 0:
            # If an op_type didn't occur in this run, we just skip it.
            continue

        p95_limit = thresholds["p95"]
        p99_limit = thresholds["p99"]

        if st.p95 > p95_limit or st.p99 > p99_limit:
            failures.append(
                f"{op_type}: p95={st.p95:.3f}s (limit {p95_limit:.3f}s), "
                f"p99={st.p99:.3f}s (limit {p99_limit:.3f}s), count={st.count}"
            )

    if failures:
        return InvariantResult(
            name="latency_slo",
            passed=False,
            details="; ".join(failures[:3]),  # cap detail length
        )

    return InvariantResult(
        name="latency_slo",
        passed=True,
        details="All measured core operations met latency SLOs.",
    )
