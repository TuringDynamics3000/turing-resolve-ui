"""
CU-Specific Invariants

Functions for checking CU-specific invariants against TuringCore projections.

These are higher-level invariants specific to the CU Digital Twin scenario.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from api_client import TuringCoreClient
from invariants.ledger_invariants import (
    InvariantResult,
    check_latency_slo,
)
from models.scenario import SteadyStateScenarioConfig
from models.tenant import TenantConfig


@dataclass
class CUInvariantSuiteResult:
    """Result of running the complete CU invariant suite."""
    tenant_id: str
    scenario_name: str
    passed: bool
    results: List[InvariantResult]


def run_cu_digital_invariants(
    client: TuringCoreClient,
    tenant_cfg: TenantConfig,
    scenario_cfg: SteadyStateScenarioConfig,
) -> CUInvariantSuiteResult:
    """
    Execute all invariants configured for CU-Digital steady-state scenario.
    
    This is the main entry point for running invariants. It dispatches to
    specific invariant check functions based on the scenario configuration.
    
    Args:
        client: TuringCore API client
        tenant_cfg: Tenant configuration
        scenario_cfg: Scenario configuration with invariants list
        
    Returns:
        CUInvariantSuiteResult with aggregated results
    """
    tenant_id = tenant_cfg.tenant_code
    active_invariants = scenario_cfg.invariants or [
        "ledger_value_conserved_sampled",
        "no_negative_balances_without_overdraft",
        "multi_tenant_isolation_accounts_events",
        "latency_slo",
    ]

    results: List[InvariantResult] = []

    # Dispatch based on names; simple registry pattern.
    for name in active_invariants:
        if name == "ledger_value_conserved_sampled":
            from invariants.ledger_invariants import check_value_conservation

            results.append(
                check_value_conservation(
                    client=client,
                    tenant_id=tenant_id,
                    sample_size=50,
                )
            )
        elif name == "no_negative_balances_without_overdraft":
            from invariants.ledger_invariants import (
                check_no_negative_balances_without_overdraft,
            )

            results.append(
                check_no_negative_balances_without_overdraft(
                    client=client,
                    tenant_id=tenant_id,
                    sample_size=50,
                )
            )
        elif name == "multi_tenant_isolation_accounts_events":
            from invariants.ledger_invariants import (
                check_multi_tenant_isolation_on_accounts_and_events,
            )

            results.append(
                check_multi_tenant_isolation_on_accounts_and_events(
                    client=client,
                    tenant_id=tenant_id,
                    sample_size=100,
                )
            )
        elif name == "latency_slo":
            results.append(check_latency_slo(client=client))
        else:
            results.append(
                InvariantResult(
                    name=name,
                    passed=False,
                    details="Invariant not implemented",
                )
            )

    passed = all(r.passed for r in results)

    return CUInvariantSuiteResult(
        tenant_id=tenant_id,
        scenario_name=scenario_cfg.raw.get("scenario", {}).get("name", "steady_state"),
        passed=passed,
        results=results,
    )
