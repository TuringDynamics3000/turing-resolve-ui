# twin-orchestrator/src/chaos/controller.py
"""
Chaos Controller Interface

Abstract interface for fault injection. Concrete implementations can use:
- AWS APIs (stop RDS instance, MSK broker)
- Kubernetes API (scale deployment to 0)
- Local docker-compose (docker stop ...)
- A sidecar 'chaos-agent' HTTP API
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from models.resilience import ChaosEvent


class ChaosController(ABC):
    """
    Abstract interface for chaos engineering fault injection.

    Implementations should be idempotent and safe to retry.
    """

    @abstractmethod
    def activate(self, event: ChaosEvent) -> None:
        """
        Activate a chaos event (inject fault).

        Args:
            event: Chaos event to activate
        """
        ...

    @abstractmethod
    def deactivate(self, event: ChaosEvent) -> None:
        """
        Deactivate a chaos event (remove fault).

        Args:
            event: Chaos event to deactivate
        """
        ...


class NoopChaosController(ChaosController):
    """
    No-op chaos controller for local/CI runs.

    Exercises the timing and invariants without actually killing anything.
    Useful for:
    - Local development
    - CI pipelines without real infrastructure
    - Testing chaos orchestration logic
    """

    def activate(self, event: ChaosEvent) -> None:
        """Print activation message without actually injecting fault."""
        print(f"[NOOP-CHAOS] Would activate: {event.name} ({event.target}/{event.action})")

    def deactivate(self, event: ChaosEvent) -> None:
        """Print deactivation message without actually removing fault."""
        print(f"[NOOP-CHAOS] Would deactivate: {event.name}")
