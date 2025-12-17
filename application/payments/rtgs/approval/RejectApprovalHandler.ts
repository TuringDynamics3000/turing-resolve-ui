/**
 * Reject Approval Handler
 * 
 * Handles approval rejection requests for RTGS payments.
 * Terminal action - payment cannot proceed after rejection.
 */

import { RTGSPayment, applyRTGSEvent } from "../../../../core/payments/rtgs";
import { RTGSPaymentState, RTGSApprovalRole } from "../../../../core/payments/rtgs/RTGSPaymentState";
import { RTGSPaymentEvent } from "../../../../core/payments/rtgs/RTGSPaymentEvent";

/**
 * Reject Approval Request
 */
export interface RejectApprovalRequest {
  readonly rejectedBy: string;
  readonly rejectorRole: RTGSApprovalRole;
  readonly rejectionReason: string;
  readonly policyApproval: boolean; // Resolve policy check
}

/**
 * Reject Approval Result
 */
export interface RejectApprovalResult {
  readonly success: boolean;
  readonly eventsEmitted: RTGSPaymentEvent[];
  readonly fundsReleased: bigint;
  readonly error?: string;
}

/**
 * Reject approval for RTGS payment
 */
export async function rejectApproval(
  payment: RTGSPayment,
  request: RejectApprovalRequest
): Promise<RejectApprovalResult> {
  try {
    // Validate state
    if (payment.state !== RTGSPaymentState.PENDING_APPROVAL) {
      return {
        success: false,
        eventsEmitted: [],
        fundsReleased: 0n,
        error: `INVALID_STATE: Cannot reject approval in state ${payment.state}`,
      };
    }
    
    // Validate policy approval
    if (!request.policyApproval) {
      return {
        success: false,
        eventsEmitted: [],
        fundsReleased: 0n,
        error: "POLICY_DENIED: Resolve policy denied rejection",
      };
    }
    
    // Validate rejection reason
    if (!request.rejectionReason || request.rejectionReason.length === 0) {
      return {
        success: false,
        eventsEmitted: [],
        fundsReleased: 0n,
        error: "INVALID_REQUEST: Rejection reason is required",
      };
    }
    
    // Create ApprovalRejected event
    const approvalRejectedEvent: RTGSPaymentEvent = {
      type: "ApprovalRejected",
      paymentIntentId: payment.paymentIntentId,
      occurredAt: new Date(),
      rejectedBy: request.rejectedBy,
      rejectorRole: request.rejectorRole,
      rejectionReason: request.rejectionReason,
    };
    
    return {
      success: true,
      eventsEmitted: [approvalRejectedEvent],
      fundsReleased: payment.fundsEarmarked, // Release any earmarked funds
    };
  } catch (error) {
    return {
      success: false,
      eventsEmitted: [],
      fundsReleased: 0n,
      error: (error as Error).message,
    };
  }
}

/**
 * Validate reject approval request
 */
export function validateRejectApprovalRequest(
  request: RejectApprovalRequest
): boolean {
  return (
    request.rejectedBy.length > 0 &&
    Object.values(RTGSApprovalRole).includes(request.rejectorRole) &&
    request.rejectionReason.length > 0 &&
    typeof request.policyApproval === "boolean"
  );
}
