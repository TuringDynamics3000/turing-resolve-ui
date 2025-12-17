import { CardsPayment, CardsPaymentEvent, getCardsPaymentHash } from "../core/payments/cards";
import { createHash } from "crypto";

/**
 * Cards Evidence Pack Builder
 * 
 * Generates regulator-ready audit trail for card payments with:
 * - Authorisation metadata (auth code, expiry, hold amount)
 * - Capture records (partial captures, timestamps)
 * - Settlement timeline (provisional flag)
 * - Chargeback metadata (reason, deadline, reversal)
 * - Representment evidence
 * - Replay proof (SHA-256 hash)
 * 
 * Critical: Cards require richer evidence than NPP/BECS due to:
 * - Time-separated promises (auth ≠ settlement)
 * - Partial capture support
 * - Chargeback reversibility
 * - Long-tail timelines (up to 120 days)
 */

/**
 * Authorisation Evidence
 */
interface AuthorisationEvidence {
  authCode: string | null;
  authorisedAmount: string;
  expiresAt: string | null;
  holdPlaced: string; // NOT posted to ledger
  authTimestamp: string | null;
}

/**
 * Capture Evidence (supports partial captures)
 */
interface CaptureEvidence {
  captureAmount: string;
  captureSequence: number;
  capturedAt: string;
}

/**
 * Settlement Evidence
 */
interface SettlementEvidence {
  settledAt: string | null;
  settledAmount: string;
  provisional: boolean; // Always true for cards
  fundsTransferred: string;
}

/**
 * Chargeback Evidence
 */
interface ChargebackEvidence {
  chargebackAmount: string;
  chargebackReason: string | null;
  receivedAt: string | null;
  responseDeadline: string | null;
  fundsReversed: string; // Ledger reversal
}

/**
 * Representment Evidence
 */
interface RepresentmentEvidence {
  representedAt: string | null;
  representmentAmount: string;
  representmentEvidence: string | null; // Evidence document ID
}

/**
 * Timeline Evidence
 */
interface TimelineEvidence {
  createdAt: string;
  authorisedAt: string | null;
  firstCapturedAt: string | null;
  clearedAt: string | null;
  settledAt: string | null;
  chargebackAt: string | null;
  representedAt: string | null;
  totalDuration: string | null; // From creation to final state
}

/**
 * Replay Proof
 */
interface ReplayProof {
  eventCount: number;
  stateHash: string; // SHA-256 of current state
  eventStreamHash: string; // SHA-256 of all events
  replayable: boolean;
}

/**
 * Cards Evidence Pack
 */
export interface CardsEvidencePack {
  // Payment Identity
  paymentIntentId: string;
  merchantId: string;
  cardToken: string;
  
  // Current State
  state: string;
  version: number;
  
  // Payment Details
  amount: string;
  currency: string;
  
  // Authorisation
  authorisation: AuthorisationEvidence;
  
  // Captures (array for partial captures)
  captures: CaptureEvidence[];
  totalCaptured: string;
  
  // Clearing & Settlement
  settlement: SettlementEvidence;
  
  // Chargeback
  chargeback: ChargebackEvidence;
  
  // Representment
  representment: RepresentmentEvidence;
  
  // Timeline
  timeline: TimelineEvidence;
  
  // Replay Proof
  replayProof: ReplayProof;
  
  // Metadata
  generatedAt: string;
  evidencePackVersion: string;
}

/**
 * Build Cards evidence pack from payment state and events
 */
export function buildCardsEvidencePack(
  payment: CardsPayment,
  events: CardsPaymentEvent[]
): CardsEvidencePack {
  // Extract authorisation timestamp
  const authEvent = events.find((e) => e.type === "PaymentAuthorised");
  const authorisedAt = authEvent ? authEvent.occurredAt : null;
  
  // Extract first capture timestamp
  const firstCaptureEvent = events.find((e) => e.type === "PaymentCaptured");
  const firstCapturedAt = firstCaptureEvent ? firstCaptureEvent.occurredAt : null;
  
  // Extract chargeback metadata
  const chargebackEvent = events.find((e) => e.type === "PaymentChargeback");
  const chargebackReason = chargebackEvent && chargebackEvent.type === "PaymentChargeback"
    ? chargebackEvent.chargebackReason
    : null;
  const chargebackDeadline = chargebackEvent && chargebackEvent.type === "PaymentChargeback"
    ? chargebackEvent.responseDeadline
    : null;
  
  // Extract representment evidence
  const representmentEvent = events.find((e) => e.type === "PaymentRepresented");
  const representmentEvidenceDoc = representmentEvent && representmentEvent.type === "PaymentRepresented"
    ? representmentEvent.representmentEvidence
    : null;
  
  // Calculate total duration
  const finalEvent = events[events.length - 1];
  const totalDuration = finalEvent
    ? `${Math.floor((finalEvent.occurredAt.getTime() - payment.createdAt.getTime()) / 1000)}s`
    : null;
  
  // Generate event stream hash
  const eventStreamHash = createHash("sha256")
    .update(JSON.stringify(events.map((e) => ({ type: e.type, occurredAt: e.occurredAt }))))
    .digest("hex");
  
  return {
    // Payment Identity
    paymentIntentId: payment.paymentIntentId,
    merchantId: payment.merchantId,
    cardToken: payment.cardToken,
    
    // Current State
    state: payment.state,
    version: payment.version,
    
    // Payment Details
    amount: payment.amount.toString(),
    currency: payment.currency,
    
    // Authorisation
    authorisation: {
      authCode: payment.authCode,
      authorisedAmount: payment.authorisedAmount.toString(),
      expiresAt: payment.authExpiresAt ? payment.authExpiresAt.toISOString() : null,
      holdPlaced: payment.holdPlaced.toString(),
      authTimestamp: authorisedAt ? authorisedAt.toISOString() : null,
    },
    
    // Captures
    captures: payment.captures.map((capture) => ({
      captureAmount: capture.captureAmount.toString(),
      captureSequence: capture.captureSequence,
      capturedAt: capture.capturedAt.toISOString(),
    })),
    totalCaptured: payment.totalCaptured.toString(),
    
    // Settlement
    settlement: {
      settledAt: payment.settledAt ? payment.settledAt.toISOString() : null,
      settledAmount: payment.settledAmount.toString(),
      provisional: true, // Always true for cards
      fundsTransferred: payment.settledAmount.toString(),
    },
    
    // Chargeback
    chargeback: {
      chargebackAmount: payment.chargebackAmount.toString(),
      chargebackReason: chargebackReason || null,
      receivedAt: payment.chargebackAt ? payment.chargebackAt.toISOString() : null,
      responseDeadline: chargebackDeadline ? chargebackDeadline.toISOString() : null,
      fundsReversed: payment.fundsReversed.toString(),
    },
    
    // Representment
    representment: {
      representedAt: payment.representedAt ? payment.representedAt.toISOString() : null,
      representmentAmount: payment.representmentAmount.toString(),
      representmentEvidence: representmentEvidenceDoc,
    },
    
    // Timeline
    timeline: {
      createdAt: payment.createdAt.toISOString(),
      authorisedAt: authorisedAt ? authorisedAt.toISOString() : null,
      firstCapturedAt: firstCapturedAt ? firstCapturedAt.toISOString() : null,
      clearedAt: payment.clearedAt ? payment.clearedAt.toISOString() : null,
      settledAt: payment.settledAt ? payment.settledAt.toISOString() : null,
      chargebackAt: payment.chargebackAt ? payment.chargebackAt.toISOString() : null,
      representedAt: payment.representedAt ? payment.representedAt.toISOString() : null,
      totalDuration,
    },
    
    // Replay Proof
    replayProof: {
      eventCount: events.length,
      stateHash: getCardsPaymentHash(payment),
      eventStreamHash,
      replayable: true,
    },
    
    // Metadata
    generatedAt: new Date().toISOString(),
    evidencePackVersion: "1.0.0",
  };
}

/**
 * Validate Cards evidence pack schema
 */
export function validateCardsEvidencePack(pack: CardsEvidencePack): boolean {
  // Required fields
  if (!pack.paymentIntentId || !pack.state || !pack.amount) {
    return false;
  }
  
  // Authorisation evidence
  if (!pack.authorisation || pack.authorisation.holdPlaced === undefined) {
    return false;
  }
  
  // Captures array
  if (!Array.isArray(pack.captures)) {
    return false;
  }
  
  // Settlement provisional flag
  if (pack.settlement.provisional !== true) {
    return false; // Cards settlement must always be provisional
  }
  
  // Replay proof
  if (!pack.replayProof || !pack.replayProof.stateHash || !pack.replayProof.eventStreamHash) {
    return false;
  }
  
  return true;
}
