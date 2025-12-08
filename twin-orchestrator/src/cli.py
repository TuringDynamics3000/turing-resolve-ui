"""
Command-Line Interface for Twin Orchestrator

Entry points for running scenarios and inspecting results.
"""

from __future__ import annotations

import sys
from pathlib import Path

from api_client import TuringCoreClient
from config.scenario_config import load_steady_state_config
from config.tenant_config import load_tenant_config
from scenarios.steady_state import SteadyStateScenario


def main() -> None:
    """
    Main entry point for running the steady-state scenario.
    
    Usage:
        python -m cli
        
    This will:
    1. Load tenant config from config/tenants/cu-digital.yaml
    2. Load scenario config from config/scenarios/steady-state.yaml
    3. Create TuringCore API client
    4. Run steady-state scenario (all 4 phases)
    5. Print results
    """
    # Paths relative to project root
    project_root = Path(__file__).parent.parent
    tenant_config_path = project_root / "config" / "tenants" / "cu-digital.yaml"
    scenario_config_path = project_root / "config" / "scenarios" / "steady-state.yaml"
    
    # Load configurations
    print("Loading configurations...")
    tenant_cfg = load_tenant_config(tenant_config_path)
    scenario_cfg = load_steady_state_config(scenario_config_path)
    
    print(f"Tenant: {tenant_cfg.display_name} ({tenant_cfg.tenant_code})")
    print(f"Scenario: {scenario_cfg.num_customers} customers, {scenario_cfg.simulation_days} days")
    
    # Create API client
    print("\nConnecting to TuringCore...")
    client = TuringCoreClient()
    
    # Run scenario
    print("\nRunning steady-state scenario...")
    scenario = SteadyStateScenario(client, tenant_cfg, scenario_cfg)
    
    try:
        result = scenario.run_all()
        
        # Print results
        print("\n" + "=" * 60)
        print("SCENARIO RESULTS")
        print("=" * 60)
        print(f"Tenant ID: {result.tenant_id}")
        print(f"Customers: {result.num_customers}")
        print(f"Accounts: {result.num_accounts}")
        print(f"Transactions: {result.num_transactions}")
        print(f"Invariants Passed: {result.invariants_passed}")
        
        if not result.invariants_passed:
            print("\nINVARIANT FAILURES:")
            for failure in result.invariant_failures:
                print(f"  - {failure}")
            sys.exit(1)
        else:
            print("\n✅ All invariants passed!")
            sys.exit(0)
            
    except Exception as e:
        print(f"\n❌ Scenario failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
