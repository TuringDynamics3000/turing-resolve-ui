/**
 * Signed Policy Execution Proofs - Workstream C
 * 
 * Implements:
 * - Decision context capture with facts_hash commitments
 * - Evaluation trace hashing with policy hash binding
 * - Authorization token service (signed)
 * - Linking executed events back to decisions
 * 
 * INVARIANT: Every decision can be proven to have executed under policy X on facts Y.
 * INVARIANT: Authorization tokens are cryptographically bound to policy+model+inputs.
 */

import * as crypto from 'crypto';
import { canonicalJson, sha256 } from '../merkle/MerkleAuditTrail';
import { DecisionResult, PolicyValue } from './PolicyDSL';

// ============================================================
// DECISION RECORD TYPES (C1)
// ============================================================

export interface DecisionContextCaptured {
  factType: 'DECISION_CONTEXT_CAPTURED';
  decisionId: string;
  tenantId: string;
  environmentId: string;
  factsHash: string;
  factSources: FactSource[];
  policyId: string;
  policyVersion: string;
  policyBytecodeHash: string;
  modelId?: string;
  modelVersion?: string;
  modelArtifactHash?: string;
  requestedAt: Date;
  requestedBy: string;
  requestType: string;
}

export interface FactSource {
  factId: string;
  factHash: string;
  factType: string;
  streamId: string;
}

export interface PolicyEvaluated {
  factType: 'POLICY_EVALUATED';
  decisionId: string;
  outcome: 'permit' | 'deny' | 'refer';
  actionProposal?: {
    action: string;
    params: Record<string, unknown>;
  };
  reasonCodes: string[];
  traceHash: string;
  evaluationDurationMs: number;
  evaluatedAt: Date;
}

export interface AuthorizationTokenIssued {
  factType: 'AUTHORIZATION_TOKEN_ISSUED';
  decisionId: string;
  tokenId: string;
  tokenPayload: AuthorizationTokenPayload;
  tokenSignature: string;
  signingKeyId: string;
  issuedAt: Date;
  expiresAt: Date;
}

export interface ActionExecuted {
  factType: 'ACTION_EXECUTED';
  decisionId: string;
  tokenId: string;
  action: string;
  executedParams: Record<string, unknown>;
  coreEventIds: string[];
  executedAt: Date;
  executedBy: string;
}

// ============================================================
// AUTHORIZATION TOKEN (C3)
// ============================================================

export interface AuthorizationTokenPayload {
  tokenId: string;
  tenantId: string;
  environmentId: string;
  decisionId: string;
  allowedCommands: string[];
  boundedParams: Record<string, ParamBound>;
  expiryTimestamp: Date;
  policyBytecodeHash: string;
  factsHash: string;
  modelArtifactHash?: string;
  issuedAt: Date;
}

export interface ParamBound {
  type: 'exact' | 'range' | 'enum';
  value?: unknown;
  min?: number;
  max?: number;
  allowedValues?: unknown[];
}

export interface SignedAuthorizationToken {
  payload: AuthorizationTokenPayload;
  signature: string;
  signingKeyId: string;
}

// ============================================================
// DECISION RECORD SERVICE (C1, C2)
// ============================================================

export class DecisionRecordService {
  private decisions: Map<string, {
    context: DecisionContextCaptured;
    evaluation?: PolicyEvaluated;
    token?: AuthorizationTokenIssued;
    execution?: ActionExecuted;
  }> = new Map();
  
  /**
   * Capture decision context (C1)
   */
  captureContext(
    decisionId: string,
    tenantId: string,
    environmentId: string,
    facts: Record<string, PolicyValue>,
    factSources: FactSource[],
    policy: { id: string; version: string; bytecodeHash: string },
    model?: { id: string; version: string; artifactHash: string },
    requestedBy: string = 'system',
    requestType: string = 'UNKNOWN'
  ): DecisionContextCaptured {
    // Compute facts hash commitment
    const factsHash = sha256('TD:FACTS:v1|' + canonicalJson(facts));
    
    const context: DecisionContextCaptured = {
      factType: 'DECISION_CONTEXT_CAPTURED',
      decisionId,
      tenantId,
      environmentId,
      factsHash,
      factSources,
      policyId: policy.id,
      policyVersion: policy.version,
      policyBytecodeHash: policy.bytecodeHash,
      modelId: model?.id,
      modelVersion: model?.version,
      modelArtifactHash: model?.artifactHash,
      requestedAt: new Date(),
      requestedBy,
      requestType,
    };
    
    this.decisions.set(decisionId, { context });
    
    return context;
  }
  
  /**
   * Record policy evaluation result (C2)
   */
  recordEvaluation(
    decisionId: string,
    result: DecisionResult
  ): PolicyEvaluated {
    const decision = this.decisions.get(decisionId);
    if (!decision) {
      throw new Error(`Decision not found: ${decisionId}`);
    }
    
    const evaluation: PolicyEvaluated = {
      factType: 'POLICY_EVALUATED',
      decisionId,
      outcome: result.outcome === 'allow' ? 'permit' : result.outcome,
      actionProposal: result.action ? {
        action: result.action,
        params: result.params || {},
      } : undefined,
      reasonCodes: result.reasonCodes,
      traceHash: result.traceHash,
      evaluationDurationMs: result.evaluationDurationMs,
      evaluatedAt: new Date(),
    };
    
    decision.evaluation = evaluation;
    
    return evaluation;
  }
  
  /**
   * Get decision record
   */
  getDecision(decisionId: string) {
    return this.decisions.get(decisionId);
  }
}

// ============================================================
// AUTHORIZATION TOKEN SERVICE (C3)
// ============================================================

const TOKEN_SIGN_PREFIX = 'TD:AUTHTOKEN:v1|';

export class AuthorizationTokenService {
  private privateKey: string;
  private publicKey: string;
  private keyId: string;
  private tokens: Map<string, SignedAuthorizationToken> = new Map();
  
  constructor(privateKey: string, publicKey: string) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.keyId = sha256(publicKey).substring(0, 16);
  }
  
  /**
   * Issue authorization token for a decision
   */
  issueToken(
    decisionId: string,
    context: DecisionContextCaptured,
    evaluation: PolicyEvaluated,
    allowedCommands: string[],
    boundedParams: Record<string, ParamBound>,
    validitySeconds: number = 300 // 5 minutes default
  ): SignedAuthorizationToken {
    const tokenId = `tok_${crypto.randomUUID().replace(/-/g, '')}`;
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + validitySeconds * 1000);
    
    const payload: AuthorizationTokenPayload = {
      tokenId,
      tenantId: context.tenantId,
      environmentId: context.environmentId,
      decisionId,
      allowedCommands,
      boundedParams,
      expiryTimestamp: expiresAt,
      policyBytecodeHash: context.policyBytecodeHash,
      factsHash: context.factsHash,
      modelArtifactHash: context.modelArtifactHash,
      issuedAt,
    };
    
    // Sign token
    const signPayload = TOKEN_SIGN_PREFIX + canonicalJson(payload);
    const sign = crypto.createSign('SHA256');
    sign.update(signPayload);
    const signature = sign.sign(this.privateKey, 'hex');
    
    const token: SignedAuthorizationToken = {
      payload,
      signature,
      signingKeyId: this.keyId,
    };
    
    this.tokens.set(tokenId, token);
    
    return token;
  }
  
  /**
   * Verify authorization token
   */
  verifyToken(token: SignedAuthorizationToken): {
    valid: boolean;
    expired: boolean;
    signatureValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    // Check expiry
    const expired = new Date() > token.payload.expiryTimestamp;
    if (expired) {
      errors.push('Token has expired');
    }
    
    // Verify signature
    const signPayload = TOKEN_SIGN_PREFIX + canonicalJson(token.payload);
    const verify = crypto.createVerify('SHA256');
    verify.update(signPayload);
    
    let signatureValid = false;
    try {
      signatureValid = verify.verify(this.publicKey, token.signature, 'hex');
    } catch {
      signatureValid = false;
    }
    
    if (!signatureValid) {
      errors.push('Invalid signature');
    }
    
    return {
      valid: signatureValid && !expired,
      expired,
      signatureValid,
      errors,
    };
  }
  
  /**
   * Validate command against token
   */
  validateCommand(
    token: SignedAuthorizationToken,
    command: string,
    params: Record<string, unknown>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check command is allowed
    if (!token.payload.allowedCommands.includes(command)) {
      errors.push(`Command not allowed: ${command}`);
    }
    
    // Check params are within bounds
    for (const [key, bound] of Object.entries(token.payload.boundedParams)) {
      const value = params[key];
      
      if (bound.type === 'exact' && value !== bound.value) {
        errors.push(`Parameter ${key} must be exactly ${bound.value}`);
      }
      
      if (bound.type === 'range' && typeof value === 'number') {
        if (bound.min !== undefined && value < bound.min) {
          errors.push(`Parameter ${key} below minimum ${bound.min}`);
        }
        if (bound.max !== undefined && value > bound.max) {
          errors.push(`Parameter ${key} above maximum ${bound.max}`);
        }
      }
      
      if (bound.type === 'enum' && bound.allowedValues) {
        if (!bound.allowedValues.includes(value)) {
          errors.push(`Parameter ${key} not in allowed values`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Get token by ID
   */
  getToken(tokenId: string): SignedAuthorizationToken | undefined {
    return this.tokens.get(tokenId);
  }
}

// ============================================================
// EXECUTION LINKER (C4)
// ============================================================

export class ExecutionLinker {
  private executions: Map<string, ActionExecuted> = new Map();
  
  /**
   * Link executed action to decision
   */
  linkExecution(
    decisionId: string,
    tokenId: string,
    action: string,
    executedParams: Record<string, unknown>,
    coreEventIds: string[],
    executedBy: string = 'system'
  ): ActionExecuted {
    const execution: ActionExecuted = {
      factType: 'ACTION_EXECUTED',
      decisionId,
      tokenId,
      action,
      executedParams,
      coreEventIds,
      executedAt: new Date(),
      executedBy,
    };
    
    this.executions.set(decisionId, execution);
    
    return execution;
  }
  
  /**
   * Get execution by decision ID
   */
  getExecution(decisionId: string): ActionExecuted | undefined {
    return this.executions.get(decisionId);
  }
  
  /**
   * Get all executions for a token
   */
  getExecutionsByToken(tokenId: string): ActionExecuted[] {
    return Array.from(this.executions.values())
      .filter(e => e.tokenId === tokenId);
  }
}

// ============================================================
// PROOF BUNDLE (C5)
// ============================================================

export interface ExecutionProofBundle {
  decisionId: string;
  context: DecisionContextCaptured;
  evaluation: PolicyEvaluated;
  token: AuthorizationTokenIssued;
  execution: ActionExecuted;
  proofHash: string;
}

export function createExecutionProofBundle(
  context: DecisionContextCaptured,
  evaluation: PolicyEvaluated,
  token: SignedAuthorizationToken,
  execution: ActionExecuted
): ExecutionProofBundle {
  const tokenIssued: AuthorizationTokenIssued = {
    factType: 'AUTHORIZATION_TOKEN_ISSUED',
    decisionId: context.decisionId,
    tokenId: token.payload.tokenId,
    tokenPayload: token.payload,
    tokenSignature: token.signature,
    signingKeyId: token.signingKeyId,
    issuedAt: token.payload.issuedAt,
    expiresAt: token.payload.expiryTimestamp,
  };
  
  // Compute proof hash over all components
  const proofHash = sha256('TD:EXECPROOF:v1|' + canonicalJson({
    context,
    evaluation,
    token: tokenIssued,
    execution,
  }));
  
  return {
    decisionId: context.decisionId,
    context,
    evaluation,
    token: tokenIssued,
    execution,
    proofHash,
  };
}

// ============================================================
// VERIFICATION
// ============================================================

export function verifyExecutionProof(bundle: ExecutionProofBundle): {
  valid: boolean;
  checks: {
    contextValid: boolean;
    evaluationLinked: boolean;
    tokenLinked: boolean;
    executionLinked: boolean;
    hashesMatch: boolean;
  };
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check context
  const contextValid = !!bundle.context.decisionId && !!bundle.context.factsHash;
  if (!contextValid) errors.push('Invalid context');
  
  // Check evaluation linked to context
  const evaluationLinked = bundle.evaluation.decisionId === bundle.context.decisionId;
  if (!evaluationLinked) errors.push('Evaluation not linked to context');
  
  // Check token linked to context
  const tokenLinked = bundle.token.decisionId === bundle.context.decisionId;
  if (!tokenLinked) errors.push('Token not linked to context');
  
  // Check execution linked to token
  const executionLinked = 
    bundle.execution.decisionId === bundle.context.decisionId &&
    bundle.execution.tokenId === bundle.token.tokenId;
  if (!executionLinked) errors.push('Execution not linked to token');
  
  // Verify hashes match
  const hashesMatch = 
    bundle.token.tokenPayload.policyBytecodeHash === bundle.context.policyBytecodeHash &&
    bundle.token.tokenPayload.factsHash === bundle.context.factsHash;
  if (!hashesMatch) errors.push('Hash mismatch between token and context');
  
  return {
    valid: errors.length === 0,
    checks: {
      contextValid,
      evaluationLinked,
      tokenLinked,
      executionLinked,
      hashesMatch,
    },
    errors,
  };
}
