/**
 * Grant Approval Handler
 * 
 * Handles approval grant requests for RTGS payments.
 * Enforces dual-control and separation of duties.
 */

import { RTGSPayment, applyRTGSEvent } from "../../../../core/payments/rtgs";
import {
  assertSeparationOfDuties,
  assertApprovalNotExpired,
} from "../../../../core/payments/rtgs/RTGSInvariants";
import { RTGSPaymentState, RTGSApprovalRole } from "../../../../core/payments/rtgs/RTGSPaymentState";
import { RTGSPaymentEvent } from "../../../../core/payments/rtgs/RTGSPaymentEvent";

/**
 * Grant Approval Request
 */
export interface GrantApprovalRequest {
  readonly approverId: string;
  readonly approverRole: RTGSApprovalRole;
  readonly approvalReason?: string;
  readonly policyApproval: boolean; // Resolve policy check
}

/**
 * Grant Approval Result
 */
export interface GrantApprovalResult {
  readonly success: boolean;
  readonly eventsEmitted: RTGSPaymentEvent[];
  readonly dualControlMet: boolean;
  readonly error?: string;
}

/**
 * Grant approval for RTGS payment
 */
export async function grantApproval(
  payment: RTGSPayment,
  request: GrantApprovalRequest
): Promise<GrantApprovalResult> {
  try {
    // Validate state
    if (payment.state !== RTGSPaymentState.PENDING_APPROVAL) {
      return {
        success: false,
        eventsEmitted: [],
        dualControlMet: false,
        error: `INVALID_STATE: Cannot grant approval in state ${payment.state}`,
      };
    }
    
    // Validate policy approval
    if (!request.policyApproval) {
      return {
        success: false,
        eventsEmitted: [],
        dualControlMet: false,
        error: "POLICY_DENIED: Resolve policy denied approval",
      };
    }
    
    // Validate separation of duties
    try {
      assertSeparationOfDuties(payment.initiatorId, [
        ...payment.approvals,
        {
          approverId: request.approverId,
          approverRole: request.approverRole,
          approvedAt: new Date(),
        },
      ]);
    } catch (error) {
      return {
        success: false,
        eventsEmitted: [],
        dualControlMet: false,
        error: (error as Error).message,
      };
    }
    
    // Validate approval not expired
    if (payment.approvalExpiresAt) {
      try {
        assertApprovalNotExpired(payment.approvalExpiresAt);
      } catch (error) {
        return {
          success: false,
          eventsEmitted: [],
          dualControlMet: false,
          error: (error as Error).message,
        };
      }
    }
    
    // Check if approver already approved
    const alreadyApproved = payment.approvals.some(
      (a) => a.approverId === request.approverId
    );
    if (alreadyApproved) {
      return {
        success: false,
        eventsEmitted: [],
        dualControlMet: false,
        error: "DUPLICATE_APPROVAL: Approver already approved this payment",
      };
    }
    
    // Create ApprovalGranted event
    const approvalGrantedEvent: RTGSPaymentEvent = {
      type: "ApprovalGranted",
      paymentIntentId: payment.paymentIntentId,
      occurredAt: new Date(),
      approverId: request.approverId,
      approverRole: request.approverRole,
      approvalSequence: payment.approvals.length + 1,
      approvalReason: request.approvalReason,
    };
    
    // Apply event
    const updatedPayment = applyRTGSEvent(payment, approvalGrantedEvent);
    
    // Check if dual-control requirements met
    const dualControlMet = updatedPayment.approvals.length >= payment.requiredApprovers;
    
    const eventsEmitted: RTGSPaymentEvent[] = [approvalGrantedEvent];
    
    // If dual-control met, emit DualControlVerified event
    if (dualControlMet) {
      const dualControlEvent: RTGSPaymentEvent = {
        type: "DualControlVerified",
        paymentIntentId: payment.paymentIntentId,
        occurredAt: new Date(),
        approvers: updatedPayment.approvals,
        allRequirementsMet: true,
      };
      eventsEmitted.push(dualControlEvent);
    }
    
    return {
      success: true,
      eventsEmitted,
      dualControlMet,
    };
  } catch (error) {
    return {
      success: false,
      eventsEmitted: [],
      dualControlMet: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Validate grant approval request
 */
export function validateGrantApprovalRequest(
  request: GrantApprovalRequest
): boolean {
  return (
    request.approverId.length > 0 &&
    Object.values(RTGSApprovalRole).includes(request.approverRole) &&
    typeof request.policyApproval === "boolean"
  );
}
