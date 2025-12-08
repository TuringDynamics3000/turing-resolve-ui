"""
Command-Line Interface for Twin Orchestrator

Entry points for running scenarios and inspecting results.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from api_client import TuringCoreClient
from config.tenant_config import load_tenant_config
from config.scenario_config import load_steady_state_config
from scenarios.steady_state import SteadyStateScenario


def run_steady_state(
    tenant_config_path: str,
    scenario_config_path: str,
) -> int:
    """
    Run the steady-state scenario and return exit code.
    
    Args:
        tenant_config_path: Path to tenant config YAML
        scenario_config_path: Path to scenario config YAML
        
    Returns:
        0 if all invariants passed, 1 if any failed
    """
    client = TuringCoreClient()
    tenant_cfg = load_tenant_config(tenant_config_path)
    scenario_cfg = load_steady_state_config(scenario_config_path)

    scenario = SteadyStateScenario(
        client=client,
        tenant_cfg=tenant_cfg,
        scenario_cfg=scenario_cfg,
    )
    result = scenario.run_all()

    print(f"Tenant: {result.tenant_id}")
    print(f"Customers: {result.num_customers}")
    print(f"Accounts: {result.num_accounts}")
    print(f"Transactions: {result.num_transactions}")
    print(f"Invariants passed: {result.invariants_passed}")
    if result.invariant_failures:
        print("Invariant failures:")
        for f in result.invariant_failures:
            print(f"  - {f}")

    # Non-zero exit if invariants fail
    return 0 if result.invariants_passed else 1


def main(argv: list[str] | None = None) -> int:
    """
    Main entry point for the CLI.
    
    Usage:
        python -m cli steady-state \
          --tenant-config ../config/tenants/cu-digital.yaml \
          --scenario-config ../config/scenarios/steady-state.yaml
    """
    parser = argparse.ArgumentParser(
        description="CU-Digital Twin Orchestrator CLI",
    )
    parser.add_argument(
        "command",
        choices=["steady-state"],
        help="Scenario to run",
    )
    parser.add_argument(
        "--tenant-config",
        default="config/tenants/cu-digital.yaml",
        help="Path to tenant config YAML",
    )
    parser.add_argument(
        "--scenario-config",
        default="config/scenarios/steady-state.yaml",
        help="Path to scenario config YAML",
    )

    args = parser.parse_args(argv)

    if args.command == "steady-state":
        return run_steady_state(args.tenant_config, args.scenario_config)

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
