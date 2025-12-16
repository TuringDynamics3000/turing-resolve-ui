from intelligence_bus.routing import IntelligenceRouter


class ReplayEngine:
    def __init__(self, tenant_state):
        self.router = IntelligenceRouter()
        self.tenant_state = tenant_state
        self.commands = []

    def replay(self, events):
        for event in events:
            cmd = self.router.route(event, self.tenant_state)
            self.commands.append(cmd)
        return self.commands
