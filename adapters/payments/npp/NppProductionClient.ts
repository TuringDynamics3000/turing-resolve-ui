/**
 * NPP Production Client
 * 
 * Real NPP API integration for production use.
 * 
 * In production, this would connect to:
 * - NPP Basic Infrastructure (BI) via SWIFT
 * - Osko overlay service
 * - PayID resolution service
 * 
 * This implementation provides the structure for real integration
 * while maintaining simulation mode for development.
 */

import type {
  NppCreditTransfer,
  NppPaymentStatusReport,
  NppAdapterConfig,
} from "./NppTypes";
import { DEFAULT_NPP_CONFIG } from "./NppTypes";

// ============================================
// NPP PRODUCTION CONFIG
// ============================================

export interface NppProductionConfig extends NppAdapterConfig {
  // Environment
  environment: "SANDBOX" | "UAT" | "PRODUCTION";
  
  // API endpoints
  apiBaseUrl: string;
  statusCallbackUrl: string;
  
  // Authentication
  clientId: string;
  clientSecret: string;
  certificateThumbprint: string;
  
  // Osko
  oskoServiceUrl?: string;
  
  // PayID
  payIdServiceUrl?: string;
  
  // Retry configuration
  retryConfig: {
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
  
  // Circuit breaker
  circuitBreaker: {
    failureThreshold: number;
    resetTimeoutMs: number;
  };
}

export const NPP_PRODUCTION_CONFIG: NppProductionConfig = {
  ...DEFAULT_NPP_CONFIG,
  environment: "SANDBOX",
  apiBaseUrl: process.env.NPP_API_URL || "https://sandbox.npp.nppa.com.au/api/v1",
  statusCallbackUrl: process.env.NPP_CALLBACK_URL || "https://api.turingdynamics.com/webhooks/npp",
  clientId: process.env.NPP_CLIENT_ID || "",
  clientSecret: process.env.NPP_CLIENT_SECRET || "",
  certificateThumbprint: process.env.NPP_CERT_THUMBPRINT || "",
  oskoServiceUrl: process.env.OSKO_SERVICE_URL,
  payIdServiceUrl: process.env.PAYID_SERVICE_URL,
  retryConfig: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeoutMs: 60000,
  },
};

// ============================================
// CIRCUIT BREAKER
// ============================================

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private lastFailureTime = 0;
  private config: NppProductionConfig["circuitBreaker"];

  constructor(config: NppProductionConfig["circuitBreaker"]) {
    this.config = config;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      // Check if we should try again
      if (Date.now() - this.lastFailureTime > this.config.resetTimeoutMs) {
        this.state = "HALF_OPEN";
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = "OPEN";
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

// ============================================
// NPP PRODUCTION CLIENT
// ============================================

class NppProductionClient {
  private config: NppProductionConfig;
  private circuitBreaker: CircuitBreaker;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: NppProductionConfig = NPP_PRODUCTION_CONFIG) {
    this.config = config;
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
  }

  /**
   * Submit credit transfer to NPP.
   */
  async submitCreditTransfer(message: NppCreditTransfer): Promise<{
    success: boolean;
    messageId?: string;
    schemeReference?: string;
    error?: string;
    errorCode?: string;
  }> {
    // Use simulation in non-production environments
    if (this.config.environment === "SANDBOX") {
      return this.simulateSubmission(message);
    }

    return this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      
      const response = await this.makeRequest("/payments/credit-transfer", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Request-ID": message.messageId,
          "X-Idempotency-Key": message.paymentInformation.paymentInformationId,
        },
        body: JSON.stringify(this.transformToApiFormat(message)),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          messageId: data.messageId,
          schemeReference: data.schemeReference,
        };
      } else {
        const error = await response.json();
        return {
          success: false,
          error: error.message || "NPP submission failed",
          errorCode: error.code || "NPP_ERROR",
        };
      }
    });
  }

  /**
   * Query payment status.
   */
  async queryStatus(messageId: string): Promise<NppPaymentStatusReport | null> {
    if (this.config.environment === "SANDBOX") {
      return this.simulateStatusQuery(messageId);
    }

    return this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      
      const response = await this.makeRequest(`/payments/${messageId}/status`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    });
  }

  /**
   * Resolve PayID to account details.
   */
  async resolvePayId(payIdType: string, payIdValue: string): Promise<{
    success: boolean;
    name?: string;
    bsb?: string;
    accountNumber?: string;
    error?: string;
  }> {
    if (this.config.environment === "SANDBOX") {
      return this.simulatePayIdResolution(payIdType, payIdValue);
    }

    if (!this.config.payIdServiceUrl) {
      return { success: false, error: "PayID service not configured" };
    }

    return this.circuitBreaker.execute(async () => {
      const token = await this.getAccessToken();
      
      const response = await this.makeRequest("/payid/resolve", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: payIdType, value: payIdValue }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          name: data.name,
          bsb: data.bsb,
          accountNumber: data.accountNumber,
        };
      } else {
        return { success: false, error: "PayID not found" };
      }
    });
  }

  /**
   * Health check.
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    environment: string;
    circuitState: CircuitState;
    latencyMs?: number;
    error?: string;
  }> {
    const start = Date.now();

    try {
      if (this.config.environment === "SANDBOX") {
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          healthy: true,
          environment: this.config.environment,
          circuitState: this.circuitBreaker.getState(),
          latencyMs: Date.now() - start,
        };
      }

      const response = await this.makeRequest("/health", { method: "GET" });
      
      return {
        healthy: response.ok,
        environment: this.config.environment,
        circuitState: this.circuitBreaker.getState(),
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        healthy: false,
        environment: this.config.environment,
        circuitState: this.circuitBreaker.getState(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken!;
    }

    // In production, this would call OAuth token endpoint
    if (this.config.environment === "SANDBOX") {
      this.accessToken = "sandbox-token";
      this.tokenExpiry = Date.now() + 3600000; // 1 hour
      return this.accessToken!;
    }

    const response = await fetch(`${this.config.apiBaseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to obtain access token");
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 min buffer
    
    return this.accessToken!;
  }

  private async makeRequest(path: string, options: RequestInit): Promise<Response> {
    const url = `${this.config.apiBaseUrl}${path}`;
    
    // Add retry logic
    let lastError: Error | null = null;
    let delay = this.config.retryConfig.initialDelayMs;

    for (let attempt = 1; attempt <= this.config.retryConfig.maxAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(this.config.readTimeoutMs),
        });
        
        // Don't retry on 4xx errors
        if (response.status >= 400 && response.status < 500) {
          return response;
        }
        
        // Retry on 5xx errors
        if (response.status >= 500 && attempt < this.config.retryConfig.maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * this.config.retryConfig.backoffMultiplier, this.config.retryConfig.maxDelayMs);
          continue;
        }
        
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");
        
        if (attempt < this.config.retryConfig.maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * this.config.retryConfig.backoffMultiplier, this.config.retryConfig.maxDelayMs);
        }
      }
    }

    throw lastError || new Error("Request failed after retries");
  }

  private transformToApiFormat(message: NppCreditTransfer): Record<string, unknown> {
    // Transform to NPP API format
    return {
      messageId: message.messageId,
      creationDateTime: message.creationDateTime,
      paymentInformation: message.paymentInformation,
    };
  }

  // ============================================
  // SIMULATION METHODS
  // ============================================

  private async simulateSubmission(message: NppCreditTransfer): Promise<{
    success: boolean;
    messageId?: string;
    schemeReference?: string;
    error?: string;
    errorCode?: string;
  }> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 95% success rate
    if (Math.random() < 0.95) {
      return {
        success: true,
        messageId: message.messageId,
        schemeReference: `NPP-${Date.now()}-SIM`,
      };
    }
    
    return {
      success: false,
      error: "Simulated NPP failure",
      errorCode: "SIM_FAILURE",
    };
  }

  private async simulateStatusQuery(messageId: string): Promise<NppPaymentStatusReport | null> {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      messageId: `STATUS-${Date.now()}`,
      creationDateTime: new Date().toISOString(),
      originalMessageId: messageId,
      originalMessageNameId: "pacs.008",
      transactionStatus: "ACSC", // Settled
    };
  }

  private async simulatePayIdResolution(type: string, value: string): Promise<{
    success: boolean;
    name?: string;
    bsb?: string;
    accountNumber?: string;
    error?: string;
  }> {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Simulate resolution
    return {
      success: true,
      name: "SIMULATED PAYID USER",
      bsb: "062-000",
      accountNumber: "123456789",
    };
  }
}

export const nppProductionClient = new NppProductionClient();
export default nppProductionClient;
