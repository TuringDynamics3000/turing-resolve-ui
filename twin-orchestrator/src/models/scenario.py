"""
Scenario Configuration Models

Dataclasses for scenario configuration loaded from steady-state.yaml.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Dict


@dataclass
class SteadyStateScenarioConfig:
    """
    Minimal config for the steady-state scenario, loaded from steady-state.yaml.
    
    This defines how many customers to create, how many days to simulate,
    and which invariants to check.
    """
    
    num_customers: int
    simulation_days: int
    seed: int
    target_runtime_seconds: int
    invariants: List[str]
    raw: Dict[str, object]
