# twin-orchestrator/src/config/chaos_config.py
"""
Chaos Plan Configuration Loader

Loads chaos plans from YAML configuration files.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

import yaml

from models.resilience import ChaosPlan, ChaosEvent


def load_chaos_plan(path: str | Path) -> ChaosPlan:
    """
    Load a chaos plan from YAML configuration.

    Args:
        path: Path to chaos plan YAML file

    Returns:
        ChaosPlan object

    Example YAML:
        chaos:
          name: "MSK_OUTAGE_5MIN"
          maxRuntimeSeconds: 1200
          rtoLimitSeconds: 60
          events:
            - name: "MSK_OUTAGE"
              target: "KAFKA"
              action: "OUTAGE"
              timeOffsetSeconds: 300
              durationSeconds: 300
              params: {}
    """
    path = Path(path)
    data: Dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    chaos_raw = data.get("chaos", {})

    events_raw = chaos_raw.get("events", [])
    events: List[ChaosEvent] = []
    for e in events_raw:
        events.append(
            ChaosEvent(
                name=str(e["name"]),
                target=str(e["target"]),
                action=str(e["action"]),
                time_offset_seconds=int(e["timeOffsetSeconds"]),
                duration_seconds=int(e.get("durationSeconds", 0)),
                params=e.get("params", {}) or {},
            )
        )

    return ChaosPlan(
        name=str(chaos_raw.get("name", "UNNAMED_CHAOS_PLAN")),
        events=events,
        max_runtime_seconds=int(chaos_raw.get("maxRuntimeSeconds", 1200)),
        rto_limit_seconds=int(chaos_raw.get("rtoLimitSeconds", 60)),
        raw=data,
    )
