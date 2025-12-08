"""
Scenario Configuration Loader

Functions for loading scenario configuration from steady-state.yaml into SteadyStateScenarioConfig objects.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

import yaml

from models.scenario import SteadyStateScenarioConfig


def load_steady_state_config(path: str | Path) -> SteadyStateScenarioConfig:
    """
    Load steady-state.yaml into SteadyStateScenarioConfig.

    Expected shape (simplified):
      scenario:
        name: "steady_state_v0_1"
        numCustomers: 500
        simulationDays: 30
        seed: 12345
        targetRuntimeSeconds: 900
        invariants:
          - "ledger_value_conserved"
          - "no_negative_balances_without_overdraft"
          
    Args:
        path: Path to steady-state.yaml
        
    Returns:
        SteadyStateScenarioConfig object
    """
    path = Path(path)
    data: Dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8"))

    scenario_raw = data.get("scenario", {})
    invariants: List[str] = scenario_raw.get("invariants", [])

    return SteadyStateScenarioConfig(
        num_customers=int(scenario_raw.get("numCustomers", 500)),
        simulation_days=int(scenario_raw.get("simulationDays", 30)),
        seed=int(scenario_raw.get("seed", 12345)),
        target_runtime_seconds=int(scenario_raw.get("targetRuntimeSeconds", 900)),
        invariants=invariants,
        raw=data,
    )
