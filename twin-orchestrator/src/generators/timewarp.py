"""
Time-Warp Clock

Simple "simulation clock" that maps N simulated days to T seconds of wall time.

This allows us to simulate 30 days of activity in a few minutes of real time,
while still maintaining realistic timing for rate limiting and throttling.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


@dataclass
class TimeWarpClock:
    """
    Simple "simulation clock": N simulated days in T seconds of wall time.
    
    Example:
        clock = TimeWarpClock(simulation_days=30, target_runtime_seconds=900)
        clock.start()
        
        for day in range(30):
            sim_date = clock.simulated_datetime_for_day(day)
            # ... process transactions for this day ...
            clock.maybe_sleep_between_batches(day)
    """
    
    simulation_days: int
    target_runtime_seconds: int

    def start(self) -> None:
        """
        Start the simulation clock.
        
        Records the wall time and simulated time at the start of the simulation.
        """
        self._start_wall = time.time()
        self._start_sim = datetime.now(timezone.utc)

    def simulated_datetime_for_day(self, day_index: int) -> datetime:
        """
        Returns the simulated datetime at the start of a given day index.
        
        Args:
            day_index: Day index (0 to simulation_days-1)
            
        Returns:
            Simulated datetime for the start of this day
            
        Example:
            If simulation starts at 2025-01-01 00:00:00 UTC,
            then day_index=0 returns 2025-01-01 00:00:00 UTC,
            day_index=1 returns 2025-01-02 00:00:00 UTC, etc.
        """
        return self._start_sim + timedelta(days=day_index)

    def maybe_sleep_between_batches(self, completed_days: int) -> None:
        """
        Optionally throttle to keep close to target_runtime_seconds overall.
        
        This implements simple linear throttling: if we're ahead of schedule,
        sleep to catch up to the target pace.
        
        Args:
            completed_days: Number of days completed so far
            
        Implementation:
        - Calculate target wall time for this point in simulation:
          target_wall_time = start_wall + (completed_days / simulation_days) * target_runtime_seconds
        - Calculate actual wall time: time.time()
        - If actual < target, sleep for (target - actual) seconds
        - Otherwise, continue without sleeping (we're behind schedule)
        """
        # TODO: implement smoothing/throttling if needed
        # For now, no throttling (run as fast as possible)
        return
