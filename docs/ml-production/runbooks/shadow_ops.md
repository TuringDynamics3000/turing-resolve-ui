# Runbook: Shadow Deployment Operations

## Objective
Run model on 100% eligible traffic without affecting execution.

## Steps
1) Ensure model status = SHADOW in registry
2) Confirm inference timeouts and circuit breaker are enabled
3) Verify inference facts are emitted for every eligible decision
4) Monitor:
   - coverage (should be ~100%)
   - latency and error rates
   - distribution drift vs training
   - constitution violation rate of model recommendations

## Promotion readiness
Shadow must run for a sufficient sample/window (domain-specific) and produce a promotion packet.
