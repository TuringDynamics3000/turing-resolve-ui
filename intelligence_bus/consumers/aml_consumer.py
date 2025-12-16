from intelligence_bus.consumers._base import IntelligenceConsumerBase
from domains.aml.policy_gateway import apply_policy as aml_policy


class AmlConsumer(IntelligenceConsumerBase):
    def __init__(self):
        super().__init__(aml_policy)

    def process(self, event: dict, current_state: dict | None = None):
        return self.handle(event, current_state)
