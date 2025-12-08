"""
Scenario Configuration Loader

Functions for loading scenario configuration from steady-state.yaml into SteadyStateScenarioConfig objects.
"""

from __future__ import annotations

from pathlib import Path

import yaml

from models.scenario import SteadyStateScenarioConfig


def load_steady_state_config(config_path: str | Path) -> SteadyStateScenarioConfig:
    """
    Load steady-state scenario configuration from YAML file.
    
    Args:
        config_path: Path to steady-state.yaml
        
    Returns:
        SteadyStateScenarioConfig object
        
    Implementation will:
    1. Load YAML file
    2. Extract scenario parameters:
       - numCustomers
       - simulationDays
       - seed
       - targetRuntimeSeconds
       - invariants (list of invariant names to check)
    3. Store raw YAML in SteadyStateScenarioConfig.raw
    4. Return SteadyStateScenarioConfig
    """
    with open(config_path, "r") as f:
        raw = yaml.safe_load(f)
    
    # TODO: parse raw YAML into SteadyStateScenarioConfig
    raise NotImplementedError
