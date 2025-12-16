# twin-orchestrator/src/models/resilience.py
"""
Chaos Engineering Data Models

Defines chaos events, plans, and resilience scenarios for CPS 230 compliance testing.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Literal


ChaosTarget = Literal[
    "KAFKA",
    "DB_PRIMARY",
    "REDIS",
    "API_NODE",
    "INTERNAL_LEDGER_SERVICE",
]

ChaosAction = Literal[
    "OUTAGE",
    "LATENCY_SPIKE",
    "PARTIAL_FAILURE",
    "THROTTLING",
]


@dataclass
class ChaosEvent:
    """
    A single fault injection to be triggered during the scenario.

    Attributes:
        name: Human-readable name for this chaos event
        target: Infrastructure component to target
        action: Type of fault to inject
        time_offset_seconds: Seconds from scenario start to trigger
        duration_seconds: How long the fault should persist
        params: Additional parameters for the chaos action
    """
    name: str
    target: ChaosTarget
    action: ChaosAction
    time_offset_seconds: int
    duration_seconds: int
    params: Dict[str, object]


@dataclass
class ChaosPlan:
    """
    Full chaos schedule for a resilience run.

    Attributes:
        name: Human-readable name for this chaos plan
        events: List of chaos events to execute
        max_runtime_seconds: Expected total runtime (wall-clock)
        rto_limit_seconds: Recovery Time Objective limit for OUTAGE events
        raw: Raw YAML data for extensibility
    """
    name: str
    events: List[ChaosEvent]
    max_runtime_seconds: int
    rto_limit_seconds: int
    raw: Dict[str, object]
