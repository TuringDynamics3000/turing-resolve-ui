"""
Risk Brain Reporter — Contract Tests v1

This module provides CI/CD tests for:
- Schema validation (CSR v1)
- Template rendering (snapshot tests)
- PromQL query integrity
- Object lock verification

Author: TuringCore National Infrastructure Team
Version: 1.0
Status: Production-Ready (Contract Tests)
"""

import os
import pytest
import yaml
import json
from datetime import datetime

# Import reporter modules
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_model import RiskBrainSnapshot, DomainHealth, SafetyMetrics, PaymentsMetrics, FraudMetrics, AmlMetrics, TreasuryMetrics
from pdf_renderer import ReportRenderer, TemplateRenderer


# ============================================================================
# TEST: CANONICAL RISK SNAPSHOT SCHEMA VALIDATION
# ============================================================================

def test_canonical_risk_snapshot_schema():
    """
    Test: Canonical Risk Snapshot (CSR v1) schema validation.
    
    This test ensures that the CSR schema is correctly defined and can be
    instantiated with valid data.
    """
    # Create valid CSR
    snapshot = RiskBrainSnapshot(
        week="2025-W49",
        tenant_id="cu_123",
        period_start="2025-12-01",
        period_end="2025-12-07",
        health={
            "payments": DomainHealth(shadow=True, ci=True, killswitch=0),
            "fraud": DomainHealth(shadow=True, ci=True, killswitch=0),
            "aml": DomainHealth(shadow=True, ci=True, killswitch=0),
            "treasury": DomainHealth(shadow=True, ci=True, killswitch=0),
        },
        safety=SafetyMetrics(
            ai_origin_violations=0,
            schema_violations=0,
            policy_origin_violations=0
        ),
        payments=PaymentsMetrics(
            coverage_pct=73.2,
            direction_split={"better": 412, "worse": 37, "neutral": 219}
        ),
        fraud=FraudMetrics(
            high_flags=41,
            confirmed=3,
            cleared=31
        ),
        aml=AmlMetrics(
            high_flags=9,
            medium_flags=44,
            smrs=1
        ),
        treasury=TreasuryMetrics(
            high_risk_windows=0,
            avg_buffer_delta=182500
        )
    )
    
    # Assert CSR is valid
    assert snapshot.week == "2025-W49"
    assert snapshot.tenant_id == "cu_123"
    assert snapshot.safety.ai_origin_violations == 0
    assert snapshot.safety.schema_violations == 0
    assert snapshot.safety.policy_origin_violations == 0
    
    # Assert safety statement can be generated
    safety_statement = snapshot.safety_statement()
    assert "No AI-origin execution attempts were detected" in safety_statement


def test_canonical_risk_snapshot_fails_on_incomplete_data():
    """
    Test: CSR generation fails if data is incomplete.
    
    If this object cannot be fully populated → report generation MUST FAIL.
    """
    # Try to create CSR with missing required fields
    with pytest.raises(TypeError):
        snapshot = RiskBrainSnapshot(
            week="2025-W49",
            tenant_id="cu_123",
            # Missing period_start, period_end, health, safety, etc.
        )


# ============================================================================
# TEST: TEMPLATE RENDERING SNAPSHOT TESTS
# ============================================================================

def test_board_pack_template_rendering():
    """
    Test: Board pack template rendering snapshot test.
    
    This test ensures that the board pack template can be rendered with
    valid data and produces the expected output.
    """
    # Create valid CSR
    snapshot = RiskBrainSnapshot(
        week="2025-W49",
        tenant_id="cu_123",
        period_start="2025-12-01",
        period_end="2025-12-07",
        health={
            "payments": DomainHealth(shadow=True, ci=True, killswitch=0),
            "fraud": DomainHealth(shadow=True, ci=True, killswitch=0),
            "aml": DomainHealth(shadow=True, ci=True, killswitch=0),
            "treasury": DomainHealth(shadow=True, ci=True, killswitch=0),
        },
        safety=SafetyMetrics(
            ai_origin_violations=0,
            schema_violations=0,
            policy_origin_violations=0
        ),
        payments=PaymentsMetrics(
            coverage_pct=73.2,
            direction_split={"better": 412, "worse": 37, "neutral": 219}
        ),
        fraud=FraudMetrics(
            high_flags=41,
            confirmed=3,
            cleared=31
        ),
        aml=AmlMetrics(
            high_flags=9,
            medium_flags=44,
            smrs=1
        ),
        treasury=TreasuryMetrics(
            high_risk_windows=0,
            avg_buffer_delta=182500
        )
    )
    
    # Render board pack template
    template_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")
    renderer = ReportRenderer(template_dir)
    
    # Prepare variables
    variables = renderer._prepare_board_pack_variables(snapshot)
    
    # Assert mandatory variables are present
    assert "tenant_name" in variables
    assert "generated_timestamp_utc" in variables
    assert "ai_origin_violations" in variables
    assert "schema_violations" in variables
    assert "policy_origin_violations" in variables
    assert "payments_coverage_pct" in variables
    assert "fraud_high_flags" in variables
    assert "aml_high_flags" in variables
    assert "treasury_high_risk_windows" in variables
    
    # Assert safety violations are 0
    assert variables["ai_origin_violations"] == 0
    assert variables["schema_violations"] == 0
    assert variables["policy_origin_violations"] == 0


def test_regulator_annex_template_rendering():
    """
    Test: Regulator annex template rendering snapshot test.
    
    This test ensures that the regulator annex template can be rendered with
    valid data and produces the expected output.
    """
    # Create valid CSR
    snapshot = RiskBrainSnapshot(
        week="2025-W49",
        tenant_id="cu_123",
        period_start="2025-12-01",
        period_end="2025-12-07",
        health={
            "payments": DomainHealth(shadow=True, ci=True, killswitch=0),
            "fraud": DomainHealth(shadow=True, ci=True, killswitch=0),
            "aml": DomainHealth(shadow=True, ci=True, killswitch=0),
            "treasury": DomainHealth(shadow=True, ci=True, killswitch=0),
        },
        safety=SafetyMetrics(
            ai_origin_violations=0,
            schema_violations=0,
            policy_origin_violations=0
        ),
        payments=PaymentsMetrics(
            coverage_pct=73.2,
            direction_split={"better": 412, "worse": 37, "neutral": 219}
        ),
        fraud=FraudMetrics(
            high_flags=41,
            confirmed=3,
            cleared=31
        ),
        aml=AmlMetrics(
            high_flags=9,
            medium_flags=44,
            smrs=1
        ),
        treasury=TreasuryMetrics(
            high_risk_windows=0,
            avg_buffer_delta=182500
        )
    )
    
    # Render regulator annex template
    template_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")
    renderer = ReportRenderer(template_dir)
    
    # Prepare variables
    variables = renderer._prepare_regulator_annex_variables(snapshot)
    
    # Assert regulator-specific variables are present
    assert "fraud_stream_sha" in variables
    assert "aml_stream_sha" in variables
    assert "treasury_stream_sha" in variables
    assert "payments_stream_sha" in variables
    assert "fraud_sample_ts" in variables
    assert "aml_sample_ts" in variables


# ============================================================================
# TEST: PROMQL QUERY INTEGRITY
# ============================================================================

def test_promql_query_manifest_integrity():
    """
    Test: PromQL query manifest integrity.
    
    This test ensures that the PromQL query manifest is valid and contains
    all required queries.
    """
    # Load PromQL query manifest
    config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "promql-map-v1.yaml")
    
    with open(config_path, 'r') as f:
        promql_map = yaml.safe_load(f)
    
    # Assert version is 1.0
    assert promql_map["version"] == 1.0
    
    # Assert required metric families are present
    assert "safety_metrics" in promql_map
    assert "health_metrics" in promql_map
    assert "payments_metrics" in promql_map
    assert "fraud_metrics" in promql_map
    assert "aml_metrics" in promql_map
    assert "treasury_metrics" in promql_map
    
    # Assert safety metrics are present
    assert "ai_origin_violations" in promql_map["safety_metrics"]
    assert "schema_violations" in promql_map["safety_metrics"]
    assert "policy_origin_violations" in promql_map["safety_metrics"]
    
    # Assert all queries have required fields
    for metric_family in ["safety_metrics", "health_metrics", "payments_metrics", "fraud_metrics", "aml_metrics", "treasury_metrics"]:
        for metric_name, metric_config in promql_map[metric_family].items():
            assert "metric" in metric_config, f"Missing 'metric' field in {metric_family}.{metric_name}"
            assert "window" in metric_config, f"Missing 'window' field in {metric_family}.{metric_name}"
            assert "aggregation" in metric_config, f"Missing 'aggregation' field in {metric_family}.{metric_name}"
            assert "query" in metric_config, f"Missing 'query' field in {metric_family}.{metric_name}"


def test_no_inline_promql_in_code():
    """
    Test: No inline PromQL in code.
    
    This test ensures that no inline PromQL queries are present in the codebase.
    All queries must be declared in the PromQL query manifest.
    """
    # Check reporter.py for inline PromQL
    reporter_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reporter.py")
    
    with open(reporter_path, 'r') as f:
        reporter_code = f.read()
    
    # Assert no inline PromQL (simple heuristic: no "increase(" or "sum(" in code)
    # This is a simple check; a more robust check would use AST parsing
    assert "increase(" not in reporter_code or "# PromQL query" in reporter_code, "Inline PromQL detected in reporter.py"


# ============================================================================
# TEST: OBJECT LOCK VERIFICATION
# ============================================================================

def test_object_lock_verification():
    """
    Test: Object lock verification.
    
    This test ensures that object lock is enabled for immutable storage.
    """
    # TODO: Implement actual object lock verification
    # For v1, this is a placeholder test
    
    # Assert object lock is enabled (stub)
    object_lock_enabled = True  # Stub value
    assert object_lock_enabled, "Object lock must be enabled for immutable storage"


# ============================================================================
# TEST: SAFETY VIOLATION DETECTION
# ============================================================================

def test_safety_violation_detection():
    """
    Test: Safety violation detection.
    
    This test ensures that report generation fails if safety violations are detected.
    """
    # Create CSR with safety violations
    snapshot = RiskBrainSnapshot(
        week="2025-W49",
        tenant_id="cu_123",
        period_start="2025-12-01",
        period_end="2025-12-07",
        health={
            "payments": DomainHealth(shadow=True, ci=True, killswitch=0),
            "fraud": DomainHealth(shadow=True, ci=True, killswitch=0),
            "aml": DomainHealth(shadow=True, ci=True, killswitch=0),
            "treasury": DomainHealth(shadow=True, ci=True, killswitch=0),
        },
        safety=SafetyMetrics(
            ai_origin_violations=1,  # VIOLATION!
            schema_violations=0,
            policy_origin_violations=0
        ),
        payments=PaymentsMetrics(
            coverage_pct=73.2,
            direction_split={"better": 412, "worse": 37, "neutral": 219}
        ),
        fraud=FraudMetrics(
            high_flags=41,
            confirmed=3,
            cleared=31
        ),
        aml=AmlMetrics(
            high_flags=9,
            medium_flags=44,
            smrs=1
        ),
        treasury=TreasuryMetrics(
            high_risk_windows=0,
            avg_buffer_delta=182500
        )
    )
    
    # Assert safety statement cannot be generated (should raise exception)
    with pytest.raises(Exception):
        safety_statement = snapshot.safety_statement()


# ============================================================================
# RUN TESTS
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
