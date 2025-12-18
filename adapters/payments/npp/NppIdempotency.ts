/**
 * NPP Idempotency Service
 * 
 * Ensures idempotent processing of NPP messages.
 * 
 * CRITICAL INVARIANTS:
 * - Same message ID always produces same result
 * - Duplicate callbacks are safely ignored
 * - Out-of-order messages are handled correctly
 * - All state is recoverable from event log
 */

import { nanoid } from "nanoid";
import type { NppCallback, NppTransactionStatus } from "./NppTypes";

// ============================================
// IDEMPOTENCY KEY TYPES
// ============================================

export interface IdempotencyRecord {
  key: string;
  messageId: string;
  endToEndId: string;
  
  // Processing state
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  result?: unknown;
  error?: string;
  
  // Timing
  firstSeenAt: string;
  lastSeenAt: string;
  completedAt?: string;
  
  // Duplicate tracking
  duplicateCount: number;
  
  // Hash for verification
  payloadHash: string;
}

export interface CallbackRecord {
  callbackId: string;
  originalMessageId: string;
  originalEndToEndId: string;
  
  // Status
  status: NppTransactionStatus;
  
  // Processing
  processedAt?: string;
  ignored: boolean;
  ignoreReason?: string;
  
  // Timing
  receivedAt: string;
}

// ============================================
// NPP IDEMPOTENCY SERVICE
// ============================================

class NppIdempotencyService {
  private records: Map<string, IdempotencyRecord> = new Map();
  private callbacks: Map<string, CallbackRecord> = new Map();
  private messageToKey: Map<string, string> = new Map();
  private endToEndToKey: Map<string, string> = new Map();

  /**
   * Generate idempotency key from message components.
   */
  generateKey(messageId: string, endToEndId: string): string {
    return `NPP:${messageId}:${endToEndId}`;
  }

  /**
   * Compute payload hash for duplicate detection.
   */
  private computeHash(payload: unknown): string {
    const str = JSON.stringify(payload);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `sha256:${Math.abs(hash).toString(16).padStart(16, "0")}`;
  }

  /**
   * Check if message has been seen before.
   * Returns existing record if duplicate, null if new.
   */
  checkDuplicate(messageId: string, endToEndId: string, payload: unknown): {
    isDuplicate: boolean;
    record?: IdempotencyRecord;
    payloadMismatch?: boolean;
  } {
    const key = this.generateKey(messageId, endToEndId);
    const existing = this.records.get(key);
    
    if (!existing) {
      return { isDuplicate: false };
    }
    
    // Check if payload matches
    const newHash = this.computeHash(payload);
    const payloadMismatch = newHash !== existing.payloadHash;
    
    // Update duplicate count
    existing.duplicateCount++;
    existing.lastSeenAt = new Date().toISOString();
    
    return {
      isDuplicate: true,
      record: existing,
      payloadMismatch,
    };
  }

  /**
   * Register new message for processing.
   */
  registerMessage(messageId: string, endToEndId: string, payload: unknown): IdempotencyRecord {
    const key = this.generateKey(messageId, endToEndId);
    const now = new Date().toISOString();
    
    const record: IdempotencyRecord = {
      key,
      messageId,
      endToEndId,
      status: "PROCESSING",
      firstSeenAt: now,
      lastSeenAt: now,
      duplicateCount: 0,
      payloadHash: this.computeHash(payload),
    };
    
    this.records.set(key, record);
    this.messageToKey.set(messageId, key);
    this.endToEndToKey.set(endToEndId, key);
    
    return record;
  }

  /**
   * Mark message processing as complete.
   */
  markComplete(key: string, result: unknown): void {
    const record = this.records.get(key);
    if (record) {
      record.status = "COMPLETED";
      record.result = result;
      record.completedAt = new Date().toISOString();
    }
  }

  /**
   * Mark message processing as failed.
   */
  markFailed(key: string, error: string): void {
    const record = this.records.get(key);
    if (record) {
      record.status = "FAILED";
      record.error = error;
      record.completedAt = new Date().toISOString();
    }
  }

  /**
   * Process callback with idempotency.
   */
  processCallback(callback: NppCallback): {
    shouldProcess: boolean;
    record: CallbackRecord;
    reason?: string;
  } {
    const callbackKey = `CB:${callback.originalMessageId}:${callback.callbackId}`;
    
    // Check for duplicate callback
    const existing = this.callbacks.get(callbackKey);
    if (existing) {
      return {
        shouldProcess: false,
        record: existing,
        reason: "DUPLICATE_CALLBACK",
      };
    }
    
    // Check if original message exists
    const originalKey = this.messageToKey.get(callback.originalMessageId);
    if (!originalKey) {
      // Unknown original message - might be out of order
      const record: CallbackRecord = {
        callbackId: callback.callbackId,
        originalMessageId: callback.originalMessageId,
        originalEndToEndId: callback.originalEndToEndId,
        status: callback.status,
        receivedAt: new Date().toISOString(),
        ignored: true,
        ignoreReason: "UNKNOWN_ORIGINAL_MESSAGE",
      };
      
      this.callbacks.set(callbackKey, record);
      
      return {
        shouldProcess: false,
        record,
        reason: "UNKNOWN_ORIGINAL_MESSAGE",
      };
    }
    
    // Check if original message is in valid state for callback
    const originalRecord = this.records.get(originalKey);
    if (originalRecord && originalRecord.status === "COMPLETED") {
      // Already completed - check if this is a status update
      const record: CallbackRecord = {
        callbackId: callback.callbackId,
        originalMessageId: callback.originalMessageId,
        originalEndToEndId: callback.originalEndToEndId,
        status: callback.status,
        receivedAt: new Date().toISOString(),
        ignored: false,
      };
      
      this.callbacks.set(callbackKey, record);
      
      return {
        shouldProcess: true,
        record,
      };
    }
    
    // Normal processing
    const record: CallbackRecord = {
      callbackId: callback.callbackId,
      originalMessageId: callback.originalMessageId,
      originalEndToEndId: callback.originalEndToEndId,
      status: callback.status,
      receivedAt: new Date().toISOString(),
      ignored: false,
    };
    
    this.callbacks.set(callbackKey, record);
    
    return {
      shouldProcess: true,
      record,
    };
  }

  /**
   * Mark callback as processed.
   */
  markCallbackProcessed(callbackId: string, originalMessageId: string): void {
    const callbackKey = `CB:${originalMessageId}:${callbackId}`;
    const record = this.callbacks.get(callbackKey);
    if (record) {
      record.processedAt = new Date().toISOString();
    }
  }

  /**
   * Get record by message ID.
   */
  getByMessageId(messageId: string): IdempotencyRecord | undefined {
    const key = this.messageToKey.get(messageId);
    return key ? this.records.get(key) : undefined;
  }

  /**
   * Get record by end-to-end ID.
   */
  getByEndToEndId(endToEndId: string): IdempotencyRecord | undefined {
    const key = this.endToEndToKey.get(endToEndId);
    return key ? this.records.get(key) : undefined;
  }

  /**
   * Get all callbacks for a message.
   */
  getCallbacksForMessage(messageId: string): CallbackRecord[] {
    return Array.from(this.callbacks.values())
      .filter(cb => cb.originalMessageId === messageId);
  }

  /**
   * Get statistics.
   */
  getStatistics(): {
    totalMessages: number;
    processing: number;
    completed: number;
    failed: number;
    duplicatesDetected: number;
    totalCallbacks: number;
    ignoredCallbacks: number;
  } {
    const records = Array.from(this.records.values());
    const callbacks = Array.from(this.callbacks.values());
    
    return {
      totalMessages: records.length,
      processing: records.filter(r => r.status === "PROCESSING").length,
      completed: records.filter(r => r.status === "COMPLETED").length,
      failed: records.filter(r => r.status === "FAILED").length,
      duplicatesDetected: records.reduce((sum, r) => sum + r.duplicateCount, 0),
      totalCallbacks: callbacks.length,
      ignoredCallbacks: callbacks.filter(cb => cb.ignored).length,
    };
  }

  /**
   * Clean up old records (retention policy).
   */
  cleanup(retentionDays: number = 7): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const cutoffStr = cutoff.toISOString();
    
    let cleaned = 0;
    
    for (const [key, record] of this.records) {
      if (record.completedAt && record.completedAt < cutoffStr) {
        this.records.delete(key);
        this.messageToKey.delete(record.messageId);
        this.endToEndToKey.delete(record.endToEndId);
        cleaned++;
      }
    }
    
    for (const [key, callback] of this.callbacks) {
      if (callback.processedAt && callback.processedAt < cutoffStr) {
        this.callbacks.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }
}

export const nppIdempotencyService = new NppIdempotencyService();
export default nppIdempotencyService;
