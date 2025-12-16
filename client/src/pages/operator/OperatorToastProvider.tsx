import { useRef, useState } from "react";
import { toast } from "sonner";
import { useFactStream, PaymentFactEvent, SafeguardChangeEvent } from "@/hooks/useFactStream";

/**
 * OperatorToastProvider
 * 
 * Listens to the fact stream to show toasts for critical events.
 * 
 * CRITICAL: Toasts are driven by facts from SSE, NOT optimistic UI.
 * Toasts never imply money moved - they report observed system state.
 */

interface OperatorToastProviderProps {
  children: React.ReactNode;
}

export function OperatorToastProvider({ children }: OperatorToastProviderProps) {
  const [initialized, setInitialized] = useState(false);
  const seenFactIds = useRef(new Set<string>());

  // Subscribe to fact stream with callbacks
  useFactStream({
    onPaymentFact: (event: PaymentFactEvent) => {
      // Skip first few events on page load
      if (!initialized) {
        seenFactIds.current.add(event.factId);
        return;
      }

      // Skip already seen facts
      if (seenFactIds.current.has(event.factId)) return;
      seenFactIds.current.add(event.factId);

      if (event.factType === "PAYMENT_FAILED") {
        toast.error("Payment FAILED", {
          description: `Payment ${event.paymentId} failed. Review required.`,
          duration: 10000,
        });
      } else if (event.factType === "PAYMENT_REVERSED") {
        toast.warning("Payment REVERSED", {
          description: `Payment ${event.paymentId} has been reversed.`,
          duration: 8000,
        });
      }
    },

    onSafeguardChange: (event: SafeguardChangeEvent) => {
      // Always show safeguard changes - these are critical
      if (event.safeguardType === "kill_switch") {
        if (event.newState === "ON") {
          toast.error("Kill Switch ENABLED", {
            description: `${event.scheme} adapter halted. ${event.reason || ""}`,
            duration: 10000,
          });
        } else if (event.newState === "OFF") {
          toast.success("Kill Switch DISABLED", {
            description: `${event.scheme} adapter resumed.`,
            duration: 5000,
          });
        }
      } else if (event.safeguardType === "circuit_breaker") {
        if (event.newState === "OPEN") {
          toast.error("Circuit Breaker OPEN", {
            description: `${event.scheme} adapter circuit open. Requests will be rejected.`,
            duration: 10000,
          });
        } else if (event.newState === "HALF_OPEN") {
          toast.warning("Circuit Breaker HALF_OPEN", {
            description: "Testing adapter recovery. Limited requests allowed.",
            duration: 8000,
          });
        } else if (event.newState === "CLOSED") {
          toast.success("Circuit Breaker CLOSED", {
            description: "Adapter recovered. Normal operation resumed.",
            duration: 5000,
          });
        }
      }
    },

    onAnyFact: () => {
      // Mark as initialized after first event
      if (!initialized) {
        setInitialized(true);
      }
    },

    enabled: true,
  });

  return <>{children}</>;
}
