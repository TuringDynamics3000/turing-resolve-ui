import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

// Event types for real-time updates
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

// Payload types
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

export interface DecisionPayload {
  id: string;
  outcome: 'ALLOW' | 'DECLINE' | 'REVIEW';
  policyId: string;
  timestamp: string;
  entityId: string;
  entityType: string;
}

export interface NotificationPayload {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: string;
  actionUrl?: string;
}

// WebSocket server singleton
let io: Server | null = null;

// Connected clients tracking
const connectedClients = new Map<string, {
  socket: Socket;
  userId?: string;
  subscribedRooms: Set<string>;
}>();

/**
 * Initialize WebSocket server
 */
export function initWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);
    
    connectedClients.set(socket.id, {
      socket,
      subscribedRooms: new Set(),
    });

    socket.emit(WebSocketEvent.CONNECTED, {
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });

    socket.on('authenticate', (data: { userId: string }) => {
      const client = connectedClients.get(socket.id);
      if (client) {
        client.userId = data.userId;
        socket.join(`user:${data.userId}`);
      }
    });

    socket.on('subscribe', (room: string) => {
      socket.join(room);
      const client = connectedClients.get(socket.id);
      if (client) {
        client.subscribedRooms.add(room);
      }
    });

    socket.on('unsubscribe', (room: string) => {
      socket.leave(room);
      const client = connectedClients.get(socket.id);
      if (client) {
        client.subscribedRooms.delete(room);
      }
    });

    socket.on('disconnect', () => {
      connectedClients.delete(socket.id);
    });
  });

  console.log('[WebSocket] Server initialized');
  return io;
}

export function getIO(): Server | null {
  return io;
}

export function broadcast(event: WebSocketEvent, payload: any): void {
  if (io) {
    io.emit(event, payload);
  }
}

export function emitToRoom(room: string, event: WebSocketEvent, payload: any): void {
  if (io) {
    io.to(room).emit(event, payload);
  }
}

export function emitToUser(userId: string, event: WebSocketEvent, payload: any): void {
  emitToRoom(`user:${userId}`, event, payload);
}

export function getConnectedClientCount(): number {
  return connectedClients.size;
}

export function broadcastCaseCreated(caseData: CasePayload): void {
  broadcast(WebSocketEvent.CASE_CREATED, caseData);
  emitToRoom('ops-inbox', WebSocketEvent.CASE_CREATED, caseData);
}

export function broadcastCaseUpdated(caseData: CasePayload): void {
  broadcast(WebSocketEvent.CASE_UPDATED, caseData);
  emitToRoom('ops-inbox', WebSocketEvent.CASE_UPDATED, caseData);
}

export function broadcastDecisionCreated(decision: DecisionPayload): void {
  broadcast(WebSocketEvent.DECISION_CREATED, decision);
  emitToRoom('decisions', WebSocketEvent.DECISION_CREATED, decision);
}

export function sendNotification(userId: string, notification: NotificationPayload): void {
  emitToUser(userId, WebSocketEvent.NOTIFICATION, notification);
}
