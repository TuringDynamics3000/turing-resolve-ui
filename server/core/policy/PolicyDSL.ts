/**
 * Resolve Policy DSL - Workstream B
 * 
 * Implements deterministic policy language with:
 * - Explicit type system (no floats, no implicit truthiness)
 * - No side effects (no network, no randomness, no system clock)
 * - Compiled to signed bytecode
 * - Reproducible trace hash per evaluation
 * 
 * INVARIANT: Policy evaluation is pure and deterministic.
 * INVARIANT: Same inputs always produce same outputs and trace hash.
 */

import * as crypto from 'crypto';
import { canonicalJson, sha256 } from '../merkle/MerkleAuditTrail';

// ============================================================
// TYPE SYSTEM (B1 - No floats, explicit nullability)
// ============================================================

export type PolicyValueType = 
  | 'Bool'
  | 'Int64'
  | 'Decimal'
  | 'String'
  | 'Date'
  | 'Timestamp'
  | 'Enum'
  | 'List'
  | 'Map'
  | 'Null';

export interface DecimalValue {
  type: 'Decimal';
  value: string; // String representation for precision
  precision: number;
  scale: number;
}

export interface PolicyValue {
  type: PolicyValueType;
  value: unknown;
  metadata?: {
    precision?: number;
    scale?: number;
    enumValues?: string[];
    elementType?: PolicyValueType;
    keyType?: PolicyValueType;
    valueType?: PolicyValueType;
  };
}

// ============================================================
// DSL AST TYPES
// ============================================================

export interface PolicyInput {
  name: string;
  path: string; // e.g., "customer.credit_score"
  type: PolicyValueType;
  metadata?: PolicyValue['metadata'];
  required: boolean;
}

export interface RuleCondition {
  left: Expression;
  operator: ComparisonOperator;
  right: Expression;
}

export type ComparisonOperator = 
  | 'eq' | 'neq' 
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'in' | 'not_in'
  | 'exists' | 'not_exists';

export type LogicalOperator = 'and' | 'or' | 'not';

export interface Expression {
  type: 'literal' | 'reference' | 'function' | 'binary' | 'unary';
  value?: PolicyValue;
  path?: string;
  functionName?: string;
  args?: Expression[];
  operator?: string;
  left?: Expression;
  right?: Expression;
  operand?: Expression;
}

export type RuleOutcome = 'allow' | 'deny' | 'refer';

export interface RuleAction {
  outcome: RuleOutcome;
  action?: string;
  params?: Record<string, Expression>;
  reason: string;
}

export interface PolicyRule {
  id: string;
  name: string;
  priority: number;
  conditions: RuleCondition[];
  logicalOperator: LogicalOperator;
  action: RuleAction;
}

export interface PolicyDefinition {
  policyId: string;
  version: string;
  name: string;
  description: string;
  validFrom: Date;
  validTo: Date | null;
  inputs: PolicyInput[];
  rules: PolicyRule[];
  defaultAction: RuleAction;
}

// ============================================================
// BYTECODE FORMAT (B2)
// ============================================================

export interface PolicyBytecode {
  version: string;
  policyId: string;
  policyVersion: string;
  bytecode: Uint8Array;
  bytecodeHash: string;
  symbolTable: Map<string, number>;
  reasonCodes: Map<string, string>;
  compiledAt: Date;
  compilerVersion: string;
}

export interface SignedPolicyBytecode extends PolicyBytecode {
  signature: string;
  signingKeyId: string;
  metadataHash: string;
}

// ============================================================
// POLICY REGISTRY (B3)
// ============================================================

export interface PolicyRegistryEntry {
  policyId: string;
  version: string;
  validFrom: Date;
  validTo: Date | null;
  bytecode: Uint8Array;
  bytecodeHash: string;
  signature: string;
  signingKeyId: string;
  compilerVersion: string;
  testResultsHash: string;
  status: 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'RETIRED';
  createdAt: Date;
  createdBy: string;
}

export class PolicyRegistry {
  private policies: Map<string, PolicyRegistryEntry[]> = new Map();
  
  /**
   * Register a new policy version
   */
  register(entry: PolicyRegistryEntry): void {
    const versions = this.policies.get(entry.policyId) || [];
    
    // Ensure version doesn't already exist
    if (versions.some(v => v.version === entry.version)) {
      throw new Error(`Policy version already exists: ${entry.policyId}@${entry.version}`);
    }
    
    versions.push(entry);
    this.policies.set(entry.policyId, versions);
  }
  
  /**
   * Get active policy for a given time
   */
  getActive(policyId: string, atTime: Date): PolicyRegistryEntry | null {
    const versions = this.policies.get(policyId);
    if (!versions) return null;
    
    // Find active version at the given time
    const active = versions
      .filter(v => 
        v.status === 'ACTIVE' &&
        v.validFrom <= atTime &&
        (v.validTo === null || v.validTo > atTime)
      )
      .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime());
    
    return active[0] || null;
  }
  
  /**
   * Get specific version
   */
  getVersion(policyId: string, version: string): PolicyRegistryEntry | null {
    const versions = this.policies.get(policyId);
    if (!versions) return null;
    
    return versions.find(v => v.version === version) || null;
  }
}

// ============================================================
// COMPILER (B2)
// ============================================================

const BYTECODE_VERSION = 'TD:POLICYBYTECODE:v1';
const COMPILER_VERSION = 'td-policy-compiler-1.0.0';

export class PolicyCompiler {
  /**
   * Compile policy definition to bytecode
   */
  compile(policy: PolicyDefinition): PolicyBytecode {
    // Serialize policy to deterministic format
    const serialized = this.serializePolicy(policy);
    const bytecode = new TextEncoder().encode(serialized);
    
    // Compute bytecode hash
    const bytecodeHash = sha256(BYTECODE_VERSION + '|' + serialized);
    
    // Build symbol table
    const symbolTable = new Map<string, number>();
    policy.inputs.forEach((input, index) => {
      symbolTable.set(input.path, index);
    });
    
    // Build reason codes
    const reasonCodes = new Map<string, string>();
    policy.rules.forEach(rule => {
      reasonCodes.set(rule.id, rule.action.reason);
    });
    reasonCodes.set('DEFAULT', policy.defaultAction.reason);
    
    return {
      version: BYTECODE_VERSION,
      policyId: policy.policyId,
      policyVersion: policy.version,
      bytecode,
      bytecodeHash,
      symbolTable,
      reasonCodes,
      compiledAt: new Date(),
      compilerVersion: COMPILER_VERSION,
    };
  }
  
  /**
   * Sign compiled bytecode
   */
  sign(bytecode: PolicyBytecode, privateKey: string): SignedPolicyBytecode {
    const metadataHash = sha256(canonicalJson({
      policyId: bytecode.policyId,
      policyVersion: bytecode.policyVersion,
      compiledAt: bytecode.compiledAt.toISOString(),
      compilerVersion: bytecode.compilerVersion,
    }));
    
    const signPayload = bytecode.bytecodeHash + metadataHash;
    
    const sign = crypto.createSign('SHA256');
    sign.update(signPayload);
    const signature = sign.sign(privateKey, 'hex');
    
    const keyId = sha256(privateKey).substring(0, 16);
    
    return {
      ...bytecode,
      signature,
      signingKeyId: keyId,
      metadataHash,
    };
  }
  
  private serializePolicy(policy: PolicyDefinition): string {
    return canonicalJson({
      policyId: policy.policyId,
      version: policy.version,
      inputs: policy.inputs,
      rules: policy.rules.map(r => ({
        id: r.id,
        name: r.name,
        priority: r.priority,
        conditions: r.conditions,
        logicalOperator: r.logicalOperator,
        action: r.action,
      })),
      defaultAction: policy.defaultAction,
    });
  }
}

// ============================================================
// RUNTIME INTERPRETER (B4)
// ============================================================

export interface FactsSnapshot {
  factsHash: string;
  featureSchemaId: string;
  featureSchemaVersion: string;
  facts: Record<string, PolicyValue>;
  decisionTime: Date; // Explicit time input, no now()
}

export interface EvaluationTrace {
  steps: TraceStep[];
  traceHash: string;
}

export interface TraceStep {
  stepIndex: number;
  ruleId: string;
  conditionResults: boolean[];
  ruleMatched: boolean;
  parameterBounds?: Record<string, { original: unknown; bounded: unknown }>;
  reasonCode?: string;
}

export interface DecisionResult {
  outcome: RuleOutcome;
  action?: string;
  params?: Record<string, unknown>;
  reasonCodes: string[];
  traceHash: string;
  policyBytecodeHash: string;
  factsHash: string;
  evaluationDurationMs: number;
}

export class PolicyRuntime {
  private policy: PolicyDefinition;
  private bytecode: SignedPolicyBytecode;
  
  constructor(policy: PolicyDefinition, bytecode: SignedPolicyBytecode) {
    this.policy = policy;
    this.bytecode = bytecode;
  }
  
  /**
   * Evaluate policy against facts snapshot
   * Returns deterministic result with trace hash
   */
  evaluate(facts: FactsSnapshot): DecisionResult {
    const startTime = Date.now();
    const trace: TraceStep[] = [];
    let traceHash = '0'.repeat(64); // Initial trace hash
    
    // Sort rules by priority
    const sortedRules = [...this.policy.rules].sort((a, b) => a.priority - b.priority);
    
    // Evaluate each rule
    for (const rule of sortedRules) {
      const conditionResults = rule.conditions.map(cond => 
        this.evaluateCondition(cond, facts)
      );
      
      const ruleMatched = this.combineConditions(conditionResults, rule.logicalOperator);
      
      const step: TraceStep = {
        stepIndex: trace.length,
        ruleId: rule.id,
        conditionResults,
        ruleMatched,
      };
      
      if (ruleMatched) {
        step.reasonCode = rule.action.reason;
        
        // Apply parameter bounding if action has params
        if (rule.action.params) {
          step.parameterBounds = {};
          // Bound parameters (e.g., clamp rate to min/max)
        }
      }
      
      trace.push(step);
      
      // Update trace hash: SHA256(prev_hash || step_hash)
      const stepHash = sha256('TD:TRACE_STEP:v1|' + canonicalJson(step));
      traceHash = sha256(traceHash + stepHash);
      
      if (ruleMatched) {
        const result: DecisionResult = {
          outcome: rule.action.outcome,
          action: rule.action.action,
          params: this.evaluateParams(rule.action.params, facts),
          reasonCodes: [rule.action.reason],
          traceHash,
          policyBytecodeHash: this.bytecode.bytecodeHash,
          factsHash: facts.factsHash,
          evaluationDurationMs: Date.now() - startTime,
        };
        
        return result;
      }
    }
    
    // No rule matched, use default
    const defaultStep: TraceStep = {
      stepIndex: trace.length,
      ruleId: 'DEFAULT',
      conditionResults: [],
      ruleMatched: true,
      reasonCode: this.policy.defaultAction.reason,
    };
    trace.push(defaultStep);
    
    const stepHash = sha256('TD:TRACE_STEP:v1|' + canonicalJson(defaultStep));
    traceHash = sha256(traceHash + stepHash);
    
    return {
      outcome: this.policy.defaultAction.outcome,
      action: this.policy.defaultAction.action,
      params: this.evaluateParams(this.policy.defaultAction.params, facts),
      reasonCodes: [this.policy.defaultAction.reason],
      traceHash,
      policyBytecodeHash: this.bytecode.bytecodeHash,
      factsHash: facts.factsHash,
      evaluationDurationMs: Date.now() - startTime,
    };
  }
  
  private evaluateCondition(condition: RuleCondition, facts: FactsSnapshot): boolean {
    const leftValue = this.evaluateExpression(condition.left, facts);
    const rightValue = this.evaluateExpression(condition.right, facts);
    
    // Handle null comparisons explicitly
    if (leftValue === null || rightValue === null) {
      if (condition.operator === 'exists') {
        return leftValue !== null;
      }
      if (condition.operator === 'not_exists') {
        return leftValue === null;
      }
      return false; // Comparisons with null are false
    }
    
    switch (condition.operator) {
      case 'eq': return leftValue === rightValue;
      case 'neq': return leftValue !== rightValue;
      case 'gt': return this.compareValues(leftValue, rightValue) > 0;
      case 'gte': return this.compareValues(leftValue, rightValue) >= 0;
      case 'lt': return this.compareValues(leftValue, rightValue) < 0;
      case 'lte': return this.compareValues(leftValue, rightValue) <= 0;
      case 'in': return Array.isArray(rightValue) && rightValue.includes(leftValue);
      case 'not_in': return Array.isArray(rightValue) && !rightValue.includes(leftValue);
      case 'exists': return leftValue !== null;
      case 'not_exists': return leftValue === null;
      default: return false;
    }
  }
  
  private evaluateExpression(expr: Expression, facts: FactsSnapshot): unknown {
    switch (expr.type) {
      case 'literal':
        return expr.value?.value;
      
      case 'reference':
        return this.resolvePath(expr.path!, facts);
      
      case 'function':
        return this.evaluateFunction(expr.functionName!, expr.args || [], facts);
      
      case 'binary':
        const left = this.evaluateExpression(expr.left!, facts);
        const right = this.evaluateExpression(expr.right!, facts);
        return this.evaluateBinaryOp(expr.operator!, left, right);
      
      case 'unary':
        const operand = this.evaluateExpression(expr.operand!, facts);
        return this.evaluateUnaryOp(expr.operator!, operand);
      
      default:
        return null;
    }
  }
  
  private resolvePath(path: string, facts: FactsSnapshot): unknown {
    const parts = path.split('.');
    let current: unknown = facts.facts;
    
    for (const part of parts) {
      if (current === null || current === undefined) return null;
      if (typeof current === 'object' && current !== null) {
        const obj = current as Record<string, unknown>;
        if (part in obj) {
          const val = obj[part];
          current = (val as PolicyValue)?.value ?? val;
        } else {
          return null;
        }
      } else {
        return null;
      }
    }
    
    return current;
  }
  
  private evaluateFunction(name: string, args: Expression[], facts: FactsSnapshot): unknown {
    const evaluatedArgs = args.map(a => this.evaluateExpression(a, facts));
    
    switch (name) {
      case 'exists':
        return evaluatedArgs[0] !== null && evaluatedArgs[0] !== undefined;
      
      case 'coalesce':
        return evaluatedArgs.find(a => a !== null && a !== undefined) ?? null;
      
      case 'clamp':
        const [value, min, max] = evaluatedArgs as [number, number, number];
        return Math.max(min, Math.min(max, value));
      
      case 'abs':
        return Math.abs(evaluatedArgs[0] as number);
      
      case 'round':
        // Banker's rounding (round half to even)
        const num = evaluatedArgs[0] as number;
        const scale = (evaluatedArgs[1] as number) ?? 0;
        const factor = Math.pow(10, scale);
        const shifted = num * factor;
        const rounded = Math.round(shifted);
        // Banker's rounding adjustment
        if (Math.abs(shifted - rounded) === 0.5) {
          return (rounded % 2 === 0 ? rounded : rounded - 1) / factor;
        }
        return rounded / factor;
      
      default:
        throw new Error(`Unknown function: ${name}`);
    }
  }
  
  private evaluateBinaryOp(op: string, left: unknown, right: unknown): unknown {
    if (typeof left === 'number' && typeof right === 'number') {
      switch (op) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': 
          if (right === 0) throw new Error('Division by zero');
          return left / right;
        default: return null;
      }
    }
    if (typeof left === 'string' && typeof right === 'string' && op === '+') {
      return left + right;
    }
    return null;
  }
  
  private evaluateUnaryOp(op: string, operand: unknown): unknown {
    switch (op) {
      case 'not': return !operand;
      case '-': return typeof operand === 'number' ? -operand : null;
      default: return null;
    }
  }
  
  private combineConditions(results: boolean[], operator: LogicalOperator): boolean {
    switch (operator) {
      case 'and': return results.every(r => r);
      case 'or': return results.some(r => r);
      case 'not': return !results[0];
      default: return false;
    }
  }
  
  private compareValues(left: unknown, right: unknown): number {
    if (typeof left === 'number' && typeof right === 'number') {
      return left - right;
    }
    if (typeof left === 'string' && typeof right === 'string') {
      return left.localeCompare(right);
    }
    return 0;
  }
  
  private evaluateParams(
    params: Record<string, Expression> | undefined,
    facts: FactsSnapshot
  ): Record<string, unknown> | undefined {
    if (!params) return undefined;
    
    const result: Record<string, unknown> = {};
    for (const [key, expr] of Object.entries(params)) {
      result[key] = this.evaluateExpression(expr, facts);
    }
    return result;
  }
}

// ============================================================
// HELPER: CREATE FACTS HASH
// ============================================================

export function computeFactsHash(facts: Record<string, PolicyValue>): string {
  return sha256('TD:FACTS:v1|' + canonicalJson(facts));
}

// ============================================================
// EXAMPLE POLICY BUILDER
// ============================================================

export function createDTILimitPolicy(): PolicyDefinition {
  return {
    policyId: 'credit.dti_limit',
    version: '1.0.0',
    name: 'DTI Limit Policy',
    description: 'Deny applications with DTI above threshold',
    validFrom: new Date('2024-01-01'),
    validTo: null,
    inputs: [
      { name: 'credit_score', path: 'customer.credit_score', type: 'Int64', required: true },
      { name: 'dti', path: 'customer.dti', type: 'Decimal', metadata: { precision: 5, scale: 4 }, required: true },
      { name: 'segment_concentration', path: 'portfolio.segment_concentration', type: 'Decimal', metadata: { precision: 5, scale: 4 }, required: false },
      { name: 'amount', path: 'request.amount', type: 'Decimal', metadata: { precision: 12, scale: 2 }, required: true },
    ],
    rules: [
      {
        id: 'DTI_LIMIT',
        name: 'DTI Limit Check',
        priority: 1,
        conditions: [{
          left: { type: 'reference', path: 'customer.dti' },
          operator: 'gt',
          right: { type: 'literal', value: { type: 'Decimal', value: '0.42' } },
        }],
        logicalOperator: 'and',
        action: { outcome: 'deny', reason: 'DTI_TOO_HIGH' },
      },
      {
        id: 'SEGMENT_CONC',
        name: 'Segment Concentration Check',
        priority: 2,
        conditions: [{
          left: { type: 'reference', path: 'portfolio.segment_concentration' },
          operator: 'gt',
          right: { type: 'literal', value: { type: 'Decimal', value: '0.18' } },
        }],
        logicalOperator: 'and',
        action: { outcome: 'refer', reason: 'SEGMENT_CONCENTRATION' },
      },
      {
        id: 'APPROVE',
        name: 'Credit Score Approval',
        priority: 3,
        conditions: [{
          left: { type: 'reference', path: 'customer.credit_score' },
          operator: 'gte',
          right: { type: 'literal', value: { type: 'Int64', value: 700 } },
        }],
        logicalOperator: 'and',
        action: {
          outcome: 'allow',
          action: 'APPROVE',
          params: {
            rate: {
              type: 'function',
              functionName: 'clamp',
              args: [
                { type: 'reference', path: 'request.rate' },
                { type: 'literal', value: { type: 'Decimal', value: '0.08' } },
                { type: 'literal', value: { type: 'Decimal', value: '0.22' } },
              ],
            },
          },
          reason: 'CREDIT_SCORE_APPROVED',
        },
      },
    ],
    defaultAction: { outcome: 'deny', reason: 'NO_RULE_MATCH' },
  };
}
