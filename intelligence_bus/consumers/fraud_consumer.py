import os
from intelligence_bus.consumers._base import IntelligenceConsumerBase
from domains.fraud.policy_gateway import apply_policy as fraud_policy


class FraudConsumer(IntelligenceConsumerBase):
    """
    Fraud Consumer with Triple-Layer Kill Switch
    
    KILL SWITCH 1: Environment Variable (Hard Stop)
    KILL SWITCH 2: Protocol Governance Event (ModelAuthorityLevelChanged)
    KILL SWITCH 3: Runtime Panic Switch (Immediate Process Halt)
    """
    
    def __init__(self):
        super().__init__(fraud_policy)
        self.model_authority = "SHADOW_ADVISORY"  # Default state
        self.panic_mode = False
    
    def process(self, event: dict, current_state: dict | None = None):
        # KILL SWITCH 1: Environment Variable (Hard Stop)
        if os.getenv("RISK_BRAIN_FRAUD_ENABLED", "false").lower() != "true":
            return None  # Fraud ML completely disabled, no FraudRiskScoreProduced, no flags
        
        # KILL SWITCH 2: Protocol Governance Event
        if self.model_authority == "SHADOW_DISABLED":
            return None  # Fraud ML disabled by governance event (Board/Risk Committee/APRA)
        
        # KILL SWITCH 3: Runtime Panic Switch (Immediate Process Halt)
        if self.panic_mode:
            raise SystemExit("PANIC STOP: Fraud Dark Graph halted - suspected data poisoning or policy bypass")
        
        # Normal processing if all kill switches are off
        return self.handle(event, current_state)
    
    def update_model_authority(self, new_authority: str):
        """
        Update model authority level via Protocol governance event.
        
        Valid values:
        - SHADOW_ADVISORY: Normal operation (advisory only, flags only)
        - SHADOW_DISABLED: Fraud ML completely disabled
        - BOUNDED_AUTOMATION: (Future) Tightly bounded automation with human oversight
        """
        self.model_authority = new_authority
    
    def trigger_panic_stop(self, reason: str):
        """
        Trigger immediate panic stop for extreme cases:
        - Suspected data poisoning
        - Unexpected policy bypass
        - Incorrect AI origin tagging
        - Fraud Dark Graph compromise
        """
        self.panic_mode = True
        raise SystemExit(f"PANIC STOP: Fraud Dark Graph halted - {reason}")
