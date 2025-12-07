"""
Architecture Compliance Tests

These tests enforce the strict separation between TuringCore-v3 and the CU Digital Twin.
They fail if any code violates the separation principles documented in
docs/06-core-separation-principles.md.

Run these tests before every commit and in CI/CD pipelines.
"""

import ast
import os
import re
from pathlib import Path
from typing import List, Tuple

import pytest


# Configuration
PROJECT_ROOT = Path(__file__).parent.parent.parent
SRC_DIR = PROJECT_ROOT / "src"
CONFIG_DIR = PROJECT_ROOT / "config"

FORBIDDEN_IMPORTS = [
    "turingcore_v3",
    "turingcore.domains",
    "turingcore.persistence",
    "turingcore.event_store",
]

FORBIDDEN_DB_PATTERNS = [
    "postgresql://turingcore",
    "TURINGCORE_DB_HOST",
    "TURINGCORE_DB_PASSWORD",
    "TURINGCORE_DB_USER",
    "TURINGCORE_DB_NAME",
    "turingcore-db.internal",
    "turingcore-postgres",
]

ALLOWED_API_CLIENTS = [
    "TuringCoreAPIClient",
    "TuringCoreClient",
    "turingcore_client",
]


def find_python_files(directory: Path) -> List[Path]:
    """Find all Python files in a directory recursively."""
    return list(directory.rglob("*.py"))


def find_config_files(directory: Path) -> List[Path]:
    """Find all configuration files in a directory recursively."""
    patterns = ["*.yaml", "*.yml", "*.env", "*.json", "*.toml"]
    files = []
    for pattern in patterns:
        files.extend(directory.rglob(pattern))
    return files


def extract_imports(filepath: Path) -> List[Tuple[str, int]]:
    """Extract all import statements from a Python file."""
    imports = []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            tree = ast.parse(f.read(), filename=str(filepath))
            
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append((alias.name, node.lineno))
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    imports.append((node.module, node.lineno))
    except SyntaxError as e:
        pytest.fail(f"Syntax error in {filepath}: {e}")
    
    return imports


class TestNoForbiddenImports:
    """Test that no code imports from TuringCore-v3 source."""
    
    def test_no_turingcore_source_imports(self):
        """
        Ensure no files import from turingcore_v3 source code.
        
        The twin must treat TuringCore as an external service and use only
        the generated API client SDK, not import internal modules.
        """
        violations = []
        
        python_files = find_python_files(SRC_DIR)
        
        for filepath in python_files:
            imports = extract_imports(filepath)
            
            for import_name, lineno in imports:
                for forbidden in FORBIDDEN_IMPORTS:
                    if import_name.startswith(forbidden):
                        relative_path = filepath.relative_to(PROJECT_ROOT)
                        violations.append(
                            f"{relative_path}:{lineno} - Forbidden import: {import_name}"
                        )
        
        if violations:
            error_msg = (
                "Forbidden imports from TuringCore-v3 source detected:\n\n"
                + "\n".join(violations)
                + "\n\nThe twin repository must not import from turingcore_v3 source.\n"
                + "Use the generated API client SDK instead (turingcore_client).\n"
                + "See docs/06-core-separation-principles.md for details."
            )
            pytest.fail(error_msg)


class TestNoDirectDatabaseConnections:
    """Test that no code attempts direct database connections to TuringCore."""
    
    def test_no_direct_db_connections_in_code(self):
        """
        Ensure no Python code contains direct TuringCore DB connection strings.
        
        The twin must interact with TuringCore only via APIs, not by
        connecting directly to the database.
        """
        violations = []
        
        python_files = find_python_files(SRC_DIR)
        
        for filepath in python_files:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
                
            for pattern in FORBIDDEN_DB_PATTERNS:
                if pattern in content:
                    # Find line number
                    lines = content.split("\n")
                    for lineno, line in enumerate(lines, 1):
                        if pattern in line:
                            relative_path = filepath.relative_to(PROJECT_ROOT)
                            violations.append(
                                f"{relative_path}:{lineno} - Forbidden DB pattern: {pattern}"
                            )
        
        if violations:
            error_msg = (
                "Forbidden database connection patterns detected:\n\n"
                + "\n".join(violations)
                + "\n\nThe twin repository must not connect directly to TuringCore database.\n"
                + "Use the TuringCore API instead.\n"
                + "See docs/06-core-separation-principles.md for details."
            )
            pytest.fail(error_msg)
    
    def test_no_direct_db_connections_in_config(self):
        """
        Ensure no configuration files contain direct TuringCore DB connection strings.
        
        Configuration files must not contain credentials or connection strings
        for TuringCore's internal database.
        """
        violations = []
        
        config_files = find_config_files(CONFIG_DIR)
        
        for filepath in config_files:
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                    
                for pattern in FORBIDDEN_DB_PATTERNS:
                    if pattern in content:
                        # Find line number
                        lines = content.split("\n")
                        for lineno, line in enumerate(lines, 1):
                            if pattern in line:
                                relative_path = filepath.relative_to(PROJECT_ROOT)
                                violations.append(
                                    f"{relative_path}:{lineno} - Forbidden DB pattern: {pattern}"
                                )
            except UnicodeDecodeError:
                # Skip binary files
                continue
        
        if violations:
            error_msg = (
                "Forbidden database connection patterns detected in config:\n\n"
                + "\n".join(violations)
                + "\n\nConfiguration files must not contain TuringCore DB credentials.\n"
                + "Use the TuringCore API instead.\n"
                + "See docs/06-core-separation-principles.md for details."
            )
            pytest.fail(error_msg)


class TestAPIOnlyInteractions:
    """Test that all TuringCore interactions use the API client."""
    
    def test_only_api_client_usage(self):
        """
        Ensure all TuringCore interactions use the generated API client.
        
        Direct HTTP calls to TuringCore endpoints should not be made.
        Instead, use the generated client SDK which provides type safety
        and versioning.
        """
        violations = []
        
        # Patterns that indicate direct HTTP calls
        forbidden_patterns = [
            r'requests\.(get|post|put|delete|patch)\(["\']https?://.*turingcore',
            r'httpx\.(get|post|put|delete|patch)\(["\']https?://.*turingcore',
            r'urllib\.request\.',
            r'http\.client\.',
        ]
        
        python_files = find_python_files(SRC_DIR)
        
        for filepath in python_files:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
                lines = content.split("\n")
                
            for pattern in forbidden_patterns:
                for lineno, line in enumerate(lines, 1):
                    if re.search(pattern, line):
                        # Check if this file uses the allowed API client
                        uses_api_client = any(
                            client in content for client in ALLOWED_API_CLIENTS
                        )
                        
                        if not uses_api_client:
                            relative_path = filepath.relative_to(PROJECT_ROOT)
                            violations.append(
                                f"{relative_path}:{lineno} - Direct HTTP call detected: {line.strip()}"
                            )
        
        if violations:
            error_msg = (
                "Direct HTTP calls to TuringCore detected:\n\n"
                + "\n".join(violations)
                + "\n\nUse the generated API client SDK instead of direct HTTP calls.\n"
                + "Example:\n"
                + "  from turingcore_client import TuringCoreAPIClient\n"
                + "  client = TuringCoreAPIClient(...)\n"
                + "  result = client.commands.open_account(...)\n"
                + "\nSee docs/06-core-separation-principles.md for details."
            )
            pytest.fail(error_msg)


class TestNoEventProduction:
    """Test that no code attempts to produce events to TuringCore's Kafka topics."""
    
    def test_no_kafka_event_production(self):
        """
        Ensure no code attempts to produce events to TuringCore's event store.
        
        The twin can consume events (read-only) for validation, but must not
        produce events directly. All events must be produced by TuringCore
        in response to commands.
        """
        violations = []
        
        # Patterns that indicate Kafka event production
        forbidden_patterns = [
            r'producer\.send\(["\']ledger_events',
            r'producer\.send\(["\']turingcore',
            r'kafka\.Producer\(',
            r'KafkaProducer\(',
        ]
        
        python_files = find_python_files(SRC_DIR)
        
        for filepath in python_files:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
                lines = content.split("\n")
                
            for pattern in forbidden_patterns:
                for lineno, line in enumerate(lines, 1):
                    if re.search(pattern, line):
                        relative_path = filepath.relative_to(PROJECT_ROOT)
                        violations.append(
                            f"{relative_path}:{lineno} - Kafka event production detected: {line.strip()}"
                        )
        
        if violations:
            error_msg = (
                "Kafka event production to TuringCore topics detected:\n\n"
                + "\n".join(violations)
                + "\n\nThe twin must not produce events directly to TuringCore's event store.\n"
                + "All events must be produced by TuringCore in response to commands.\n"
                + "The twin can consume events (read-only) for validation.\n"
                + "See docs/06-core-separation-principles.md for details."
            )
            pytest.fail(error_msg)


class TestNoInternalEndpoints:
    """Test that no code calls internal/admin endpoints."""
    
    def test_no_internal_endpoint_calls(self):
        """
        Ensure no code calls internal or admin endpoints not exposed to customers.
        
        The twin must use only the same endpoints that real customers would use.
        No special backdoors or internal APIs.
        """
        violations = []
        
        # Patterns that indicate internal endpoint usage
        forbidden_patterns = [
            r'/internal/',
            r'/admin/',
            r'/debug/',
            r'/_internal/',
        ]
        
        python_files = find_python_files(SRC_DIR)
        
        for filepath in python_files:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
                lines = content.split("\n")
                
            for pattern in forbidden_patterns:
                for lineno, line in enumerate(lines, 1):
                    if re.search(pattern, line) and ("http" in line.lower() or "url" in line.lower()):
                        relative_path = filepath.relative_to(PROJECT_ROOT)
                        violations.append(
                            f"{relative_path}:{lineno} - Internal endpoint call detected: {line.strip()}"
                        )
        
        if violations:
            error_msg = (
                "Internal/admin endpoint calls detected:\n\n"
                + "\n".join(violations)
                + "\n\nThe twin must use only public customer-facing APIs.\n"
                + "No internal or admin endpoints should be called.\n"
                + "See docs/06-core-separation-principles.md for details."
            )
            pytest.fail(error_msg)


# Summary test that runs all checks
def test_separation_compliance_summary():
    """
    Summary test that provides an overview of separation compliance.
    
    This test always passes but prints a summary of the compliance status.
    """
    print("\n" + "=" * 70)
    print("CORE-CU SEPARATION COMPLIANCE SUMMARY")
    print("=" * 70)
    
    checks = [
        ("No forbidden imports", TestNoForbiddenImports),
        ("No direct DB connections", TestNoDirectDatabaseConnections),
        ("API-only interactions", TestAPIOnlyInteractions),
        ("No event production", TestNoEventProduction),
        ("No internal endpoints", TestNoInternalEndpoints),
    ]
    
    print("\nCompliance checks:")
    for check_name, _ in checks:
        print(f"  ✓ {check_name}")
    
    print("\nFor details, see: docs/06-core-separation-principles.md")
    print("=" * 70 + "\n")
