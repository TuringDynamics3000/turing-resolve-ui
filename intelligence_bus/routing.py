from intelligence_bus.consumers.fraud_consumer import FraudConsumer
from intelligence_bus.consumers.aml_consumer import AmlConsumer
from intelligence_bus.consumers.hardship_consumer import HardshipConsumer
from intelligence_bus.consumers.payments_rl_consumer import PaymentsRlConsumer
from intelligence_bus.consumers.treasury_rl_consumer import TreasuryRlConsumer


FRAUD_EVENTS = {
    "FraudRiskScoreProduced",
    "FraudAdvisoryIssued",
}

AML_EVENTS = {
    "AmlRiskScoreProduced",
}

HARDSHIP_EVENTS = {
    "HardshipRiskScoreProduced",
}

PAYMENTS_RL_EVENTS = {
    "RlPolicyEvaluated",
    "RlRoutingAdvisoryIssued",
}

TREASURY_RL_EVENTS = {
    "RlTreasuryPolicyEvaluated",
}


class IntelligenceRouter:
    """
    Routes intelligence events to appropriate domain consumers.
    
    This is the only lawful ingress from Risk Brain (B) into TuringCore (A).
    All events pass through Schema → Policy → AI Block enforcement.
    """
    
    def __init__(self):
        self.fraud = FraudConsumer()
        self.aml = AmlConsumer()
        self.hardship = HardshipConsumer()
        self.payments = PaymentsRlConsumer()
        self.treasury = TreasuryRlConsumer()

    def route(self, event: dict, current_state: dict | None = None):
        """
        Route intelligence event to appropriate consumer.
        
        Args:
            event: Intelligence event from Risk Brain
            current_state: Current state dict (optional)
        
        Returns:
            Core command dict or None
        """
        event_type = event.get("event_type")

        if event_type in FRAUD_EVENTS:
            return self.fraud.process(event, current_state)

        if event_type in AML_EVENTS:
            return self.aml.process(event, current_state)

        if event_type in HARDSHIP_EVENTS:
            return self.hardship.process(event, current_state)

        if event_type in PAYMENTS_RL_EVENTS:
            return self.payments.process(event, current_state)

        if event_type in TREASURY_RL_EVENTS:
            return self.treasury.process(event, current_state)

        # Unknown intelligence events are ignored by design
        return None
