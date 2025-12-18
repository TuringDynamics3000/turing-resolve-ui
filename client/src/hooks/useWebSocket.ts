import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export enum WebSocketEvent {
  CASE_CREATED = 'case:created',
  CASE_UPDATED = 'case:updated',
  CASE_ASSIGNED = 'case:assigned',
  CASE_RESOLVED = 'case:resolved',
  DECISION_CREATED = 'decision:created',
  DECISION_UPDATED = 'decision:updated',
  NOTIFICATION = 'notification',
  SYSTEM_ALERT = 'system:alert',
  MODEL_STATUS_CHANGED = 'model:status_changed',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
}

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface CasePayload {
  id: string;
  type: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: string;
  title: string;
  assignee?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPayload {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: string;
  actionUrl?: string;
}

interface UseWebSocketOptions {
  autoConnect?: boolean;
  rooms?: string[];
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { autoConnect = true, rooms = [] } = options;
  const socketRef = useRef<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const eventHandlersRef = useRef<Map<WebSocketEvent, (data: any) => void>>(new Map());

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;
    setConnectionState('connecting');

    const socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
    });

    socket.on('connect', () => {
      setConnectionState('connected');
      rooms.forEach(room => socket.emit('subscribe', room));
      eventHandlersRef.current.forEach((handler, event) => {
        socket.on(event, handler);
      });
    });

    socket.on('disconnect', () => setConnectionState('disconnected'));
    socket.on('connect_error', () => setConnectionState('error'));

    socketRef.current = socket;
  }, [rooms]);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnectionState('disconnected');
  }, []);

  const subscribe = useCallback((room: string) => {
    socketRef.current?.emit('subscribe', room);
  }, []);

  const unsubscribe = useCallback((room: string) => {
    socketRef.current?.emit('unsubscribe', room);
  }, []);

  const on = useCallback(<T,>(event: WebSocketEvent, callback: (data: T) => void) => {
    eventHandlersRef.current.set(event, callback);
    if (socketRef.current?.connected) {
      socketRef.current.on(event, callback);
    }
  }, []);

  const off = useCallback((event: WebSocketEvent) => {
    eventHandlersRef.current.delete(event);
    socketRef.current?.off(event);
  }, []);

  useEffect(() => {
    if (autoConnect) connect();
    return () => disconnect();
  }, [autoConnect, connect, disconnect]);

  return { socket: socketRef.current, connectionState, connect, disconnect, subscribe, unsubscribe, on, off };
}

export function useOpsInboxWebSocket(onCaseUpdate?: (cases: CasePayload[]) => void) {
  const [newCases, setNewCases] = useState<CasePayload[]>([]);
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);

  const { connectionState, on, off } = useWebSocket({
    autoConnect: true,
    rooms: ['ops-inbox'],
  });

  useEffect(() => {
    on<CasePayload>(WebSocketEvent.CASE_CREATED, (caseData) => {
      setNewCases(prev => [caseData, ...prev]);
      onCaseUpdate?.([caseData]);
    });

    on<CasePayload>(WebSocketEvent.CASE_UPDATED, (caseData) => {
      setNewCases(prev => {
        const filtered = prev.filter(c => c.id !== caseData.id);
        return [caseData, ...filtered];
      });
    });

    on<NotificationPayload>(WebSocketEvent.NOTIFICATION, (notification) => {
      setNotifications(prev => [notification, ...prev.slice(0, 9)]);
    });

    return () => {
      off(WebSocketEvent.CASE_CREATED);
      off(WebSocketEvent.CASE_UPDATED);
      off(WebSocketEvent.NOTIFICATION);
    };
  }, [on, off, onCaseUpdate]);

  const clearNewCases = useCallback(() => setNewCases([]), []);
  const clearNotifications = useCallback(() => setNotifications([]), []);

  return { connectionState, newCases, notifications, clearNewCases, clearNotifications };
}
