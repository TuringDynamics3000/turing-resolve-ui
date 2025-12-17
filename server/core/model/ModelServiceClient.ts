/**
 * Model Service Client
 * 
 * Handles communication with external ML model serving infrastructure.
 * Supports multiple backends: TensorFlow Serving, TorchServe, Triton, SageMaker, etc.
 * 
 * Features:
 * - Retry logic with exponential backoff
 * - Circuit breaker for fault tolerance
 * - Latency tracking for monitoring
 * - Request/response logging for audit
 */

import { createHash } from 'crypto';

// ============================================================
// TYPES
// ============================================================

export interface ModelServiceConfig {
  /** Base URL of the model serving endpoint */
  baseUrl: string;
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Initial retry delay in milliseconds */
  initialRetryDelayMs: number;
  /** Circuit breaker failure threshold */
  circuitBreakerThreshold: number;
  /** Circuit breaker reset timeout in milliseconds */
  circuitBreakerResetMs: number;
}

export interface InferenceRequest {
  model_id: string;
  model_version: string;
  features: Record<string, unknown>;
  request_id: string;
  tenant_id: string;
}

export interface InferenceResponse {
  prediction: unknown;
  confidence: number;
  distribution?: Array<{ label: string; probability: number }>;
  model_version: string;
  latency_ms: number;
  served_by: string;
}

export interface ModelServiceMetrics {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  total_latency_ms: number;
  min_latency_ms: number;
  max_latency_ms: number;
  circuit_breaker_trips: number;
  retries: number;
}

// ============================================================
// CIRCUIT BREAKER
// ============================================================

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;

  constructor(
    private readonly threshold: number,
    private readonly resetTimeoutMs: number
  ) {}

  canExecute(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        return true;
      }
      return false;
    }

    // HALF_OPEN - allow one request to test
    return true;
  }

  recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }

  recordFailure(): boolean {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.failureCount >= this.threshold) {
      this.state = CircuitState.OPEN;
      return true; // Circuit tripped
    }

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      return true;
    }

    return false;
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
  }
}

// ============================================================
// MODEL SERVICE CLIENT
// ============================================================

export class ModelServiceClient {
  private readonly config: ModelServiceConfig;
  private readonly circuitBreaker: CircuitBreaker;
  private metrics: ModelServiceMetrics;

  constructor(config: Partial<ModelServiceConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl || process.env.ML_SERVICE_URL || 'http://localhost:8501',
      timeoutMs: config.timeoutMs || 5000,
      maxRetries: config.maxRetries || 3,
      initialRetryDelayMs: config.initialRetryDelayMs || 100,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
      circuitBreakerResetMs: config.circuitBreakerResetMs || 30000,
    };

    this.circuitBreaker = new CircuitBreaker(
      this.config.circuitBreakerThreshold,
      this.config.circuitBreakerResetMs
    );

    this.metrics = {
      total_requests: 0,
      successful_requests: 0,
      failed_requests: 0,
      total_latency_ms: 0,
      min_latency_ms: Infinity,
      max_latency_ms: 0,
      circuit_breaker_trips: 0,
      retries: 0,
    };
  }

  /**
   * Execute inference request with retry and circuit breaker
   */
  async infer(request: InferenceRequest): Promise<InferenceResponse> {
    this.metrics.total_requests++;

    // Check circuit breaker
    if (!this.circuitBreaker.canExecute()) {
      this.metrics.failed_requests++;
      throw new ModelServiceError(
        'CIRCUIT_OPEN',
        'Circuit breaker is open - service unavailable',
        request.model_id
      );
    }

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < this.config.maxRetries) {
      attempt++;

      try {
        const response = await this.executeRequest(request);
        this.circuitBreaker.recordSuccess();
        this.metrics.successful_requests++;
        this.updateLatencyMetrics(response.latency_ms);
        return response;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx)
        if (error instanceof ModelServiceError && error.code === 'CLIENT_ERROR') {
          break;
        }

        // Record failure and check circuit breaker
        const tripped = this.circuitBreaker.recordFailure();
        if (tripped) {
          this.metrics.circuit_breaker_trips++;
        }

        // Exponential backoff
        if (attempt < this.config.maxRetries) {
          this.metrics.retries++;
          const delay = this.config.initialRetryDelayMs * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    this.metrics.failed_requests++;
    throw lastError || new ModelServiceError('UNKNOWN', 'Unknown error', request.model_id);
  }

  /**
   * Execute single request to model service
   */
  private async executeRequest(request: InferenceRequest): Promise<InferenceResponse> {
    const startTime = Date.now();

    // Build request URL based on model service type
    const url = this.buildUrl(request);
    const body = this.buildRequestBody(request);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': request.request_id,
          'X-Tenant-ID': request.tenant_id,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latency_ms = Date.now() - startTime;

      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          throw new ModelServiceError(
            'CLIENT_ERROR',
            `Client error: ${response.status}`,
            request.model_id
          );
        }
        throw new ModelServiceError(
          'SERVER_ERROR',
          `Server error: ${response.status}`,
          request.model_id
        );
      }

      const data = await response.json();
      return this.parseResponse(data, request.model_version, latency_ms);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ModelServiceError) {
        throw error;
      }

      if ((error as Error).name === 'AbortError') {
        throw new ModelServiceError('TIMEOUT', 'Request timed out', request.model_id);
      }

      throw new ModelServiceError(
        'NETWORK_ERROR',
        `Network error: ${(error as Error).message}`,
        request.model_id
      );
    }
  }

  /**
   * Build URL for model service endpoint
   * Supports TensorFlow Serving, TorchServe, and generic REST APIs
   */
  private buildUrl(request: InferenceRequest): string {
    // TensorFlow Serving format
    if (this.config.baseUrl.includes('tensorflow')) {
      return `${this.config.baseUrl}/v1/models/${request.model_id}/versions/${request.model_version}:predict`;
    }

    // TorchServe format
    if (this.config.baseUrl.includes('torchserve')) {
      return `${this.config.baseUrl}/predictions/${request.model_id}`;
    }

    // Generic format
    return `${this.config.baseUrl}/v1/models/${request.model_id}/infer`;
  }

  /**
   * Build request body for model service
   */
  private buildRequestBody(request: InferenceRequest): Record<string, unknown> {
    // TensorFlow Serving format
    if (this.config.baseUrl.includes('tensorflow')) {
      return {
        instances: [request.features],
      };
    }

    // Generic format
    return {
      inputs: request.features,
      parameters: {
        request_id: request.request_id,
        tenant_id: request.tenant_id,
      },
    };
  }

  /**
   * Parse response from model service
   */
  private parseResponse(
    data: Record<string, unknown>,
    model_version: string,
    latency_ms: number
  ): InferenceResponse {
    // TensorFlow Serving format
    if (data.predictions) {
      const predictions = data.predictions as Array<Record<string, number>>;
      const pred = predictions[0];
      return {
        prediction: pred,
        confidence: Math.max(...Object.values(pred)),
        distribution: Object.entries(pred).map(([label, probability]) => ({
          label,
          probability,
        })),
        model_version,
        latency_ms,
        served_by: 'tensorflow-serving',
      };
    }

    // Generic format
    return {
      prediction: data.output || data.prediction,
      confidence: (data.confidence as number) || 0.5,
      distribution: data.distribution as Array<{ label: string; probability: number }>,
      model_version,
      latency_ms,
      served_by: (data.served_by as string) || 'unknown',
    };
  }

  /**
   * Update latency metrics
   */
  private updateLatencyMetrics(latency_ms: number): void {
    this.metrics.total_latency_ms += latency_ms;
    this.metrics.min_latency_ms = Math.min(this.metrics.min_latency_ms, latency_ms);
    this.metrics.max_latency_ms = Math.max(this.metrics.max_latency_ms, latency_ms);
  }

  /**
   * Get current metrics
   */
  getMetrics(): ModelServiceMetrics & { avg_latency_ms: number; circuit_state: string } {
    const avg_latency_ms =
      this.metrics.successful_requests > 0
        ? this.metrics.total_latency_ms / this.metrics.successful_requests
        : 0;

    return {
      ...this.metrics,
      avg_latency_ms,
      circuit_state: this.circuitBreaker.getState(),
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      total_requests: 0,
      successful_requests: 0,
      failed_requests: 0,
      total_latency_ms: 0,
      min_latency_ms: Infinity,
      max_latency_ms: 0,
      circuit_breaker_trips: 0,
      retries: 0,
    };
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number; error?: string }> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.config.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      const latency_ms = Date.now() - startTime;
      return {
        healthy: response.ok,
        latency_ms,
      };
    } catch (error) {
      return {
        healthy: false,
        latency_ms: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================
// ERROR TYPES
// ============================================================

export type ModelServiceErrorCode =
  | 'CIRCUIT_OPEN'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'CLIENT_ERROR'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export class ModelServiceError extends Error {
  constructor(
    public readonly code: ModelServiceErrorCode,
    message: string,
    public readonly model_id: string
  ) {
    super(message);
    this.name = 'ModelServiceError';
  }
}

// ============================================================
// FALLBACK EXECUTOR
// ============================================================

/**
 * Fallback executor for when model service is unavailable
 * Returns a default/conservative prediction
 */
export function createFallbackExecutor(
  fallbackPrediction: unknown = { action: 'REVIEW', score: 0.5 }
): (features: Record<string, unknown>) => Promise<InferenceResponse> {
  return async (features: Record<string, unknown>): Promise<InferenceResponse> => {
    // Simulate minimal latency
    await new Promise((resolve) => setTimeout(resolve, 5));

    return {
      prediction: fallbackPrediction,
      confidence: 0.5,
      distribution: [
        { label: 'APPROVE', probability: 0.25 },
        { label: 'REVIEW', probability: 0.5 },
        { label: 'DECLINE', probability: 0.25 },
      ],
      model_version: 'fallback',
      latency_ms: 5,
      served_by: 'fallback-executor',
    };
  };
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

let modelServiceClient: ModelServiceClient | null = null;

export function getModelServiceClient(): ModelServiceClient {
  if (!modelServiceClient) {
    modelServiceClient = new ModelServiceClient();
  }
  return modelServiceClient;
}

export function resetModelServiceClient(): void {
  modelServiceClient = null;
}
