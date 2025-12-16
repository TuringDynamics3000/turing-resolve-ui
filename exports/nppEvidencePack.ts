/**
 * NPP Evidence Pack - Regulator-Ready Export
 * 
 * RULE: Evidence must be deterministic (same events → same pack)
 * RULE: Evidence must be replayable (rebuild state from pack)
 * RULE: Evidence must be regulator-ready (human + machine readable)
 * RULE: Evidence includes ops actions (full audit trail)
 */

import { createHash } from "crypto";
import {
  NPPPaymentState,
  NPPPaymentEventUnion,
  NPPFailureReason,
} from "../core/payments/npp";

/**
 * Payment Intent - Original request
 */
export interface PaymentIntent {
  paymentIntentId: string;
  amount: bigint;
  currency: string;
  fromAccount: string;
  toAccount: string;
  reference: string;
  requestedAt: Date;
  requestedBy: string;
}

/**
 * Rail Decision - Which rail to use
 */
export interface RailDecision {
  rail: "NPP" | "BECS" | "RTGS";
  reason: string;
  decidedAt: Date;
  policyEvaluation?: {
    policyId: string;
    outcome: "ALLOW" | "REVIEW" | "DECLINE";
  };
}

/**
 * Payment Attempt - Single attempt to send payment
 */
export interface PaymentAttempt {
  attemptId: string;
  attemptNumber: number;
  createdAt: Date;
  sentAt?: Date;
  acknowledgedAt?: Date;
  settledAt?: Date;
  failedAt?: Date;
  failureReason?: NPPFailureReason;
}

/**
 * Ops Action - Operator intervention
 */
export interface OpsAction {
  actionType: "RETRY" | "CANCEL" | "MARK_FAILED" | "OVERRIDE";
  operatorId: string;
  reason: string;
  occurredAt: Date;
  policyApproval: boolean;
  fromState: NPPPaymentState;
  eventEmitted: NPPPaymentEventUnion;
}

/**
 * NPP Evidence Pack - Complete audit trail
 */
export interface NPPEvidencePack {
  // Metadata
  packId: string;
  packVersion: "1.0";
  generatedAt: Date;
  
  // Payment identity
  paymentIntent: PaymentIntent;
  
  // Rail selection
  railDecision: RailDecision;
  
  // Attempts
  attempts: PaymentAttempt[];
  
  // Full event log
  lifecycleEvents: NPPPaymentEventUnion[];
  
  // Ops interventions
  opsActions: OpsAction[];
  
  // Final state
  finalState: {
    state: NPPPaymentState;
    fundsSettled: bigint;
    settledAt?: Date;
    failureReason?: NPPFailureReason;
  };
  
  // Replay proof
  replayProof: {
    eventCount: number;
    eventsHash: string; // SHA-256 of all events
    stateHash: string;  // SHA-256 of final state
  };
}

/**
 * Build NPP Evidence Pack from events
 */
export function buildNPPEvidencePack(
  paymentIntent: PaymentIntent,
  railDecision: RailDecision,
  events: NPPPaymentEventUnion[],
  opsActions: OpsAction[],
  finalState: NPPPaymentState,
  fundsSettled: bigint
): NPPEvidencePack {
  // Extract attempts from events
  const attempts: PaymentAttempt[] = [];
  let currentAttempt: Partial<PaymentAttempt> | null = null;
  let attemptNumber = 0;

  for (const event of events) {
    switch (event.type) {
      case "PaymentAttemptCreated":
        if (currentAttempt) {
          attempts.push(currentAttempt as PaymentAttempt);
        }
        attemptNumber++;
        currentAttempt = {
          attemptId: event.attemptId,
          attemptNumber,
          createdAt: event.occurredAt,
        };
        break;

      case "PaymentSent":
        if (currentAttempt) {
          currentAttempt.sentAt = event.occurredAt;
        }
        break;

      case "PaymentAcknowledged":
        if (currentAttempt) {
          currentAttempt.acknowledgedAt = event.occurredAt;
        }
        break;

      case "PaymentSettled":
        if (currentAttempt) {
          currentAttempt.settledAt = event.occurredAt;
        }
        break;

      case "PaymentFailed":
        if (currentAttempt) {
          currentAttempt.failedAt = event.occurredAt;
          currentAttempt.failureReason = event.reason;
        }
        break;
    }
  }

  // Push final attempt
  if (currentAttempt) {
    attempts.push(currentAttempt as PaymentAttempt);
  }

  // Calculate hashes for replay proof
  const eventsHash = createHash("sha256")
    .update(
      JSON.stringify(events, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    )
    .digest("hex");

  const stateHash = createHash("sha256")
    .update(
      JSON.stringify({
        state: finalState,
        fundsSettled: fundsSettled.toString(),
      })
    )
    .digest("hex");

  // Build pack
  const pack: NPPEvidencePack = {
    packId: `npp-evidence-${paymentIntent.paymentIntentId}`,
    packVersion: "1.0",
    generatedAt: new Date(),
    paymentIntent,
    railDecision,
    attempts,
    lifecycleEvents: events,
    opsActions,
    finalState: {
      state: finalState,
      fundsSettled,
      settledAt: attempts[attempts.length - 1]?.settledAt,
      failureReason: attempts[attempts.length - 1]?.failureReason,
    },
    replayProof: {
      eventCount: events.length,
      eventsHash,
      stateHash,
    },
  };

  return pack;
}

/**
 * Verify NPP Evidence Pack integrity
 */
export function verifyNPPEvidencePack(pack: NPPEvidencePack): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check event count
  if (pack.replayProof.eventCount !== pack.lifecycleEvents.length) {
    errors.push(
      `Event count mismatch: expected ${pack.replayProof.eventCount}, got ${pack.lifecycleEvents.length}`
    );
  }

  // Verify events hash
  const eventsHash = createHash("sha256")
    .update(
      JSON.stringify(pack.lifecycleEvents, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    )
    .digest("hex");

  if (eventsHash !== pack.replayProof.eventsHash) {
    errors.push("Events hash mismatch - evidence may be tampered");
  }

  // Verify state hash
  const stateHash = createHash("sha256")
    .update(
      JSON.stringify({
        state: pack.finalState.state,
        fundsSettled: pack.finalState.fundsSettled.toString(),
      })
    )
    .digest("hex");

  if (stateHash !== pack.replayProof.stateHash) {
    errors.push("State hash mismatch - evidence may be tampered");
  }

  // Check terminal state consistency
  const isTerminal = [
    NPPPaymentState.SETTLED,
    NPPPaymentState.FAILED,
    NPPPaymentState.EXPIRED,
  ].includes(pack.finalState.state);

  if (!isTerminal) {
    errors.push(
      `Evidence pack should only be generated for terminal states, got ${pack.finalState.state}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Export NPP Evidence Pack to JSON
 */
export function exportNPPEvidencePackJSON(pack: NPPEvidencePack): string {
  return JSON.stringify(
    pack,
    (key, value) => {
      // Convert BigInt to string for JSON
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    },
    2
  );
}
