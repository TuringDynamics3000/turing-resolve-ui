from turing_protocol.validators.schema_version_guard import enforce_schema_version
from turing_protocol.validators.ai_origin_blocker import enforce_ai_origin_block
from turing_protocol.validators.policy_gateway_validator import enforce_policy_gateway


class IntelligenceConsumerBase:
    """
    Enforces the ONLY legal pipeline:
    Schema → Policy → AI Block → Emit Core Command
    
    This is the only lawful ingress from Risk Brain (B) into TuringCore (A).
    """

    def __init__(self, policy_fn):
        self.policy_fn = policy_fn

    def handle(self, event: dict, current_state: dict | None = None):
        """
        Process intelligence event through enforcement pipeline.
        
        Args:
            event: Intelligence event from Risk Brain
            current_state: Current state dict (optional)
        
        Returns:
            Core command dict or None
        
        Raises:
            SchemaVersionViolation: If schema version not approved
            PolicyGatewayViolation: If policy gateway invalid
            AiOriginViolation: If AI attempts forbidden command
        """
        # 1️⃣ Enforce schema immutability
        enforce_schema_version(event)

        # 2️⃣ Deterministic policy translation
        proposed_command = enforce_policy_gateway(
            event=event,
            policy_gateway_fn=self.policy_fn,
            current_state=current_state,
        )

        # 3️⃣ Absolute AI money-write prevention
        enforce_ai_origin_block(
            event=event,
            proposed_command=proposed_command,
        )

        return proposed_command
