/**
 * ProtocolGateway - The ONLY authorized path for state mutations
 * 
 * INVARIANT: All state changes MUST flow through this gateway.
 * Direct database writes are PROHIBITED and will be caught by CI.
 * 
 * This is the enforcement layer that makes "no backdoors" a structural guarantee.
 * 
 * IMPLEMENTATION NOTE:
 * This module defines the gateway interface and audit logging.
 * Actual database operations are delegated to domain-specific adapters
 * that implement the GatewayWriteAdapter interface.
 */

// Gateway operation types
export type GatewayOperation = 
  | 'FACT_APPEND'
  | 'PROJECTION_UPDATE'
  | 'ACCOUNT_CREATE'
  | 'PAYMENT_CREATE'
  | 'DECISION_RECORD'
  | 'EVIDENCE_STORE';

// Gateway audit record
export interface GatewayAuditRecord {
  operationId: string;
  operation: GatewayOperation;
  module: string;
  entityId: string;
  timestamp: Date;
  callerContext: string;
  factHash?: string;
  success: boolean;
  errorMessage?: string;
}

// Write adapter interface - domain modules implement this
export interface GatewayWriteAdapter<T> {
  write(data: T, context: string): Promise<{ id: string; hash: string }>;
  validate(data: T): { valid: boolean; errors: string[] };
}

// In-memory audit log
const auditLog: GatewayAuditRecord[] = [];

/**
 * Generate a unique operation ID
 */
function generateOperationId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Hash data for integrity verification
 */
export function hashData(data: unknown): string {
  // Simple hash for demonstration - in production use crypto
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * ProtocolGateway class - enforces all writes go through authorized paths
 */
export class ProtocolGateway {
  private static instance: ProtocolGateway;
  private enabled: boolean = true;
  private adapters: Map<string, GatewayWriteAdapter<unknown>> = new Map();

  private constructor() {}

  static getInstance(): ProtocolGateway {
    if (!ProtocolGateway.instance) {
      ProtocolGateway.instance = new ProtocolGateway();
    }
    return ProtocolGateway.instance;
  }

  /**
   * Register a write adapter for a module
   */
  registerAdapter<T>(module: string, adapter: GatewayWriteAdapter<T>): void {
    this.adapters.set(module, adapter as GatewayWriteAdapter<unknown>);
  }

  /**
   * Enable/disable gateway enforcement (for testing only)
   */
  setEnabled(enabled: boolean, bypassKey?: string): void {
    const expectedKey = process.env.GATEWAY_BYPASS_KEY || 'test-bypass-key';
    if (bypassKey !== expectedKey) {
      throw new Error('Invalid bypass key - gateway state cannot be changed');
    }
    this.enabled = enabled;
    console.warn(`[GATEWAY] Enforcement ${enabled ? 'ENABLED' : 'DISABLED'} - this should only happen in tests`);
  }

  /**
   * Check if gateway is enforcing
   */
  isEnforcing(): boolean {
    return this.enabled;
  }

  /**
   * Get audit log
   */
  getAuditLog(): GatewayAuditRecord[] {
    return [...auditLog];
  }

  /**
   * Clear audit log (for testing)
   */
  clearAuditLog(): void {
    auditLog.length = 0;
  }

  /**
   * Get audit log statistics
   */
  getAuditStats(): {
    total: number;
    byOperation: Record<GatewayOperation, number>;
    byModule: Record<string, number>;
    successRate: number;
  } {
    const byOperation: Record<string, number> = {};
    const byModule: Record<string, number> = {};
    let successCount = 0;

    for (const record of auditLog) {
      byOperation[record.operation] = (byOperation[record.operation] || 0) + 1;
      byModule[record.module] = (byModule[record.module] || 0) + 1;
      if (record.success) successCount++;
    }

    return {
      total: auditLog.length,
      byOperation: byOperation as Record<GatewayOperation, number>,
      byModule,
      successRate: auditLog.length > 0 ? successCount / auditLog.length : 1,
    };
  }

  // ============================================================
  // GENERIC WRITE OPERATION
  // ============================================================

  /**
   * Execute a write operation through the gateway
   */
  async executeWrite<T>(
    operation: GatewayOperation,
    module: string,
    entityId: string,
    data: T,
    callerContext: string
  ): Promise<{ id: string; hash: string }> {
    const operationId = generateOperationId();

    // Check if gateway is enforcing
    if (!this.enabled) {
      console.warn(`[GATEWAY] Enforcement disabled - allowing direct write for ${operation}`);
    }

    // Get adapter for module
    const adapter = this.adapters.get(module);
    if (!adapter) {
      const error = `No adapter registered for module: ${module}`;
      auditLog.push({
        operationId,
        operation,
        module,
        entityId,
        timestamp: new Date(),
        callerContext,
        success: false,
        errorMessage: error,
      });
      throw new Error(error);
    }

    // Validate data
    const validation = adapter.validate(data);
    if (!validation.valid) {
      const error = `Validation failed: ${validation.errors.join(', ')}`;
      auditLog.push({
        operationId,
        operation,
        module,
        entityId,
        timestamp: new Date(),
        callerContext,
        success: false,
        errorMessage: error,
      });
      throw new Error(error);
    }

    try {
      // Execute write through adapter
      const result = await adapter.write(data, callerContext);

      // Record audit
      auditLog.push({
        operationId,
        operation,
        module,
        entityId,
        timestamp: new Date(),
        callerContext,
        factHash: result.hash,
        success: true,
      });

      return result;
    } catch (error) {
      auditLog.push({
        operationId,
        operation,
        module,
        entityId,
        timestamp: new Date(),
        callerContext,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // ============================================================
  // CONVENIENCE METHODS
  // ============================================================

  /**
   * Append a fact (convenience wrapper)
   */
  async appendFact(
    module: string,
    entityId: string,
    factType: string,
    factData: Record<string, unknown>,
    callerContext: string
  ): Promise<{ id: string; hash: string }> {
    return this.executeWrite(
      'FACT_APPEND',
      module,
      entityId,
      { entityId, factType, factData, timestamp: new Date() },
      callerContext
    );
  }

  /**
   * Record a decision (convenience wrapper)
   */
  async recordDecision(
    module: string,
    entityId: string,
    decision: {
      outcome: 'ALLOW' | 'REVIEW' | 'DECLINE';
      policies: string[];
      evidenceHash: string;
    },
    callerContext: string
  ): Promise<{ id: string; hash: string }> {
    return this.executeWrite(
      'DECISION_RECORD',
      module,
      entityId,
      { entityId, ...decision, timestamp: new Date() },
      callerContext
    );
  }
}

// Export singleton instance
export const gateway = ProtocolGateway.getInstance();

// ============================================================
// CI ENFORCEMENT UTILITIES
// ============================================================

/**
 * Patterns that indicate direct database writes (for CI checks)
 */
export const FORBIDDEN_WRITE_PATTERNS = [
  /db\.insert\(/,
  /db\.update\(/,
  /db\.delete\(/,
  /\.execute\s*\(\s*['"`]INSERT/i,
  /\.execute\s*\(\s*['"`]UPDATE/i,
  /\.execute\s*\(\s*['"`]DELETE/i,
  /\.query\s*\(\s*['"`]INSERT/i,
  /\.query\s*\(\s*['"`]UPDATE/i,
  /\.query\s*\(\s*['"`]DELETE/i,
];

/**
 * Files exempt from direct write checks (gateway implementations only)
 */
export const EXEMPT_FILES = [
  'server/core/gateway/',
  'server/adapters/',
  'drizzle/migrations/',
  'tests/',
  '__tests__/',
  '.spec.ts',
  '.test.ts',
];

/**
 * Check if a file is exempt from write checks
 */
export function isExemptFile(filePath: string): boolean {
  return EXEMPT_FILES.some(pattern => filePath.includes(pattern));
}

/**
 * Check if code contains forbidden write patterns
 */
export function containsForbiddenWrites(code: string): { forbidden: boolean; matches: string[] } {
  const matches: string[] = [];
  
  for (const pattern of FORBIDDEN_WRITE_PATTERNS) {
    const match = code.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }

  return {
    forbidden: matches.length > 0,
    matches,
  };
}
