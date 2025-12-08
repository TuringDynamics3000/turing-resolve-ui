# twin-orchestrator/src/metrics/latency_recorder.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List


@dataclass
class LatencyStats:
    """Statistics for a single operation type."""
    count: int
    avg: float      # seconds
    p95: float      # seconds
    p99: float      # seconds


class LatencyRecorder:
    """
    In-memory latency collector for CU-Digital twin runs.

    Stores durations per `op_type` (e.g. "command:PostEntry", "read:get_account").
    """

    def __init__(self) -> None:
        self._samples: Dict[str, List[float]] = {}

    def record(self, op_type: str, duration_seconds: float) -> None:
        """Record a single latency sample for the given operation type."""
        if duration_seconds < 0:
            return
        self._samples.setdefault(op_type, []).append(duration_seconds)

    def get_stats(self) -> Dict[str, LatencyStats]:
        """
        Compute basic stats for each op_type.
        
        Returns:
            Dictionary mapping op_type to LatencyStats
        """
        stats: Dict[str, LatencyStats] = {}
        for op_type, samples in self._samples.items():
            if not samples:
                continue
            samples_sorted = sorted(samples)
            count = len(samples_sorted)
            avg = sum(samples_sorted) / count

            def pct(p: float) -> float:
                if count == 1:
                    return samples_sorted[0]
                # nearest-rank percentile
                idx = int(round(p * (count - 1)))
                if idx < 0:
                    idx = 0
                if idx >= count:
                    idx = count - 1
                return samples_sorted[idx]

            p95 = pct(0.95)
            p99 = pct(0.99)

            stats[op_type] = LatencyStats(
                count=count,
                avg=avg,
                p95=p95,
                p99=p99,
            )

        return stats
