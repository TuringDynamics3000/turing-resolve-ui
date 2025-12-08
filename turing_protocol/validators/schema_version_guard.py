# ==========================================================
# SCHEMA VERSION GUARD
# Prevents silent breaking changes in protocol schemas
# ==========================================================

class SchemaVersionViolation(Exception):
    pass


# This should be backed by your schema registry later
APPROVED_SCHEMA_VERSIONS = {
    "FraudRiskScoreProduced": ["1.0"],
    "AmlRiskScoreProduced": ["1.0"],
    "HardshipRiskScoreProduced": ["1.0"],
    "RlPolicyEvaluated": ["1.0"],
    "RlTreasuryPolicyEvaluated": ["1.0"],
    "AiExplanationGenerated": ["1.0"],
    "ModelDeployed": ["1.0"],
    "ModelAuthorityLevelChanged": ["1.0"],
}


def enforce_schema_version(event: dict) -> None:
    """
    Prevents silent schema drift (APRA + court critical).
    
    Args:
        event: Intelligence event with event_type and base.schema_version fields
    
    Raises:
        SchemaVersionViolation: If event type not registered or schema version not approved
    
    This prevents backdoor breaking changes.
    This enforces contract stability with regulators.
    This forces all evolution through governance.
    """
    event_type = event.get("event_type")
    schema_version = event.get("base", {}).get("schema_version")

    if not event_type:
        raise SchemaVersionViolation("Missing event_type")

    allowed_versions = APPROVED_SCHEMA_VERSIONS.get(event_type)

    if not allowed_versions:
        raise SchemaVersionViolation(
            f"Event type {event_type} is not registered for intelligence ingress"
        )

    if schema_version not in allowed_versions:
        raise SchemaVersionViolation(
            f"Schema version {schema_version} not approved for {event_type}"
        )
