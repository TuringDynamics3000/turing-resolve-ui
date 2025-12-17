import {
  RTGSPayment,
  RTGSPaymentEvent,
  RTGSApprovalRole,
} from "../../../../core/payments/rtgs";

export interface RejectApprovalRequest {
  rejectedBy: string;
  rejectorRole: RTGSApprovalRole;
  rejectionReason: string;
  policyApproval: boolean;
}

export interface RejectApprovalResult {
  success: boolean;
  eventsEmitted: RTGSPaymentEvent[];
  fundsReleased: bigint;
  error?: string;
}

export async function rejectApproval(
  payment: RTGSPayment,
  request: RejectApprovalRequest
): Promise<RejectApprovalResult> {
  // Validate policy approval
  if (!request.policyApproval) {
    return {
      success: false,
      eventsEmitted: [],
      fundsReleased: 0n,
      error: "Policy approval required for RTGS payment rejection",
    };
  }

  // Validate rejection reason
  if (!request.rejectionReason || request.rejectionReason.trim().length === 0) {
    return {
      success: false,
      eventsEmitted: [],
      fundsReleased: 0n,
      error: "Rejection reason is required",
    };
  }

  const events: RTGSPaymentEvent[] = [];

  // Emit ApprovalRejected event
  const rejectionEvent: RTGSPaymentEvent = {
    type: "ApprovalRejected",
    paymentIntentId: payment.paymentIntentId,
    occurredAt: new Date(),
    rejectedBy: request.rejectedBy,
    rejectorRole: request.rejectorRole,
    rejectionReason: request.rejectionReason,
  };
  events.push(rejectionEvent);

  return {
    success: true,
    eventsEmitted: events,
    fundsReleased: payment.fundsEarmarked,
  };
}
