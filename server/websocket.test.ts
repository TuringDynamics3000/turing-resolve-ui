import { describe, it, expect } from 'vitest';
import {
  WebSocketEvent,
  CasePayload,
  DecisionPayload,
  NotificationPayload,
} from './websocket';

describe('WebSocket Module', () => {
  describe('WebSocketEvent enum', () => {
    it('should have all case event types', () => {
      expect(WebSocketEvent.CASE_CREATED).toBe('case:created');
      expect(WebSocketEvent.CASE_UPDATED).toBe('case:updated');
      expect(WebSocketEvent.CASE_ASSIGNED).toBe('case:assigned');
      expect(WebSocketEvent.CASE_RESOLVED).toBe('case:resolved');
    });

    it('should have all decision event types', () => {
      expect(WebSocketEvent.DECISION_CREATED).toBe('decision:created');
      expect(WebSocketEvent.DECISION_UPDATED).toBe('decision:updated');
    });

    it('should have notification and system event types', () => {
      expect(WebSocketEvent.NOTIFICATION).toBe('notification');
      expect(WebSocketEvent.SYSTEM_ALERT).toBe('system:alert');
      expect(WebSocketEvent.MODEL_STATUS_CHANGED).toBe('model:status_changed');
    });

    it('should have connection event types', () => {
      expect(WebSocketEvent.CONNECTED).toBe('connected');
      expect(WebSocketEvent.DISCONNECTED).toBe('disconnected');
    });
  });

  describe('CasePayload type validation', () => {
    it('should accept valid case payload with required fields', () => {
      const payload: CasePayload = {
        id: 'case-001',
        type: 'EXCEPTION',
        priority: 'HIGH',
        status: 'OPEN',
        title: 'Test Case',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      expect(payload.id).toBe('case-001');
      expect(payload.type).toBe('EXCEPTION');
      expect(payload.priority).toBe('HIGH');
    });

    it('should support all priority levels', () => {
      const priorities: CasePayload['priority'][] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      priorities.forEach(priority => {
        const payload: CasePayload = {
          id: `case-${priority}`,
          type: 'EXCEPTION',
          priority,
          status: 'OPEN',
          title: `${priority} Priority Case`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        expect(payload.priority).toBe(priority);
      });
    });
  });

  describe('DecisionPayload type validation', () => {
    it('should accept valid decision payload', () => {
      const payload: DecisionPayload = {
        id: 'dec-001',
        outcome: 'ALLOW',
        policyId: 'policy-lending-001',
        timestamp: '2024-01-01T00:00:00Z',
        entityId: 'loan-123',
        entityType: 'LOAN_APPLICATION',
      };
      expect(payload.id).toBe('dec-001');
      expect(payload.outcome).toBe('ALLOW');
    });

    it('should support all outcome types', () => {
      const outcomes: DecisionPayload['outcome'][] = ['ALLOW', 'DECLINE', 'REVIEW'];
      outcomes.forEach(outcome => {
        const payload: DecisionPayload = {
          id: `dec-${outcome}`,
          outcome,
          policyId: 'policy-001',
          timestamp: new Date().toISOString(),
          entityId: 'entity-001',
          entityType: 'PAYMENT',
        };
        expect(payload.outcome).toBe(outcome);
      });
    });
  });

  describe('NotificationPayload type validation', () => {
    it('should accept valid notification payload', () => {
      const payload: NotificationPayload = {
        id: 'notif-001',
        type: 'info',
        title: 'New Case Assigned',
        message: 'Case CASE-001 has been assigned to you',
        timestamp: '2024-01-01T00:00:00Z',
      };
      expect(payload.id).toBe('notif-001');
      expect(payload.type).toBe('info');
    });

    it('should support all notification types', () => {
      const types: NotificationPayload['type'][] = ['info', 'warning', 'error', 'success'];
      types.forEach(type => {
        const payload: NotificationPayload = {
          id: `notif-${type}`,
          type,
          title: `${type} Notification`,
          message: `This is a ${type} notification`,
          timestamp: new Date().toISOString(),
        };
        expect(payload.type).toBe(type);
      });
    });
  });

  describe('Event naming conventions', () => {
    it('should have consistent case event namespace', () => {
      expect(WebSocketEvent.CASE_CREATED).toMatch(/^case:/);
      expect(WebSocketEvent.CASE_UPDATED).toMatch(/^case:/);
      expect(WebSocketEvent.CASE_ASSIGNED).toMatch(/^case:/);
      expect(WebSocketEvent.CASE_RESOLVED).toMatch(/^case:/);
    });

    it('should have consistent decision event namespace', () => {
      expect(WebSocketEvent.DECISION_CREATED).toMatch(/^decision:/);
      expect(WebSocketEvent.DECISION_UPDATED).toMatch(/^decision:/);
    });
  });
});
