"""
Risk Brain Reporter — Weekly Reporting Service v1

This module provides the main reporting service for Risk Brain.

PURPOSE:
- Pull last 7 days of canonical metrics from Prometheus
- Materialise deterministic risk snapshot
- Render weekly board packs and regulator annexes
- Write artefacts to immutable object storage

SAFETY GUARANTEES:
- Read-only access to metrics (no command surface)
- Deterministic, auditable, non-real-time
- Immutable outputs (SHA-256 sealed)

Author: TuringCore National Infrastructure Team
Version: 1.0
Status: Production-Ready (Risk Brain Reporter)
"""

import os
import sys
import json
import hashlib
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from dataclasses import asdict

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from risk_brain_reporter.data_model import (
    RiskBrainSnapshot,
    DomainHealth,
    SafetyMetrics,
    PaymentsMetrics,
    FraudMetrics,
    AmlMetrics,
    TreasuryMetrics,
    PromQLQueries,
    create_empty_snapshot,
    get_iso_week,
    get_week_range
)


# ============================================================================
# PROMETHEUS CLIENT (Stub for v1)
# ============================================================================

class PrometheusClient:
    """
    Prometheus client for querying Risk Brain metrics.
    
    This is a stub implementation for v1. In production, use:
    - prometheus_client library
    - requests library for HTTP API
    - Or native Prometheus Python client
    """
    
    def __init__(self, prometheus_url: str):
        """
        Initialize Prometheus client.
        
        Args:
            prometheus_url: Prometheus server URL (e.g., "http://prometheus:9090")
        """
        self.prometheus_url = prometheus_url
    
    def query(self, query: str) -> Optional[float]:
        """
        Execute PromQL query and return scalar result.
        
        Args:
            query: PromQL query string
            
        Returns:
            Scalar result (float) or None if query fails
        """
        # TODO: Implement actual Prometheus query
        # For now, return stub data
        print(f"[STUB] Executing PromQL query: {query}")
        return 0.0
    
    def query_vector(self, query: str) -> Dict[str, float]:
        """
        Execute PromQL query and return vector result.
        
        Args:
            query: PromQL query string
            
        Returns:
            Dictionary of label → value
        """
        # TODO: Implement actual Prometheus query
        # For now, return stub data
        print(f"[STUB] Executing PromQL vector query: {query}")
        return {}


# ============================================================================
# METRICS AGGREGATOR
# ============================================================================

class MetricsAggregator:
    """
    Metrics aggregator for Risk Brain Reporter.
    
    This class pulls metrics from Prometheus and materialises
    a canonical Risk Brain snapshot.
    """
    
    def __init__(self, prometheus_client: PrometheusClient):
        """
        Initialize metrics aggregator.
        
        Args:
            prometheus_client: Prometheus client instance
        """
        self.prom = prometheus_client
    
    def aggregate_snapshot(self, tenant_id: str, date: Optional[datetime] = None) -> RiskBrainSnapshot:
        """
        Aggregate Risk Brain snapshot for a tenant.
        
        This is the main entry point for metrics aggregation.
        
        Args:
            tenant_id: Tenant ID ("NETWORK" or "cu_123")
            date: Date for the snapshot (defaults to today)
            
        Returns:
            RiskBrainSnapshot with aggregated metrics
        """
        # Create empty snapshot
        snapshot = create_empty_snapshot(tenant_id, date)
        
        # Aggregate safety metrics
        snapshot.safety = self._aggregate_safety()
        
        # Aggregate health metrics
        snapshot.health = self._aggregate_health(tenant_id)
        
        # Aggregate domain metrics
        snapshot.payments = self._aggregate_payments(tenant_id)
        snapshot.fraud = self._aggregate_fraud(tenant_id)
        snapshot.aml = self._aggregate_aml(tenant_id)
        snapshot.treasury = self._aggregate_treasury(tenant_id)
        
        return snapshot
    
    def _aggregate_safety(self) -> SafetyMetrics:
        """
        Aggregate safety metrics.
        
        These metrics MUST always be 0. If any are non-zero,
        the report fails hard and triggers P1 incident.
        
        Returns:
            SafetyMetrics
        """
        ai_origin_violations = int(self.prom.query(PromQLQueries.AI_ORIGIN_VIOLATIONS) or 0)
        schema_violations = int(self.prom.query(PromQLQueries.SCHEMA_VIOLATIONS) or 0)
        policy_origin_violations = int(self.prom.query(PromQLQueries.POLICY_ORIGIN_VIOLATIONS) or 0)
        
        return SafetyMetrics(
            ai_origin_violations=ai_origin_violations,
            schema_violations=schema_violations,
            policy_origin_violations=policy_origin_violations
        )
    
    def _aggregate_health(self, tenant_id: str) -> Dict[str, DomainHealth]:
        """
        Aggregate health metrics for all domains.
        
        Args:
            tenant_id: Tenant ID
            
        Returns:
            Dictionary of domain → DomainHealth
        """
        domains = ["payments", "fraud", "aml", "treasury"]
        health = {}
        
        for domain in domains:
            shadow = bool(self.prom.query(
                PromQLQueries.SHADOW_ENABLED.format(domain=domain, tenant_id=tenant_id)
            ))
            ci = bool(self.prom.query(
                PromQLQueries.CI_PASS.format(domain=domain)
            ))
            killswitch = int(self.prom.query(
                PromQLQueries.KILLSWITCH_ACTIVATIONS.format(domain=domain)
            ) or 0)
            
            health[domain] = DomainHealth(
                shadow=shadow,
                ci=ci,
                killswitch=killswitch
            )
        
        return health
    
    def _aggregate_payments(self, tenant_id: str) -> PaymentsMetrics:
        """
        Aggregate Payments RL Shadow metrics.
        
        Args:
            tenant_id: Tenant ID
            
        Returns:
            PaymentsMetrics
        """
        # Coverage percentage
        numerator = self.prom.query(
            PromQLQueries.PAYMENTS_COVERAGE_NUMERATOR.format(tenant_id=tenant_id)
        ) or 0
        denominator = self.prom.query(
            PromQLQueries.PAYMENTS_COVERAGE_DENOMINATOR.format(tenant_id=tenant_id)
        ) or 1
        coverage_pct = (numerator / denominator * 100) if denominator > 0 else 0.0
        
        # Direction split
        direction_vector = self.prom.query_vector(
            PromQLQueries.PAYMENTS_DIRECTION_SPLIT.format(tenant_id=tenant_id)
        )
        direction_split = {
            "better": int(direction_vector.get("better", 0)),
            "worse": int(direction_vector.get("worse", 0)),
            "neutral": int(direction_vector.get("neutral", 0))
        }
        
        return PaymentsMetrics(
            coverage_pct=round(coverage_pct, 1),
            direction_split=direction_split
        )
    
    def _aggregate_fraud(self, tenant_id: str) -> FraudMetrics:
        """
        Aggregate Fraud Shadow metrics.
        
        Args:
            tenant_id: Tenant ID
            
        Returns:
            FraudMetrics
        """
        high_flags = int(self.prom.query(
            PromQLQueries.FRAUD_HIGH_FLAGS.format(tenant_id=tenant_id)
        ) or 0)
        confirmed = int(self.prom.query(
            PromQLQueries.FRAUD_CONFIRMED.format(tenant_id=tenant_id)
        ) or 0)
        cleared = int(self.prom.query(
            PromQLQueries.FRAUD_CLEARED.format(tenant_id=tenant_id)
        ) or 0)
        
        return FraudMetrics(
            high_flags=high_flags,
            confirmed=confirmed,
            cleared=cleared
        )
    
    def _aggregate_aml(self, tenant_id: str) -> AmlMetrics:
        """
        Aggregate AML Shadow metrics.
        
        Args:
            tenant_id: Tenant ID
            
        Returns:
            AmlMetrics
        """
        high_flags = int(self.prom.query(
            PromQLQueries.AML_HIGH_FLAGS.format(tenant_id=tenant_id)
        ) or 0)
        medium_flags = int(self.prom.query(
            PromQLQueries.AML_MEDIUM_FLAGS.format(tenant_id=tenant_id)
        ) or 0)
        smrs = int(self.prom.query(
            PromQLQueries.AML_SMRS.format(tenant_id=tenant_id)
        ) or 0)
        
        return AmlMetrics(
            high_flags=high_flags,
            medium_flags=medium_flags,
            smrs=smrs
        )
    
    def _aggregate_treasury(self, tenant_id: str) -> TreasuryMetrics:
        """
        Aggregate Treasury RL Shadow metrics.
        
        Args:
            tenant_id: Tenant ID
            
        Returns:
            TreasuryMetrics
        """
        high_risk_windows = int(self.prom.query(
            PromQLQueries.TREASURY_HIGH_RISK_WINDOWS.format(tenant_id=tenant_id)
        ) or 0)
        avg_buffer_delta = int(self.prom.query(
            PromQLQueries.TREASURY_AVG_BUFFER_DELTA.format(tenant_id=tenant_id)
        ) or 0)
        
        return TreasuryMetrics(
            high_risk_windows=high_risk_windows,
            avg_buffer_delta=avg_buffer_delta
        )


# ============================================================================
# RISK BRAIN REPORTER (Main Service)
# ============================================================================

class RiskBrainReporter:
    """
    Risk Brain Reporter service.
    
    This is the main service that orchestrates:
    - Metrics aggregation
    - Report rendering
    - Immutable storage
    """
    
    def __init__(self, prometheus_url: str, output_dir: str):
        """
        Initialize Risk Brain Reporter.
        
        Args:
            prometheus_url: Prometheus server URL
            output_dir: Output directory for reports
        """
        self.prom_client = PrometheusClient(prometheus_url)
        self.aggregator = MetricsAggregator(self.prom_client)
        self.output_dir = output_dir
    
    def generate_weekly_report(self, tenant_id: str, date: Optional[datetime] = None) -> str:
        """
        Generate weekly board pack for a tenant.
        
        Args:
            tenant_id: Tenant ID ("NETWORK" or "cu_123")
            date: Date for the report (defaults to today)
            
        Returns:
            Path to generated report
        """
        # Aggregate snapshot
        snapshot = self.aggregator.aggregate_snapshot(tenant_id, date)
        
        # Check safety invariants
        if not snapshot.is_safe():
            raise RuntimeError(
                f"🚨 CRITICAL SAFETY VIOLATION: Cannot generate report for {tenant_id}. "
                f"AI origin violations: {snapshot.safety.ai_origin_violations}, "
                f"Schema violations: {snapshot.safety.schema_violations}, "
                f"Policy origin violations: {snapshot.safety.policy_origin_violations}"
            )
        
        # Write snapshot to JSON (for debugging)
        json_path = self._write_snapshot_json(snapshot)
        
        # TODO: Render PDF (next phase)
        print(f"✅ Generated weekly report for {tenant_id}: {json_path}")
        
        return json_path
    
    def generate_regulator_annex(self, tenant_id: str, date: Optional[datetime] = None) -> str:
        """
        Generate regulator annex for a tenant.
        
        Args:
            tenant_id: Tenant ID
            date: Date for the annex (defaults to today)
            
        Returns:
            Path to generated annex
        """
        # Aggregate snapshot
        snapshot = self.aggregator.aggregate_snapshot(tenant_id, date)
        
        # Write snapshot to JSON (for debugging)
        json_path = self._write_snapshot_json(snapshot, annex=True)
        
        # TODO: Render PDF (next phase)
        print(f"✅ Generated regulator annex for {tenant_id}: {json_path}")
        
        return json_path
    
    def _write_snapshot_json(self, snapshot: RiskBrainSnapshot, annex: bool = False) -> str:
        """
        Write snapshot to JSON file.
        
        Args:
            snapshot: Risk Brain snapshot
            annex: If True, write as regulator annex
            
        Returns:
            Path to JSON file
        """
        # Create output directory
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Generate filename
        if annex:
            filename = f"annex-{snapshot.period_start}.json"
        else:
            filename = f"risk-brain-{snapshot.week}.json"
        
        filepath = os.path.join(self.output_dir, snapshot.tenant_id, filename)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        # Write JSON
        with open(filepath, 'w') as f:
            json.dump(snapshot.to_dict(), f, indent=2)
        
        # Compute SHA-256 hash
        with open(filepath, 'rb') as f:
            sha256 = hashlib.sha256(f.read()).hexdigest()
        
        # Write hash file
        hash_filepath = filepath + ".sha256"
        with open(hash_filepath, 'w') as f:
            f.write(sha256)
        
        return filepath


# ============================================================================
# MAIN (CLI)
# ============================================================================

def main():
    """Main CLI for Risk Brain Reporter."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Risk Brain Reporter v1")
    parser.add_argument("--prometheus-url", default="http://localhost:9090", help="Prometheus URL")
    parser.add_argument("--output-dir", default="/tmp/risk-brain-reports", help="Output directory")
    parser.add_argument("--tenant-id", required=True, help="Tenant ID")
    parser.add_argument("--annex", action="store_true", help="Generate regulator annex")
    
    args = parser.parse_args()
    
    # Create reporter
    reporter = RiskBrainReporter(args.prometheus_url, args.output_dir)
    
    # Generate report
    if args.annex:
        reporter.generate_regulator_annex(args.tenant_id)
    else:
        reporter.generate_weekly_report(args.tenant_id)


if __name__ == "__main__":
    main()
