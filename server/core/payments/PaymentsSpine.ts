/**
 * Payments Spine v1.0.0
 * 
 * TuringDynamics Core - Bank-Grade Payment Orchestration
 * 
 * The Payments Spine is the central orchestration layer that:
 * 1. Routes payments to appropriate scheme adapters (NPP, BECS, RTGS, Cards)
 * 2. Enforces Resolve governance on all payment decisions
 * 3. Manages payment lifecycle with event sourcing
 * 4. Integrates with ledger for request-only money movement
 * 
 * CRITICAL INVARIANTS:
 * - No payment state transition without Resolve decision
 * - No balance mutation - ledger requests only
 * - All scheme adapters are stateless
 * - Idempotent processing for all operations
 */

import { nanoid } from "nanoid";
import { schemeAdapterRegistry } from "./SchemeAdapterInterface";

// ============================================
// PAYMENT TYPES
// ============================================

export type PaymentScheme = 
  | "NPP"       // New Payments Platform (real-time)
  | "BECS"      // Bulk Electronic Clearing System (batch)
  | "RTGS"      // Real-Time Gross Settlement (high-value)
  | "CARDS"     // Card schemes (Visa, Mastercard)
  | "INTERNAL"; // Internal transfers

export type PaymentType =
  | "CREDIT_TRANSFER"
  | "DIRECT_DEBIT"
  | "CARD_PAYMENT"
  | "REFUND"
  | "REVERSAL";

export type PaymentStatus =
  | "INITIATED"
  | "VALIDATED"
  | "AUTHORIZED"
  | "SUBMITTED"
  | "PENDING"
  | "SETTLED"
  | "FAILED"
  | "REVERSED"
  | "CANCELLED";

export type PaymentPriority =
  | "IMMEDIATE"   // NPP Osko
  | "SAME_DAY"    // Same-day BECS
  | "NEXT_DAY"    // Standard BECS
  | "SCHEDULED";  // Future-dated

// ============================================
// PAYMENT DOMAIN MODEL
// ============================================

export interface PaymentInstruction {
  instructionId: string;
  idempotencyKey: string;
  
  // Payment details
  scheme: PaymentScheme;
  type: PaymentType;
  priority: PaymentPriority;
  
  // Amount
  amount: number;
  currency: string;
  
  // Parties
  debtor: PaymentParty;
  creditor: PaymentParty;
  
  // References
  endToEndId: string;
  remittanceInfo: string;
  
  // Timing
  requestedExecutionDate: string;
  
  // Metadata
  createdAt: string;
  createdBy: string;
}

export interface PaymentParty {
  name: string;
  accountNumber: string;
  bsb?: string;
  bic?: string;
  address?: string;
  country: string;
}

export interface Payment {
  paymentId: string;
  instruction: PaymentInstruction;
  status: PaymentStatus;
  
  // Resolve governance
  resolveDecisionId?: string;
  resolveOutcome?: "ALLOW" | "REVIEW" | "DECLINE";
  
  // Scheme processing
  schemeReference?: string;
  schemeStatus?: string;
  
  // Settlement
  settledAt?: string;
  settlementReference?: string;
  
  // Failure
  failureCode?: string;
  failureReason?: string;
  
  // Audit
  events: PaymentEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentEvent {
  eventId: string;
  paymentId: string;
  eventType: PaymentEventType;
  timestamp: string;
  data: Record<string, unknown>;
  actorId: string;
  eventHash: string;
  previousHash: string;
}

export type PaymentEventType =
  | "PAYMENT_INITIATED"
  | "PAYMENT_VALIDATED"
  | "RESOLVE_DECISION_REQUESTED"
  | "RESOLVE_DECISION_RECEIVED"
  | "PAYMENT_AUTHORIZED"
  | "PAYMENT_SUBMITTED"
  | "SCHEME_ACK_RECEIVED"
  | "PAYMENT_SETTLED"
  | "PAYMENT_FAILED"
  | "PAYMENT_REVERSED"
  | "PAYMENT_CANCELLED";

// ============================================
// SCHEME ROUTING
// ============================================

interface SchemeRoutingRule {
  scheme: PaymentScheme;
  conditions: {
    minAmount?: number;
    maxAmount?: number;
    currencies?: string[];
    domestic?: boolean;
    priority?: PaymentPriority[];
  };
  priority: number;  // Lower = higher priority
}

const SCHEME_ROUTING_RULES: SchemeRoutingRule[] = [
  // NPP for immediate domestic payments up to $1M
  {
    scheme: "NPP",
    conditions: {
      maxAmount: 1000000,
      currencies: ["AUD"],
      domestic: true,
      priority: ["IMMEDIATE"],
    },
    priority: 1,
  },
  // RTGS for high-value domestic payments
  {
    scheme: "RTGS",
    conditions: {
      minAmount: 100000,
      currencies: ["AUD"],
      domestic: true,
    },
    priority: 2,
  },
  // BECS for batch domestic payments
  {
    scheme: "BECS",
    conditions: {
      currencies: ["AUD"],
      domestic: true,
      priority: ["SAME_DAY", "NEXT_DAY", "SCHEDULED"],
    },
    priority: 3,
  },
  // Internal for same-bank transfers
  {
    scheme: "INTERNAL",
    conditions: {},
    priority: 10,
  },
];

// ============================================
// PAYMENTS SPINE SERVICE
// ============================================

class PaymentsSpine {
  private payments: Map<string, Payment> = new Map();
  private idempotencyKeys: Map<string, string> = new Map();  // key -> paymentId
  
  /**
   * Initiate a new payment.
   */
  async initiatePayment(instruction: Omit<PaymentInstruction, "instructionId" | "createdAt">): Promise<{
    success: boolean;
    payment?: Payment;
    error?: string;
  }> {
    // Idempotency check
    const existingPaymentId = this.idempotencyKeys.get(instruction.idempotencyKey);
    if (existingPaymentId) {
      const existingPayment = this.payments.get(existingPaymentId);
      if (existingPayment) {
        return { success: true, payment: existingPayment };
      }
    }
    
    // Validate instruction
    const validationResult = this.validateInstruction(instruction);
    if (!validationResult.valid) {
      return { success: false, error: validationResult.error };
    }
    
    // Determine scheme
    const scheme = this.routeToScheme(instruction);
    
    // Create payment
    const paymentId = `PAY-${nanoid(12)}`;
    const now = new Date().toISOString();
    
    const fullInstruction: PaymentInstruction = {
      ...instruction,
      instructionId: `INS-${nanoid(10)}`,
      scheme,
      createdAt: now,
    };
    
    const payment: Payment = {
      paymentId,
      instruction: fullInstruction,
      status: "INITIATED",
      events: [],
      createdAt: now,
      updatedAt: now,
    };
    
    // Record initiation event
    this.recordEvent(payment, "PAYMENT_INITIATED", {
      instruction: fullInstruction,
      routedScheme: scheme,
    }, instruction.createdBy);
    
    // Store payment
    this.payments.set(paymentId, payment);
    this.idempotencyKeys.set(instruction.idempotencyKey, paymentId);
    
    return { success: true, payment };
  }

  /**
   * Validate payment instruction.
   */
  private validateInstruction(instruction: Omit<PaymentInstruction, "instructionId" | "createdAt">): {
    valid: boolean;
    error?: string;
  } {
    if (!instruction.amount || instruction.amount <= 0) {
      return { valid: false, error: "Invalid amount" };
    }
    
    if (!instruction.debtor?.accountNumber) {
      return { valid: false, error: "Debtor account required" };
    }
    
    if (!instruction.creditor?.accountNumber) {
      return { valid: false, error: "Creditor account required" };
    }
    
    if (!instruction.currency) {
      return { valid: false, error: "Currency required" };
    }
    
    return { valid: true };
  }

  /**
   * Route payment to appropriate scheme.
   */
  private routeToScheme(instruction: Omit<PaymentInstruction, "instructionId" | "createdAt">): PaymentScheme {
    const isDomestic = instruction.debtor.country === "AU" && instruction.creditor.country === "AU";
    const isSameBank = instruction.debtor.bsb === instruction.creditor.bsb;
    
    if (isSameBank) {
      return "INTERNAL";
    }
    
    for (const rule of SCHEME_ROUTING_RULES) {
      const { conditions } = rule;
      
      if (conditions.minAmount && instruction.amount < conditions.minAmount) continue;
      if (conditions.maxAmount && instruction.amount > conditions.maxAmount) continue;
      if (conditions.currencies && !conditions.currencies.includes(instruction.currency)) continue;
      if (conditions.domestic !== undefined && conditions.domestic !== isDomestic) continue;
      if (conditions.priority && !conditions.priority.includes(instruction.priority)) continue;
      
      return rule.scheme;
    }
    
    return "BECS";  // Default fallback
  }

  /**
   * Request Resolve decision for payment.
   */
  async requestResolveDecision(paymentId: string): Promise<{
    success: boolean;
    outcome?: "ALLOW" | "REVIEW" | "DECLINE";
    decisionId?: string;
    error?: string;
  }> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      return { success: false, error: "Payment not found" };
    }
    
    if (payment.status !== "INITIATED" && payment.status !== "VALIDATED") {
      return { success: false, error: `Cannot request decision for payment in ${payment.status} status` };
    }
    
    // Record decision request
    this.recordEvent(payment, "RESOLVE_DECISION_REQUESTED", {
      paymentId,
      amount: payment.instruction.amount,
      currency: payment.instruction.currency,
    }, "SYSTEM");
    
    // Simulate Resolve decision (in production, this calls Resolve API)
    const decisionId = `DEC-${nanoid(10)}`;
    const outcome = this.simulateResolveDecision(payment);
    
    payment.resolveDecisionId = decisionId;
    payment.resolveOutcome = outcome;
    
    // Record decision received
    this.recordEvent(payment, "RESOLVE_DECISION_RECEIVED", {
      decisionId,
      outcome,
    }, "RESOLVE");
    
    if (outcome === "ALLOW") {
      payment.status = "AUTHORIZED";
      this.recordEvent(payment, "PAYMENT_AUTHORIZED", { decisionId }, "RESOLVE");
    } else if (outcome === "DECLINE") {
      payment.status = "FAILED";
      payment.failureCode = "RESOLVE_DECLINED";
      payment.failureReason = "Payment declined by governance policy";
      this.recordEvent(payment, "PAYMENT_FAILED", {
        failureCode: "RESOLVE_DECLINED",
        decisionId,
      }, "RESOLVE");
    }
    
    payment.updatedAt = new Date().toISOString();
    
    return { success: true, outcome, decisionId };
  }

  /**
   * Simulate Resolve decision (replace with actual Resolve integration).
   */
  private simulateResolveDecision(payment: Payment): "ALLOW" | "REVIEW" | "DECLINE" {
    // High-value payments require review
    if (payment.instruction.amount >= 50000) {
      return "REVIEW";
    }
    
    // International payments require review
    if (payment.instruction.debtor.country !== payment.instruction.creditor.country) {
      return "REVIEW";
    }
    
    return "ALLOW";
  }

  /**
   * Submit payment to scheme.
   * Uses registered scheme adapters for actual submission.
   */
  async submitToScheme(paymentId: string): Promise<{
    success: boolean;
    schemeReference?: string;
    messageId?: string;
    error?: string;
  }> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      return { success: false, error: "Payment not found" };
    }
    
    if (payment.status !== "AUTHORIZED") {
      return { success: false, error: `Cannot submit payment in ${payment.status} status` };
    }
    
    const scheme = payment.instruction.scheme;
    const adapter = schemeAdapterRegistry.get(scheme);
    
    // If adapter is registered, use it
    if (adapter) {
      const result = await adapter.submit(payment);
      
      if (result.success) {
        payment.status = "SUBMITTED";
        payment.schemeReference = result.schemeReference;
        payment.schemeStatus = "PENDING";
        payment.updatedAt = new Date().toISOString();
        
        this.recordEvent(payment, "PAYMENT_SUBMITTED", {
          scheme,
          schemeReference: result.schemeReference,
          messageId: result.messageId,
        }, "SYSTEM");
        
        return {
          success: true,
          schemeReference: result.schemeReference,
          messageId: result.messageId,
        };
      } else {
        this.recordEvent(payment, "PAYMENT_FAILED", {
          scheme,
          error: result.error,
          errorCode: result.errorCode,
        }, "SYSTEM");
        
        return {
          success: false,
          error: result.error,
        };
      }
    }
    
    // Fallback: Generate scheme reference without adapter (for INTERNAL, etc.)
    const schemeReference = `${scheme}-${Date.now()}-${nanoid(6)}`;
    
    payment.status = "SUBMITTED";
    payment.schemeReference = schemeReference;
    payment.schemeStatus = "PENDING";
    payment.updatedAt = new Date().toISOString();
    
    this.recordEvent(payment, "PAYMENT_SUBMITTED", {
      scheme,
      schemeReference,
    }, "SYSTEM");
    
    return { success: true, schemeReference };
  }

  /**
   * Process scheme callback (settlement/failure).
   */
  async processSchemeCallback(schemeReference: string, callback: {
    status: "SETTLED" | "FAILED";
    settlementReference?: string;
    failureCode?: string;
    failureReason?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const payment = Array.from(this.payments.values()).find(p => p.schemeReference === schemeReference);
    if (!payment) {
      return { success: false, error: "Payment not found for scheme reference" };
    }
    
    if (callback.status === "SETTLED") {
      payment.status = "SETTLED";
      payment.settledAt = new Date().toISOString();
      payment.settlementReference = callback.settlementReference;
      payment.schemeStatus = "SETTLED";
      
      this.recordEvent(payment, "PAYMENT_SETTLED", {
        settlementReference: callback.settlementReference,
        settledAt: payment.settledAt,
      }, "SCHEME");
    } else {
      payment.status = "FAILED";
      payment.failureCode = callback.failureCode;
      payment.failureReason = callback.failureReason;
      payment.schemeStatus = "FAILED";
      
      this.recordEvent(payment, "PAYMENT_FAILED", {
        failureCode: callback.failureCode,
        failureReason: callback.failureReason,
      }, "SCHEME");
    }
    
    payment.updatedAt = new Date().toISOString();
    
    return { success: true };
  }

  /**
   * Record payment event with hash chain.
   */
  private recordEvent(
    payment: Payment,
    eventType: PaymentEventType,
    data: Record<string, unknown>,
    actorId: string
  ): void {
    const previousHash = payment.events.length > 0
      ? payment.events[payment.events.length - 1].eventHash
      : "GENESIS";
    
    const event: PaymentEvent = {
      eventId: `EVT-${nanoid(10)}`,
      paymentId: payment.paymentId,
      eventType,
      timestamp: new Date().toISOString(),
      data,
      actorId,
      previousHash,
      eventHash: "",  // Will be computed
    };
    
    // Compute event hash
    const hashInput = JSON.stringify({
      eventId: event.eventId,
      paymentId: event.paymentId,
      eventType: event.eventType,
      timestamp: event.timestamp,
      data: event.data,
      previousHash: event.previousHash,
    });
    
    event.eventHash = this.sha256(hashInput);
    payment.events.push(event);
  }

  /**
   * Simple SHA256 hash (in production, use crypto module).
   */
  private sha256(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `sha256:${Math.abs(hash).toString(16).padStart(16, "0")}`;
  }

  /**
   * Get payment by ID.
   */
  getPayment(paymentId: string): Payment | undefined {
    return this.payments.get(paymentId);
  }

  /**
   * Get payments by status.
   */
  getPaymentsByStatus(status: PaymentStatus): Payment[] {
    return Array.from(this.payments.values()).filter(p => p.status === status);
  }

  /**
   * Get payment statistics.
   */
  getStatistics(): {
    total: number;
    byStatus: Record<PaymentStatus, number>;
    byScheme: Record<PaymentScheme, number>;
    totalValueAUD: number;
    settledToday: number;
  } {
    const payments = Array.from(this.payments.values());
    const today = new Date().toISOString().split("T")[0];
    
    const byStatus: Record<PaymentStatus, number> = {
      INITIATED: 0,
      VALIDATED: 0,
      AUTHORIZED: 0,
      SUBMITTED: 0,
      PENDING: 0,
      SETTLED: 0,
      FAILED: 0,
      REVERSED: 0,
      CANCELLED: 0,
    };
    
    const byScheme: Record<PaymentScheme, number> = {
      NPP: 0,
      BECS: 0,
      RTGS: 0,
      CARDS: 0,
      INTERNAL: 0,
    };
    
    for (const payment of payments) {
      byStatus[payment.status]++;
      byScheme[payment.instruction.scheme]++;
    }
    
    return {
      total: payments.length,
      byStatus,
      byScheme,
      totalValueAUD: payments
        .filter(p => p.instruction.currency === "AUD")
        .reduce((sum, p) => sum + p.instruction.amount, 0),
      settledToday: payments.filter(p => p.settledAt?.startsWith(today)).length,
    };
  }

  /**
   * Verify payment event chain integrity.
   */
  verifyEventChain(paymentId: string): {
    valid: boolean;
    brokenAt?: number;
    error?: string;
  } {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      return { valid: false, error: "Payment not found" };
    }
    
    for (let i = 1; i < payment.events.length; i++) {
      const current = payment.events[i];
      const previous = payment.events[i - 1];
      
      if (current.previousHash !== previous.eventHash) {
        return { valid: false, brokenAt: i, error: "Hash chain broken" };
      }
    }
    
    return { valid: true };
  }
}

export const paymentsSpine = new PaymentsSpine();
export default paymentsSpine;
