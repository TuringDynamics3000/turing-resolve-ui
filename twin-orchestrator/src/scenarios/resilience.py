# twin-orchestrator/src/scenarios/resilience.py
"""
Resilience Scenario - Steady-State Under Chaos

Wraps SteadyStateScenario but injects chaos according to a ChaosPlan.

Flow:
  1. Start steady-state run in one thread
  2. In parallel, trigger chaos events (activate/deactivate)
  3. After completion, run invariants (including latency_slo + RTO under stress)

This is the core of CPS 230 operational resilience testing.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import List

from api_client import TuringCoreClient
from chaos.controller import ChaosController
from invariants.cu_invariants import run_cu_digital_invariants, CUInvariantSuiteResult
from invariants.resilience_invariants import check_rto_for_chaos_plan
from invariants.ledger_invariants import InvariantResult
from models.resilience import ChaosPlan, ChaosEvent
from models.scenario import SteadyStateScenarioConfig
from models.tenant import TenantConfig
from scenarios.steady_state import SteadyStateScenario


@dataclass
class ResilienceScenarioResult:
    """
    Result of a resilience scenario run.

    Attributes:
        tenant_id: Tenant identifier
        chaos_plan_name: Name of the chaos plan executed
        invariants_passed: Whether all invariants passed
        invariant_failures: List of invariant failure messages
        chaos_events_triggered: Number of chaos events executed
        rto_passed: Whether RTO invariant passed
        rto_details: RTO invariant details
    """
    tenant_id: str
    chaos_plan_name: str
    invariants_passed: bool
    invariant_failures: List[str]
    chaos_events_triggered: int
    rto_passed: bool
    rto_details: str


class ResilienceScenario:
    """
    Wraps SteadyStateScenario but injects chaos according to a ChaosPlan.

    This scenario:
    - Runs the full steady-state scenario (bootstrap + seed + simulate)
    - Injects chaos events in parallel according to the chaos plan
    - Validates all standard invariants (value conservation, negative balances, tenant isolation, latency SLO)
    - Validates RTO invariant (recovery time after OUTAGE events)

    This is the primary mechanism for CPS 230 operational resilience testing.
    """

    def __init__(
        self,
        client: TuringCoreClient,
        tenant_cfg: TenantConfig,
        scenario_cfg: SteadyStateScenarioConfig,
        chaos_plan: ChaosPlan,
        chaos_controller: ChaosController,
    ) -> None:
        """
        Initialize resilience scenario.

        Args:
            client: TuringCore API client (with latency recorder)
            tenant_cfg: Tenant configuration
            scenario_cfg: Steady-state scenario configuration
            chaos_plan: Chaos plan with fault injection schedule
            chaos_controller: Controller for activating/deactivating chaos
        """
        self.client = client
        self.tenant_cfg = tenant_cfg
        self.scenario_cfg = scenario_cfg
        self.chaos_plan = chaos_plan
        self.chaos_controller = chaos_controller

        self._steady_state = SteadyStateScenario(client, tenant_cfg, scenario_cfg)

    def run(self) -> ResilienceScenarioResult:
        """
        Run the resilience scenario.

        Returns:
            ResilienceScenarioResult with invariant results
        """
        print(f"\n{'='*80}")
        print(f"RESILIENCE SCENARIO: {self.chaos_plan.name}")
        print(f"Tenant: {self.tenant_cfg.tenant_code}")
        print(f"Chaos Events: {len(self.chaos_plan.events)}")
        print(f"RTO Limit: {self.chaos_plan.rto_limit_seconds}s")
        print(f"{'='*80}\n")

        # Start chaos schedule in background
        chaos_thread = threading.Thread(target=self._run_chaos_schedule, daemon=True)
        chaos_thread.start()

        # Run full steady-state scenario (bootstrap + seed + simulate + invariants)
        print("[RESILIENCE] Starting steady-state scenario under chaos...")
        steady_result = self._steady_state.run_all()

        # Allow chaos thread to finish any pending deactivations
        chaos_thread.join(timeout=5.0)

        print("\n[RESILIENCE] Steady-state scenario complete. Running invariants...")

        # Run the same CU invariants suite (includes latency_slo etc.)
        cu_result: CUInvariantSuiteResult = run_cu_digital_invariants(
            client=self.client,
            tenant_cfg=self.tenant_cfg,
            scenario_cfg=self.scenario_cfg,
        )

        # Run RTO invariant
        rto_result: InvariantResult = check_rto_for_chaos_plan(
            client=self.client,
            chaos_plan=self.chaos_plan,
            op_type="command:PostEntry",
        )

        print(f"\n[RESILIENCE] RTO Invariant: {'PASS' if rto_result.passed else 'FAIL'}")
        print(f"[RESILIENCE] Details: {rto_result.details}")

        # Aggregate failures
        all_failures = [
            f"{r.name}: {r.details}" for r in cu_result.results if not r.passed
        ]
        if not rto_result.passed:
            all_failures.append(f"rto_for_chaos_plan: {rto_result.details}")

        all_passed = cu_result.passed and rto_result.passed

        print(f"\n{'='*80}")
        print(f"RESILIENCE SCENARIO RESULT: {'PASS' if all_passed else 'FAIL'}")
        print(f"{'='*80}\n")

        return ResilienceScenarioResult(
            tenant_id=self.tenant_cfg.tenant_code,
            chaos_plan_name=self.chaos_plan.name,
            invariants_passed=all_passed,
            invariant_failures=all_failures,
            chaos_events_triggered=len(self.chaos_plan.events),
            rto_passed=rto_result.passed,
            rto_details=rto_result.details,
        )

    def _run_chaos_schedule(self) -> None:
        """
        Simple scheduler: sleep until each event, activate for duration, then deactivate.

        In production, you'd want more robust orchestration (e.g., using APScheduler
        or a dedicated chaos orchestrator). For v0.1, this is sufficient.
        """
        start = time.time()
        for event in sorted(self.chaos_plan.events, key=lambda e: e.time_offset_seconds):
            now = time.time()
            delay = event.time_offset_seconds - (now - start)
            if delay > 0:
                print(f"[CHAOS] Waiting {delay:.1f}s until {event.name}...")
                time.sleep(delay)

            # Activate chaos
            print(f"[CHAOS] Activating: {event.name} ({event.target}/{event.action})")
            self.chaos_controller.activate(event)

            if event.duration_seconds > 0:
                print(f"[CHAOS] {event.name} active for {event.duration_seconds}s...")
                time.sleep(event.duration_seconds)
                print(f"[CHAOS] Deactivating: {event.name}")
                self.chaos_controller.deactivate(event)
