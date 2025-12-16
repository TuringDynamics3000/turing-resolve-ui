import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Operator Toast Notifications
 * 
 * CRITICAL: Toasts are driven by facts and status endpoints, NOT optimistic UI.
 * Toasts never imply money moved - they report observed system state.
 * 
 * Events that trigger toasts:
 * - Kill-switch enabled/disabled
 * - Circuit breaker OPEN/HALF_OPEN
 * - Payment FAILED/REVERSED
 */

interface SystemStatus {
  killSwitch: {
    state: "ON" | "OFF";
    adapter: string;
    changedAt: string;
    reason?: string;
  };
  circuitBreaker: {
    state: "CLOSED" | "OPEN" | "HALF_OPEN";
    failureCount: number;
    lastFailure?: string;
  };
}

interface PaymentFact {
  factType: string;
  paymentId: string;
  occurredAt: string;
}

// Track last known states to detect changes
let lastKillSwitchState: string | null = null;
let lastCircuitBreakerState: string | null = null;
let lastSeenFactIds = new Set<string>();

export function useOperatorToasts(
  systemStatus: SystemStatus | null,
  paymentFacts: PaymentFact[] | null,
  enabled: boolean = true
) {
  const [initialized, setInitialized] = useState(false);
  const toastCountRef = useRef(0);

  useEffect(() => {
    if (!enabled || !systemStatus) return;

    // Skip first render to avoid toasting on page load
    if (!initialized) {
      lastKillSwitchState = systemStatus.killSwitch.state;
      lastCircuitBreakerState = systemStatus.circuitBreaker.state;
      setInitialized(true);
      return;
    }

    // Kill-switch state change
    if (lastKillSwitchState !== null && lastKillSwitchState !== systemStatus.killSwitch.state) {
      if (systemStatus.killSwitch.state === "ON") {
        toast.error("Kill Switch ENABLED", {
          description: `${systemStatus.killSwitch.adapter} adapter halted. Reason: ${systemStatus.killSwitch.reason || "Manual activation"}`,
          duration: 10000,
          id: `kill-switch-${++toastCountRef.current}`,
        });
      } else {
        toast.success("Kill Switch DISABLED", {
          description: `${systemStatus.killSwitch.adapter} adapter resumed.`,
          duration: 5000,
          id: `kill-switch-${++toastCountRef.current}`,
        });
      }
    }
    lastKillSwitchState = systemStatus.killSwitch.state;

    // Circuit breaker state change
    if (lastCircuitBreakerState !== null && lastCircuitBreakerState !== systemStatus.circuitBreaker.state) {
      if (systemStatus.circuitBreaker.state === "OPEN") {
        toast.error("Circuit Breaker OPEN", {
          description: `Adapter circuit open after ${systemStatus.circuitBreaker.failureCount} failures. Requests will be rejected.`,
          duration: 10000,
          id: `circuit-breaker-${++toastCountRef.current}`,
        });
      } else if (systemStatus.circuitBreaker.state === "HALF_OPEN") {
        toast.warning("Circuit Breaker HALF_OPEN", {
          description: "Testing adapter recovery. Limited requests allowed.",
          duration: 8000,
          id: `circuit-breaker-${++toastCountRef.current}`,
        });
      } else if (systemStatus.circuitBreaker.state === "CLOSED") {
        toast.success("Circuit Breaker CLOSED", {
          description: "Adapter recovered. Normal operation resumed.",
          duration: 5000,
          id: `circuit-breaker-${++toastCountRef.current}`,
        });
      }
    }
    lastCircuitBreakerState = systemStatus.circuitBreaker.state;
  }, [systemStatus, enabled, initialized]);

  // Payment fact notifications
  useEffect(() => {
    if (!enabled || !paymentFacts || paymentFacts.length === 0) return;

    // Skip first render
    if (!initialized) {
      paymentFacts.forEach(f => lastSeenFactIds.add(`${f.paymentId}-${f.factType}-${f.occurredAt}`));
      return;
    }

    paymentFacts.forEach(fact => {
      const factKey = `${fact.paymentId}-${fact.factType}-${fact.occurredAt}`;
      
      if (lastSeenFactIds.has(factKey)) return;
      lastSeenFactIds.add(factKey);

      if (fact.factType === "PAYMENT_FAILED") {
        toast.error("Payment FAILED", {
          description: `Payment ${fact.paymentId} failed. Review required.`,
          duration: 10000,
          id: `payment-failed-${++toastCountRef.current}`,
        });
      } else if (fact.factType === "PAYMENT_REVERSED") {
        toast.warning("Payment REVERSED", {
          description: `Payment ${fact.paymentId} has been reversed.`,
          duration: 8000,
          id: `payment-reversed-${++toastCountRef.current}`,
        });
      }
    });
  }, [paymentFacts, enabled, initialized]);

  // Reset function for testing
  const reset = () => {
    lastKillSwitchState = null;
    lastCircuitBreakerState = null;
    lastSeenFactIds.clear();
    setInitialized(false);
  };

  return { reset };
}

/**
 * Standalone toast functions for imperative use
 * These are for events that don't come from polling (e.g., SSE events)
 */
export const operatorToasts = {
  killSwitchEnabled: (adapter: string, reason?: string) => {
    toast.error("Kill Switch ENABLED", {
      description: `${adapter} adapter halted. Reason: ${reason || "Manual activation"}`,
      duration: 10000,
    });
  },

  killSwitchDisabled: (adapter: string) => {
    toast.success("Kill Switch DISABLED", {
      description: `${adapter} adapter resumed.`,
      duration: 5000,
    });
  },

  circuitBreakerOpen: (failureCount: number) => {
    toast.error("Circuit Breaker OPEN", {
      description: `Adapter circuit open after ${failureCount} failures. Requests will be rejected.`,
      duration: 10000,
    });
  },

  circuitBreakerHalfOpen: () => {
    toast.warning("Circuit Breaker HALF_OPEN", {
      description: "Testing adapter recovery. Limited requests allowed.",
      duration: 8000,
    });
  },

  circuitBreakerClosed: () => {
    toast.success("Circuit Breaker CLOSED", {
      description: "Adapter recovered. Normal operation resumed.",
      duration: 5000,
    });
  },

  paymentFailed: (paymentId: string) => {
    toast.error("Payment FAILED", {
      description: `Payment ${paymentId} failed. Review required.`,
      duration: 10000,
    });
  },

  paymentReversed: (paymentId: string) => {
    toast.warning("Payment REVERSED", {
      description: `Payment ${paymentId} has been reversed.`,
      duration: 8000,
    });
  },
};
