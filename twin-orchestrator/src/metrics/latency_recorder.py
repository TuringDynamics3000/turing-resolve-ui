# twin-orchestrator/src/metrics/latency_recorder.py
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class LatencyStats:
    """Statistics for a single operation type."""
    count: int
    avg: float      # seconds
    p95: float      # seconds
    p99: float      # seconds


@dataclass
class OperationSample:
    """
    A single recorded operation with full context for RTO analysis.
    
    Attributes:
        op_type: Operation type (e.g., "command:PostEntry")
        timestamp: Seconds since recorder start
        duration: Operation duration in seconds
        success: Whether the operation succeeded
        status_code: HTTP status code (0 if not applicable)
    """
    op_type: str
    timestamp: float        # seconds since recorder_start
    duration: float         # seconds
    success: bool
    status_code: int


class LatencyRecorder:
    """
    In-memory latency + outcome collector for CU-Digital twin runs.

    Stores:
    - _samples_by_op: per-op_type array of durations (for p95/p99 stats)
    - _ops: full timeline of samples for RTO-style invariants

    The recorder starts its clock on __init__, so all timestamps are
    relative to recorder creation time.
    """

    def __init__(self) -> None:
        self._t0: float = time.time()
        self._samples_by_op: Dict[str, List[float]] = {}
        self._ops: List[OperationSample] = []

    def record(
        self,
        op_type: str,
        duration_seconds: float,
        *,
        success: bool = True,
        status_code: int = 0,
        timestamp: Optional[float] = None,
    ) -> None:
        """
        Record a single operation sample.
        
        Args:
            op_type: Operation type identifier
            duration_seconds: Duration of the operation
            success: Whether the operation succeeded
            status_code: HTTP status code (0 if not applicable)
            timestamp: Explicit timestamp (seconds since recorder start), or None to use current time
        """
        if duration_seconds < 0:
            return
        if timestamp is None:
            # Normalize to "since start"
            timestamp = time.time() - self._t0

        self._samples_by_op.setdefault(op_type, []).append(duration_seconds)

        self._ops.append(
            OperationSample(
                op_type=op_type,
                timestamp=timestamp,
                duration=duration_seconds,
                success=success,
                status_code=status_code,
            )
        )

    def get_stats(self) -> Dict[str, LatencyStats]:
        """
        Compute basic stats for each op_type.
        
        Returns:
            Dictionary mapping op_type to LatencyStats
        """
        stats: Dict[str, LatencyStats] = {}
        for op_type, samples in self._samples_by_op.items():
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

    def get_operation_samples(self, op_type: Optional[str] = None) -> List[OperationSample]:
        """
        Return all recorded samples, optionally filtered by op_type.
        
        This is used by RTO invariants to analyze recovery timing after chaos events.
        
        Args:
            op_type: Optional filter for specific operation type
            
        Returns:
            List of OperationSample objects
        """
        if op_type is None:
            return list(self._ops)
        return [op for op in self._ops if op.op_type == op_type]
