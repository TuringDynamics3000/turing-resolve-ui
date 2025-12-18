/**
 * Scheme Adapter Interface
 * 
 * Defines the contract for all payment scheme adapters.
 * Each adapter (NPP, BECS, RTGS, CARDS) must implement this interface.
 * 
 * CRITICAL INVARIANTS:
 * - All adapters are stateless
 * - All adapters are idempotent
 * - Adapters emit PaymentFacts only
 * - Adapters do not mutate balances
 */

import type { Payment, PaymentScheme } from "./PaymentsSpine";

// ============================================
// SCHEME ADAPTER INTERFACE
// ============================================

export interface SchemeSubmissionResult {
  success: boolean;
  messageId?: string;
  schemeReference?: string;
  error?: string;
  errorCode?: string;
}

export interface SchemeCallbackResult {
  processed: boolean;
  paymentId?: string;
  newStatus?: "PENDING" | "SETTLED" | "FAILED";
  fact?: {
    factType: string;
    factData: Record<string, unknown>;
  };
  ignored?: boolean;
  ignoreReason?: string;
  error?: string;
}

export interface SchemeHealthCheck {
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

export interface SchemeAdapter {
  /**
   * The scheme this adapter handles.
   */
  readonly scheme: PaymentScheme;

  /**
   * Submit a payment to the scheme.
   * Must be idempotent - same payment always produces same result.
   */
  submit(payment: Payment): Promise<SchemeSubmissionResult>;

  /**
   * Handle a callback from the scheme (status update, settlement, failure).
   * Must be idempotent - same callback always produces same result.
   */
  handleCallback(callbackData: unknown): Promise<SchemeCallbackResult>;

  /**
   * Check the health of the scheme connection.
   */
  healthCheck(): Promise<SchemeHealthCheck>;

  /**
   * Get adapter statistics.
   */
  getStatistics(): Record<string, unknown>;
}

// ============================================
// SCHEME ADAPTER REGISTRY
// ============================================

class SchemeAdapterRegistry {
  private adapters: Map<PaymentScheme, SchemeAdapter> = new Map();

  /**
   * Register a scheme adapter.
   */
  register(adapter: SchemeAdapter): void {
    this.adapters.set(adapter.scheme, adapter);
  }

  /**
   * Get adapter for a scheme.
   */
  get(scheme: PaymentScheme): SchemeAdapter | undefined {
    return this.adapters.get(scheme);
  }

  /**
   * Check if adapter is registered for scheme.
   */
  has(scheme: PaymentScheme): boolean {
    return this.adapters.has(scheme);
  }

  /**
   * Get all registered schemes.
   */
  getRegisteredSchemes(): PaymentScheme[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Health check all adapters.
   */
  async healthCheckAll(): Promise<Record<PaymentScheme, SchemeHealthCheck>> {
    const results: Record<string, SchemeHealthCheck> = {};
    
    for (const [scheme, adapter] of this.adapters) {
      results[scheme] = await adapter.healthCheck();
    }
    
    return results as Record<PaymentScheme, SchemeHealthCheck>;
  }
}

export const schemeAdapterRegistry = new SchemeAdapterRegistry();
export default schemeAdapterRegistry;
