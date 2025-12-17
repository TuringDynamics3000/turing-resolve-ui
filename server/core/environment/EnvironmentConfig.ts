/**
 * EnvironmentConfig - Environment isolation and IAM separation
 * 
 * INVARIANT: Each environment (dev, staging, prod) has isolated credentials.
 * Cross-environment access is PROHIBITED.
 * 
 * This module enforces:
 * 1. Environment detection and validation
 * 2. Credential isolation per environment
 * 3. Environment-specific configuration
 * 4. Startup validation to prevent misconfiguration
 */

// Environment types
export type Environment = 'development' | 'staging' | 'production';

// Environment-specific configuration
export interface EnvironmentConfiguration {
  environment: Environment;
  
  // Database
  database: {
    host: string;
    port: number;
    name: string;
    sslRequired: boolean;
    maxConnections: number;
  };
  
  // API
  api: {
    baseUrl: string;
    rateLimit: number;
    corsOrigins: string[];
  };
  
  // Auth
  auth: {
    jwtIssuer: string;
    jwtAudience: string;
    sessionTimeout: number; // seconds
  };
  
  // Features
  features: {
    shadowMode: boolean;
    debugLogging: boolean;
    mockExternalServices: boolean;
    allowDirectDbAccess: boolean; // MUST be false in production
  };
  
  // Governance
  governance: {
    requireDecisionGate: boolean;
    requireEvidencePack: boolean;
    allowHumanOverride: boolean;
    auditRetentionDays: number;
  };
}

// Credential set per environment
export interface EnvironmentCredentials {
  environment: Environment;
  
  // Database credentials
  databaseUrl: string;
  databaseReadReplicaUrl?: string;
  
  // API keys
  apiKey: string;
  apiSecret: string;
  
  // External service credentials
  paymentGatewayKey?: string;
  nppCredentials?: {
    participantId: string;
    signingKey: string;
  };
  
  // Encryption
  encryptionKey: string;
  
  // Audit
  auditLogEndpoint?: string;
}

/**
 * Environment detection from NODE_ENV and validation
 */
export function detectEnvironment(): Environment {
  const nodeEnv = process.env.NODE_ENV?.toLowerCase();
  const turingEnv = process.env.TURING_ENVIRONMENT?.toLowerCase();
  
  // TURING_ENVIRONMENT takes precedence if set
  if (turingEnv) {
    if (!['development', 'staging', 'production'].includes(turingEnv)) {
      throw new Error(`Invalid TURING_ENVIRONMENT: ${turingEnv}`);
    }
    return turingEnv as Environment;
  }
  
  // Fall back to NODE_ENV mapping
  switch (nodeEnv) {
    case 'production':
      return 'production';
    case 'staging':
    case 'test':
      return 'staging';
    default:
      return 'development';
  }
}

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig(env: Environment): EnvironmentConfiguration {
  const configs: Record<Environment, EnvironmentConfiguration> = {
    development: {
      environment: 'development',
      database: {
        host: 'localhost',
        port: 5432,
        name: 'turingcore_dev',
        sslRequired: false,
        maxConnections: 10,
      },
      api: {
        baseUrl: 'http://localhost:3000',
        rateLimit: 1000,
        corsOrigins: ['http://localhost:3000', 'http://localhost:5173'],
      },
      auth: {
        jwtIssuer: 'turingcore-dev',
        jwtAudience: 'turingcore-dev',
        sessionTimeout: 86400, // 24 hours
      },
      features: {
        shadowMode: true,
        debugLogging: true,
        mockExternalServices: true,
        allowDirectDbAccess: true, // Only in dev
      },
      governance: {
        requireDecisionGate: false, // Relaxed in dev
        requireEvidencePack: false,
        allowHumanOverride: true,
        auditRetentionDays: 7,
      },
    },
    
    staging: {
      environment: 'staging',
      database: {
        host: process.env.STAGING_DB_HOST || 'staging-db.turingdynamics.internal',
        port: 5432,
        name: 'turingcore_staging',
        sslRequired: true,
        maxConnections: 25,
      },
      api: {
        baseUrl: 'https://staging-api.turingdynamics.com',
        rateLimit: 500,
        corsOrigins: ['https://staging.turingdynamics.com'],
      },
      auth: {
        jwtIssuer: 'turingcore-staging',
        jwtAudience: 'turingcore-staging',
        sessionTimeout: 3600, // 1 hour
      },
      features: {
        shadowMode: true,
        debugLogging: true,
        mockExternalServices: false,
        allowDirectDbAccess: false, // Enforced
      },
      governance: {
        requireDecisionGate: true,
        requireEvidencePack: true,
        allowHumanOverride: true,
        auditRetentionDays: 30,
      },
    },
    
    production: {
      environment: 'production',
      database: {
        host: process.env.PROD_DB_HOST || 'prod-db.turingdynamics.internal',
        port: 5432,
        name: 'turingcore_prod',
        sslRequired: true,
        maxConnections: 100,
      },
      api: {
        baseUrl: 'https://api.turingdynamics.com',
        rateLimit: 100,
        corsOrigins: ['https://app.turingdynamics.com'],
      },
      auth: {
        jwtIssuer: 'turingcore-prod',
        jwtAudience: 'turingcore-prod',
        sessionTimeout: 1800, // 30 minutes
      },
      features: {
        shadowMode: false,
        debugLogging: false,
        mockExternalServices: false,
        allowDirectDbAccess: false, // NEVER in production
      },
      governance: {
        requireDecisionGate: true,
        requireEvidencePack: true,
        allowHumanOverride: false, // Requires approval workflow
        auditRetentionDays: 2555, // 7 years
      },
    },
  };
  
  return configs[env];
}

/**
 * Validate environment credentials exist and are properly isolated
 */
export function validateCredentials(env: Environment): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const prefix = env.toUpperCase();
  
  // Required credentials per environment
  const requiredVars = [
    `${prefix}_DATABASE_URL`,
    `${prefix}_API_KEY`,
    `${prefix}_API_SECRET`,
    `${prefix}_ENCRYPTION_KEY`,
  ];
  
  // Check required vars exist
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      errors.push(`Missing required credential: ${varName}`);
    }
  }
  
  // Production-specific requirements
  if (env === 'production') {
    if (!process.env.PROD_NPP_PARTICIPANT_ID) {
      errors.push('Missing PROD_NPP_PARTICIPANT_ID for production');
    }
    if (!process.env.PROD_NPP_SIGNING_KEY) {
      errors.push('Missing PROD_NPP_SIGNING_KEY for production');
    }
    if (!process.env.PROD_AUDIT_LOG_ENDPOINT) {
      errors.push('Missing PROD_AUDIT_LOG_ENDPOINT for production');
    }
  }
  
  // Cross-environment contamination check
  if (env === 'production') {
    if (process.env.PROD_DATABASE_URL?.includes('staging') || 
        process.env.PROD_DATABASE_URL?.includes('dev') ||
        process.env.PROD_DATABASE_URL?.includes('localhost')) {
      errors.push('CRITICAL: Production database URL appears to point to non-production environment');
    }
  }
  
  if (env === 'staging') {
    if (process.env.STAGING_DATABASE_URL?.includes('prod')) {
      errors.push('CRITICAL: Staging database URL appears to point to production');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get credentials for the current environment
 */
export function getCredentials(env: Environment): EnvironmentCredentials {
  const prefix = env.toUpperCase();
  
  return {
    environment: env,
    databaseUrl: process.env[`${prefix}_DATABASE_URL`] || '',
    databaseReadReplicaUrl: process.env[`${prefix}_DATABASE_READ_REPLICA_URL`],
    apiKey: process.env[`${prefix}_API_KEY`] || '',
    apiSecret: process.env[`${prefix}_API_SECRET`] || '',
    paymentGatewayKey: process.env[`${prefix}_PAYMENT_GATEWAY_KEY`],
    nppCredentials: process.env[`${prefix}_NPP_PARTICIPANT_ID`] ? {
      participantId: process.env[`${prefix}_NPP_PARTICIPANT_ID`]!,
      signingKey: process.env[`${prefix}_NPP_SIGNING_KEY`] || '',
    } : undefined,
    encryptionKey: process.env[`${prefix}_ENCRYPTION_KEY`] || '',
    auditLogEndpoint: process.env[`${prefix}_AUDIT_LOG_ENDPOINT`],
  };
}

/**
 * Startup validation - call this at application startup
 */
export function validateEnvironmentOnStartup(): void {
  const env = detectEnvironment();
  const config = getEnvironmentConfig(env);
  const credentialValidation = validateCredentials(env);
  
  console.log(`[Environment] Detected environment: ${env}`);
  console.log(`[Environment] Configuration loaded for: ${config.environment}`);
  
  // Log feature flags
  console.log(`[Environment] Features:`);
  console.log(`  - Shadow Mode: ${config.features.shadowMode}`);
  console.log(`  - Debug Logging: ${config.features.debugLogging}`);
  console.log(`  - Mock External Services: ${config.features.mockExternalServices}`);
  console.log(`  - Allow Direct DB Access: ${config.features.allowDirectDbAccess}`);
  
  // Log governance settings
  console.log(`[Environment] Governance:`);
  console.log(`  - Require Decision Gate: ${config.governance.requireDecisionGate}`);
  console.log(`  - Require Evidence Pack: ${config.governance.requireEvidencePack}`);
  console.log(`  - Allow Human Override: ${config.governance.allowHumanOverride}`);
  
  // Validate credentials
  if (!credentialValidation.valid) {
    console.error(`[Environment] Credential validation failed:`);
    for (const error of credentialValidation.errors) {
      console.error(`  - ${error}`);
    }
    
    // In production, fail hard on credential errors
    if (env === 'production') {
      throw new Error('Production startup blocked: credential validation failed');
    } else {
      console.warn(`[Environment] Continuing with warnings in ${env} environment`);
    }
  } else {
    console.log(`[Environment] Credential validation passed`);
  }
  
  // Production-specific checks
  if (env === 'production') {
    if (config.features.allowDirectDbAccess) {
      throw new Error('CRITICAL: allowDirectDbAccess must be false in production');
    }
    if (config.features.mockExternalServices) {
      throw new Error('CRITICAL: mockExternalServices must be false in production');
    }
    if (!config.governance.requireDecisionGate) {
      throw new Error('CRITICAL: requireDecisionGate must be true in production');
    }
    if (!config.governance.requireEvidencePack) {
      throw new Error('CRITICAL: requireEvidencePack must be true in production');
    }
  }
  
  console.log(`[Environment] Startup validation complete for ${env}`);
}

/**
 * EnvironmentGuard - Runtime enforcement of environment boundaries
 */
export class EnvironmentGuard {
  private static instance: EnvironmentGuard;
  private environment: Environment;
  private config: EnvironmentConfiguration;
  
  private constructor() {
    this.environment = detectEnvironment();
    this.config = getEnvironmentConfig(this.environment);
  }
  
  static getInstance(): EnvironmentGuard {
    if (!EnvironmentGuard.instance) {
      EnvironmentGuard.instance = new EnvironmentGuard();
    }
    return EnvironmentGuard.instance;
  }
  
  getEnvironment(): Environment {
    return this.environment;
  }
  
  getConfig(): EnvironmentConfiguration {
    return this.config;
  }
  
  isProduction(): boolean {
    return this.environment === 'production';
  }
  
  isStaging(): boolean {
    return this.environment === 'staging';
  }
  
  isDevelopment(): boolean {
    return this.environment === 'development';
  }
  
  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature: keyof EnvironmentConfiguration['features']): boolean {
    return this.config.features[feature];
  }
  
  /**
   * Check if a governance requirement is active
   */
  isGovernanceRequired(requirement: keyof EnvironmentConfiguration['governance']): boolean {
    const value = this.config.governance[requirement];
    return typeof value === 'boolean' ? value : true;
  }
  
  /**
   * Enforce that we're not in production (for dangerous operations)
   */
  requireNonProduction(operation: string): void {
    if (this.isProduction()) {
      throw new Error(`Operation "${operation}" is not allowed in production`);
    }
  }
  
  /**
   * Enforce that we're in production (for production-only operations)
   */
  requireProduction(operation: string): void {
    if (!this.isProduction()) {
      throw new Error(`Operation "${operation}" is only allowed in production`);
    }
  }
}

// Export singleton
export const environmentGuard = EnvironmentGuard.getInstance();
