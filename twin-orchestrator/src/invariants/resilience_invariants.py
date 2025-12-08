# twin-orchestrator/src/invariants/resilience_invariants.py
"""
Resilience-Specific Invariants

Invariants for chaos engineering and CPS 230 operational resilience testing.
"""

from __future__ import annotations

from typing import List, Optional

from api_client import TuringCoreClient
from invariants.ledger_invariants import InvariantResult
from metrics.latency_recorder import LatencyRecorder, OperationSample
from models.resilience import ChaosPlan, ChaosEvent


def check_rto_for_chaos_plan(
    client: TuringCoreClient,
    chaos_plan: ChaosPlan,
    op_type: str = "command:PostEntry",
) -> InvariantResult:
    """
    Invariant: For every OUTAGE chaos event, the system resumes successful operations
    within the configured RTO (Recovery Time Objective) limit.

    Definition:
        For each ChaosEvent where action == "OUTAGE":
          - Let outage_start = timeOffsetSeconds
          - Let outage_end   = timeOffsetSeconds + durationSeconds
          - Let rto_limit    = chaos_plan.rto_limit_seconds

          RTO_event = time of first SUCCESSFUL op_type sample with timestamp >= outage_end
                      minus outage_start.

          Assert RTO_event <= rto_limit.

    This is a **critical operational resilience invariant** that proves:
    - The platform can recover from infrastructure failures
    - Recovery time is predictable and bounded
    - RTO commitments to regulators (APRA CPS 230) are met

    Args:
        client: TuringCore API client with attached latency recorder
        chaos_plan: Chaos plan with OUTAGE events
        op_type: Operation type to measure (default: "command:PostEntry")

    Returns:
        InvariantResult with pass/fail status and details

    Notes:
        - Timestamps are "seconds since LatencyRecorder start"
        - Recorder must be created right before scenario run
        - RTO is measured from outage_start (not outage_end)
    """
    recorder: LatencyRecorder | None = getattr(client, "latency_recorder", None)
    if recorder is None:
        return InvariantResult(
            name="rto_for_chaos_plan",
            passed=False,
            details="No latency recorder attached to client.",
        )

    samples: List[OperationSample] = recorder.get_operation_samples(op_type)
    if not samples:
        return InvariantResult(
            name="rto_for_chaos_plan",
            passed=False,
            details=f"No samples recorded for op_type={op_type}.",
        )

    # Filter to OUTAGE events only
    outage_events: List[ChaosEvent] = [
        e for e in chaos_plan.events if e.action == "OUTAGE"
    ]
    if not outage_events:
        return InvariantResult(
            name="rto_for_chaos_plan",
            passed=True,
            details="No OUTAGE events in chaos plan; RTO invariant vacuously satisfied.",
        )

    failures: List[str] = []

    # Ensure samples sorted by timestamp
    samples_sorted = sorted(samples, key=lambda s: s.timestamp)

    for event in outage_events:
        outage_start = float(event.time_offset_seconds)
        outage_end = float(event.time_offset_seconds + event.duration_seconds)
        rto_limit = float(chaos_plan.rto_limit_seconds)

        # Find first successful sample after outage_end
        first_success: OperationSample | None = None
        for s in samples_sorted:
            if s.timestamp >= outage_end and s.success:
                first_success = s
                break

        if first_success is None:
            failures.append(
                f"{event.name}: no successful {op_type} after outage_end={outage_end:.1f}s"
            )
            continue

        # Measure RTO from outage_start (total recovery time including outage duration)
        rto = first_success.timestamp - outage_start

        if rto > rto_limit:
            failures.append(
                f"{event.name}: RTO={rto:.1f}s > limit={rto_limit:.1f}s "
                f"(outage_start={outage_start:.1f}s, outage_end={outage_end:.1f}s, "
                f"first_success_at={first_success.timestamp:.1f}s)"
            )

    if failures:
        return InvariantResult(
            name="rto_for_chaos_plan",
            passed=False,
            details="; ".join(failures[:3]),  # Cap detail length
        )

    return InvariantResult(
        name="rto_for_chaos_plan",
        passed=True,
        details=f"All OUTAGE events met RTO limit of {chaos_plan.rto_limit_seconds}s for {op_type}.",
    )
