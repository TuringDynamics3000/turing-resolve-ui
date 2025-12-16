"""
Shadow Migration Prometheus Metrics Exporter

Exports shadow pipeline metrics for Grafana/Prometheus monitoring.
Powers the Executive Shadow Dashboard with real-time cutover readiness data.

Usage:
    from observability.shadow_metrics import ShadowMetrics
    
    metrics = ShadowMetrics()
    metrics.record_shadow_run(tenant_id, results)
    metrics.export_to_pushgateway()
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Any, Optional
import os


@dataclass
class ShadowRunResults:
    """Results from a shadow migration run."""
    tenant_id: str
    date: str
    status: str  # GREEN, AMBER, RED
    transaction_delta: int
    balance_mismatches: int
    gl_delta: float
    interest_delta: float
    product_invariants_passed: bool
    ledger_invariants_passed: bool
    cps230_integrity: bool
    cps230_rto_hours: float
    consecutive_green_days: int
    cutover_score: int


class ShadowMetrics:
    """
    Prometheus metrics exporter for shadow migration pipeline.
    
    Emits metrics that power the Grafana Executive Shadow Dashboard.
    """
    
    def __init__(self, pushgateway_url: Optional[str] = None):
        """
        Initialize shadow metrics exporter.
        
        Args:
            pushgateway_url: Optional Prometheus Pushgateway URL
                           (defaults to PROMETHEUS_PUSHGATEWAY env var)
        """
        self.pushgateway_url = pushgateway_url or os.getenv(
            "PROMETHEUS_PUSHGATEWAY",
            "http://localhost:9091"
        )
        self.metrics: Dict[str, Any] = {}
    
    def record_shadow_run(self, results: ShadowRunResults) -> None:
        """
        Record metrics from a shadow migration run.
        
        Args:
            results: Shadow run results
        """
        tenant = results.tenant_id
        
        # Core status metrics
        self.metrics[f"shadow_status{{tenant=\"{tenant}\"}}"] = (
            1 if results.status == "GREEN" else 0
        )
        
        # Transaction mirroring
        self.metrics[f"shadow_transaction_delta{{tenant=\"{tenant}\"}}"] = (
            results.transaction_delta
        )
        
        # Balance reconciliation
        self.metrics[f"shadow_balance_mismatches{{tenant=\"{tenant}\"}}"] = (
            results.balance_mismatches
        )
        
        # GL reconciliation
        self.metrics[f"shadow_gl_delta{{tenant=\"{tenant}\"}}"] = (
            results.gl_delta
        )
        
        # Interest & fees
        self.metrics[f"shadow_interest_delta{{tenant=\"{tenant}\"}}"] = (
            results.interest_delta
        )
        
        # Product invariants
        self.metrics[f"shadow_product_invariant_pass{{tenant=\"{tenant}\"}}"] = (
            1 if results.product_invariants_passed else 0
        )
        
        # Ledger invariants
        self.metrics[f"shadow_ledger_invariant_pass{{tenant=\"{tenant}\"}}"] = (
            1 if results.ledger_invariants_passed else 0
        )
        
        # CPS-230 compliance
        self.metrics[f"shadow_cps230_integrity{{tenant=\"{tenant}\"}}"] = (
            1 if results.cps230_integrity else 0
        )
        self.metrics[f"shadow_cps230_rto_hours{{tenant=\"{tenant}\"}}"] = (
            results.cps230_rto_hours
        )
        
        # Cutover readiness
        self.metrics[f"shadow_consecutive_green_days{{tenant=\"{tenant}\"}}"] = (
            results.consecutive_green_days
        )
        self.metrics[f"shadow_cutover_score{{tenant=\"{tenant}\"}}"] = (
            results.cutover_score
        )
        
        # Cutover gate conditions
        self._record_cutover_gates(tenant, results)
    
    def _record_cutover_gates(
        self,
        tenant: str,
        results: ShadowRunResults
    ) -> None:
        """Record individual cutover gate conditions."""
        # 30 consecutive GREEN days
        self.metrics[f"shadow_cutover_gate_30_days{{tenant=\"{tenant}\"}}"] = (
            1 if results.consecutive_green_days >= 30 else 0
        )
        
        # Zero GL variance
        self.metrics[f"shadow_cutover_gate_gl_zero{{tenant=\"{tenant}\"}}"] = (
            1 if results.gl_delta == 0.0 else 0
        )
        
        # Zero product breaches
        self.metrics[f"shadow_cutover_gate_product_zero{{tenant=\"{tenant}\"}}"] = (
            1 if results.product_invariants_passed else 0
        )
        
        # Zero ledger breaches
        self.metrics[f"shadow_cutover_gate_ledger_zero{{tenant=\"{tenant}\"}}"] = (
            1 if results.ledger_invariants_passed else 0
        )
        
        # Change freeze (placeholder - would be set externally)
        self.metrics[f"shadow_cutover_gate_change_freeze{{tenant=\"{tenant}\"}}"] = 0
    
    def export_to_pushgateway(self, job_name: str = "shadow_migration") -> None:
        """
        Export metrics to Prometheus Pushgateway.
        
        Args:
            job_name: Prometheus job name
        """
        try:
            import requests
            
            # Format metrics in Prometheus text format
            metrics_text = self._format_prometheus_text()
            
            # Push to gateway
            url = f"{self.pushgateway_url}/metrics/job/{job_name}"
            response = requests.post(
                url,
                data=metrics_text,
                headers={"Content-Type": "text/plain"}
            )
            response.raise_for_status()
            
            print(f"✅ Metrics pushed to {url}")
        
        except ImportError:
            print("⚠️  requests library not installed, skipping pushgateway export")
        except Exception as e:
            print(f"⚠️  Failed to push metrics: {e}")
    
    def _format_prometheus_text(self) -> str:
        """Format metrics in Prometheus text exposition format."""
        lines = []
        for metric_name, value in self.metrics.items():
            lines.append(f"{metric_name} {value}")
        return "\n".join(lines) + "\n"
    
    def export_to_file(self, path: str) -> None:
        """
        Export metrics to a text file (for file-based collection).
        
        Args:
            path: Output file path
        """
        with open(path, "w") as f:
            f.write(self._format_prometheus_text())
        print(f"✅ Metrics written to {path}")
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics dictionary."""
        return self.metrics.copy()


def calculate_cutover_score(results: ShadowRunResults) -> int:
    """
    Calculate overall cutover readiness score (0-100).
    
    Args:
        results: Shadow run results
    
    Returns:
        Score from 0 (not ready) to 100 (fully ready)
    """
    score = 0
    
    # Status (20 points)
    if results.status == "GREEN":
        score += 20
    
    # Transaction delta (15 points)
    if results.transaction_delta == 0:
        score += 15
    
    # Balance mismatches (15 points)
    if results.balance_mismatches == 0:
        score += 15
    
    # GL delta (15 points)
    if results.gl_delta == 0.0:
        score += 15
    
    # Product invariants (10 points)
    if results.product_invariants_passed:
        score += 10
    
    # Ledger invariants (10 points)
    if results.ledger_invariants_passed:
        score += 10
    
    # CPS-230 compliance (10 points)
    if results.cps230_integrity:
        score += 10
    
    # Consecutive GREEN days (5 points)
    if results.consecutive_green_days >= 30:
        score += 5
    
    return score


# Example usage
if __name__ == "__main__":
    # Sample shadow run results
    results = ShadowRunResults(
        tenant_id="CU_ALPHA_SHADOW",
        date="2025-12-08",
        status="GREEN",
        transaction_delta=0,
        balance_mismatches=0,
        gl_delta=0.0,
        interest_delta=0.0,
        product_invariants_passed=True,
        ledger_invariants_passed=True,
        cps230_integrity=True,
        cps230_rto_hours=2.0,
        consecutive_green_days=15,
        cutover_score=94
    )
    
    # Export metrics
    metrics = ShadowMetrics()
    metrics.record_shadow_run(results)
    
    # Option 1: Push to Prometheus Pushgateway
    # metrics.export_to_pushgateway()
    
    # Option 2: Export to file for node_exporter textfile collector
    metrics.export_to_file("/tmp/shadow_metrics.prom")
    
    # Print metrics
    print("\nRecorded metrics:")
    for name, value in metrics.get_metrics().items():
        print(f"  {name} = {value}")
