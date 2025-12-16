/**
 * useFactStream - React hook for real-time fact updates via SSE
 * 
 * CRITICAL PRINCIPLE:
 * - Receives new fact IDs only (not computed state)
 * - Triggers re-query callbacks so UI can replay and re-render
 * - Keeps replay sacred - no client-side state computation
 */

import { useEffect, useRef, useCallback, useState } from "react";

export interface PaymentFactEvent {
  type: "payment_fact";
  paymentId: string;
  factId: string;
  factType: string;
  sequence: number;
  occurredAt: string;
}

export interface DepositFactEvent {
  type: "deposit_fact";
  accountId: string;
  factId: string;
  factType: string;
  sequence: number;
  occurredAt: string;
}

export interface SafeguardChangeEvent {
  type: "safeguard_change";
  safeguardType: "kill_switch" | "circuit_breaker";
  scheme: string;
  newState: string;
  reason?: string;
  actor?: string;
}

export type FactStreamEvent = PaymentFactEvent | DepositFactEvent | SafeguardChangeEvent;

interface UseFactStreamOptions {
  /** Called when a new payment fact is received */
  onPaymentFact?: (event: PaymentFactEvent) => void;
  /** Called when a new deposit fact is received */
  onDepositFact?: (event: DepositFactEvent) => void;
  /** Called when a safeguard change is received */
  onSafeguardChange?: (event: SafeguardChangeEvent) => void;
  /** Called on any fact event */
  onAnyFact?: (event: FactStreamEvent) => void;
  /** Whether to enable the stream */
  enabled?: boolean;
}

interface UseFactStreamReturn {
  /** Whether the stream is connected */
  isConnected: boolean;
  /** Last event ID received (for reconnection) */
  lastEventId: number | null;
  /** Number of events received */
  eventCount: number;
  /** Recent events (last 10) */
  recentEvents: FactStreamEvent[];
  /** Manually reconnect */
  reconnect: () => void;
}

export function useFactStream(options: UseFactStreamOptions = {}): UseFactStreamReturn {
  const {
    onPaymentFact,
    onDepositFact,
    onSafeguardChange,
    onAnyFact,
    enabled = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastEventId, setLastEventId] = useState<number | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const [recentEvents, setRecentEvents] = useState<FactStreamEvent[]>([]);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!enabled) return;
    
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Build URL with last event ID for reconnection
    let url = "/api/facts/stream";
    
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      console.log("[FactStream] Connected");
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      console.log("[FactStream] Connection error, will retry...");
      
      // Auto-reconnect after 3 seconds
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    // Handle connected event
    eventSource.addEventListener("connected", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      console.log("[FactStream] Server last event ID:", data.lastEventId);
    });

    // Handle payment_fact events
    eventSource.addEventListener("payment_fact", (e) => {
      const event = JSON.parse((e as MessageEvent).data) as PaymentFactEvent;
      setLastEventId(parseInt((e as MessageEvent).lastEventId || "0", 10));
      setEventCount((c) => c + 1);
      setRecentEvents((prev) => [...prev.slice(-9), event]);
      
      console.log("[FactStream] Payment fact:", event.paymentId, event.factType);
      onPaymentFact?.(event);
      onAnyFact?.(event);
    });

    // Handle deposit_fact events
    eventSource.addEventListener("deposit_fact", (e) => {
      const event = JSON.parse((e as MessageEvent).data) as DepositFactEvent;
      setLastEventId(parseInt((e as MessageEvent).lastEventId || "0", 10));
      setEventCount((c) => c + 1);
      setRecentEvents((prev) => [...prev.slice(-9), event]);
      
      console.log("[FactStream] Deposit fact:", event.accountId, event.factType);
      onDepositFact?.(event);
      onAnyFact?.(event);
    });

    // Handle safeguard_change events
    eventSource.addEventListener("safeguard_change", (e) => {
      const event = JSON.parse((e as MessageEvent).data) as SafeguardChangeEvent;
      setLastEventId(parseInt((e as MessageEvent).lastEventId || "0", 10));
      setEventCount((c) => c + 1);
      setRecentEvents((prev) => [...prev.slice(-9), event]);
      
      console.log("[FactStream] Safeguard change:", event.safeguardType, event.scheme, event.newState);
      onSafeguardChange?.(event);
      onAnyFact?.(event);
    });

    return () => {
      eventSource.close();
    };
  }, [enabled, onPaymentFact, onDepositFact, onSafeguardChange, onAnyFact]);

  const reconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    connect();
  }, [connect]);

  useEffect(() => {
    const cleanup = connect();
    
    return () => {
      cleanup?.();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    isConnected,
    lastEventId,
    eventCount,
    recentEvents,
    reconnect,
  };
}
