/**
 * useDecisionUpdates Hook
 * 
 * Real-time WebSocket subscription for decision status changes.
 * Pushes updates to member portal when decisions are approved/declined.
 */

import { useEffect, useCallback, useRef, useState, createContext, useContext, ReactNode } from 'react';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

export interface DecisionUpdate {
  decisionId: string;
  type: 'LIMIT_INCREASE' | 'PAYMENT' | 'LENDING' | 'ACCOUNT_ACTION';
  previousStatus: string;
  newStatus: 'APPROVED' | 'DECLINED' | 'ESCALATED';
  timestamp: Date;
  operatorId?: string;
  reason?: string;
  hash: string;
  notarisationTxId?: string;
}

export interface WebSocketMessage {
  type: 'DECISION_UPDATE' | 'NOTARISATION_CONFIRMED' | 'SYSTEM_ALERT' | 'HEARTBEAT';
  payload: unknown;
  timestamp: string;
}

interface UseDecisionUpdatesOptions {
  memberId?: string;
  onUpdate?: (update: DecisionUpdate) => void;
  showToasts?: boolean;
  autoReconnect?: boolean;
}

interface UseDecisionUpdatesReturn {
  isConnected: boolean;
  lastUpdate: DecisionUpdate | null;
  updates: DecisionUpdate[];
  reconnect: () => void;
  disconnect: () => void;
}

// ============================================
// MOCK WEBSOCKET SIMULATION
// ============================================

// Since we don't have a real WebSocket server, we'll simulate updates
// In production, this would connect to the actual WebSocket endpoint

class MockWebSocket {
  private listeners: Map<string, Set<(data: WebSocketMessage) => void>> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private isOpen = false;
  
  constructor() {
    this.listeners.set('message', new Set());
    this.listeners.set('open', new Set());
    this.listeners.set('close', new Set());
    this.listeners.set('error', new Set());
  }
  
  connect() {
    // Simulate connection delay
    setTimeout(() => {
      this.isOpen = true;
      this.emit('open', { type: 'HEARTBEAT', payload: null, timestamp: new Date().toISOString() });
      
      // Start sending mock updates every 30-60 seconds
      this.startMockUpdates();
    }, 500);
  }
  
  private startMockUpdates() {
    // Send a mock update after random interval (for demo purposes)
    const scheduleNextUpdate = () => {
      const delay = 30000 + Math.random() * 30000; // 30-60 seconds
      this.intervalId = setTimeout(() => {
        if (this.isOpen) {
          this.sendMockUpdate();
          scheduleNextUpdate();
        }
      }, delay);
    };
    
    scheduleNextUpdate();
  }
  
  private sendMockUpdate() {
    const updates: DecisionUpdate[] = [
      {
        decisionId: 'DEC-004847',
        type: 'LIMIT_INCREASE',
        previousStatus: 'PENDING',
        newStatus: 'APPROVED',
        timestamp: new Date(),
        operatorId: 'OPS-ANALYST-001',
        reason: 'Request within policy guidelines',
        hash: '7f3a8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a',
        notarisationTxId: '0x8f7e6d5c4b3a2918273645f0e1d2c3b4a5968778695a4b3c2d1e0f9a8b7c6d5e',
      },
      {
        decisionId: 'DEC-004850',
        type: 'PAYMENT',
        previousStatus: 'PENDING',
        newStatus: 'DECLINED',
        timestamp: new Date(),
        operatorId: 'OPS-ANALYST-002',
        reason: 'Additional verification required',
        hash: '2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b',
      },
    ];
    
    const update = updates[Math.floor(Math.random() * updates.length)];
    
    this.emit('message', {
      type: 'DECISION_UPDATE',
      payload: update,
      timestamp: new Date().toISOString(),
    });
  }
  
  on(event: string, callback: (data: WebSocketMessage) => void) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.add(callback);
    }
  }
  
  off(event: string, callback: (data: WebSocketMessage) => void) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }
  
  private emit(event: string, data: WebSocketMessage) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }
  
  close() {
    this.isOpen = false;
    if (this.intervalId) {
      clearTimeout(this.intervalId);
    }
    this.emit('close', { type: 'HEARTBEAT', payload: null, timestamp: new Date().toISOString() });
  }
  
  get readyState() {
    return this.isOpen ? 1 : 0; // 1 = OPEN, 0 = CONNECTING
  }
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useDecisionUpdates(options: UseDecisionUpdatesOptions = {}): UseDecisionUpdatesReturn {
  const { 
    memberId, 
    onUpdate, 
    showToasts = true, 
    autoReconnect = true 
  } = options;
  
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<DecisionUpdate | null>(null);
  const [updates, setUpdates] = useState<DecisionUpdate[]>([]);
  
  const wsRef = useRef<MockWebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'DECISION_UPDATE') {
      const update = message.payload as DecisionUpdate;
      
      setLastUpdate(update);
      setUpdates(prev => [update, ...prev].slice(0, 50)); // Keep last 50 updates
      
      // Call custom handler
      onUpdate?.(update);
      
      // Show toast notification
      if (showToasts) {
        const isApproved = update.newStatus === 'APPROVED';
        const title = isApproved ? 'Request Approved!' : 'Request Update';
        const description = isApproved 
          ? `Your ${update.type.toLowerCase().replace('_', ' ')} request has been approved.`
          : `Your ${update.type.toLowerCase().replace('_', ' ')} request was ${update.newStatus.toLowerCase()}.`;
        
        if (isApproved) {
          toast.success(title, { description });
        } else if (update.newStatus === 'DECLINED') {
          toast.error(title, { description });
        } else {
          toast.info(title, { description });
        }
      }
    } else if (message.type === 'NOTARISATION_CONFIRMED') {
      if (showToasts) {
        toast.info('Blockchain Confirmed', {
          description: 'Your decision has been anchored to RedBelly blockchain.'
        });
      }
    }
  }, [onUpdate, showToasts]);
  
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === 1) return;
    
    const ws = new MockWebSocket();
    wsRef.current = ws;
    
    ws.on('open', () => {
      setIsConnected(true);
      console.log('[WebSocket] Connected to decision updates');
    });
    
    ws.on('message', handleMessage);
    
    ws.on('close', () => {
      setIsConnected(false);
      console.log('[WebSocket] Disconnected');
      
      // Auto-reconnect after 5 seconds
      if (autoReconnect) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[WebSocket] Attempting to reconnect...');
          connect();
        }, 5000);
      }
    });
    
    ws.on('error', () => {
      console.error('[WebSocket] Connection error');
      setIsConnected(false);
    });
    
    ws.connect();
  }, [handleMessage, autoReconnect]);
  
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, []);
  
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(connect, 100);
  }, [connect, disconnect]);
  
  // Connect on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);
  
  return {
    isConnected,
    lastUpdate,
    updates,
    reconnect,
    disconnect,
  };
}

// ============================================
// CONTEXT FOR GLOBAL ACCESS
// ============================================

interface DecisionUpdatesContextValue extends UseDecisionUpdatesReturn {
  // Additional context methods can be added here
}

const DecisionUpdatesContext = createContext<DecisionUpdatesContextValue | null>(null);

export function DecisionUpdatesProvider({ children }: { children: ReactNode }) {
  const value = useDecisionUpdates({ showToasts: true });
  
  return (
    <DecisionUpdatesContext.Provider value={value}>
      {children}
    </DecisionUpdatesContext.Provider>
  );
}

export function useDecisionUpdatesContext() {
  const context = useContext(DecisionUpdatesContext);
  if (!context) {
    throw new Error('useDecisionUpdatesContext must be used within DecisionUpdatesProvider');
  }
  return context;
}
