import {
  RTGSPayment,
  applyRTGSEvent,
  RTGSPaymentEvent,
  RTGSApprovalRole,
} from "../../../../core/payments/rtgs";
import {
  assertSeparationOfDuties,
  assertDualControl,
} from "../../../../core/payments/rtgs/RTGSInvariants";

export interface GrantApprovalRequest {
  approverId: string;
  approverRole: RTGSApprovalRole;
  approvalReason: string;
  policyApproval: boolean;
}

export interface GrantApprovalResult {
  success: boolean;
  eventsEmitted: RTGSPaymentEvent[];
  dualControlMet: boolean;
  error?: string;
}

export async function grantApproval(
  payment: RTGSPayment,
  request: GrantApprovalRequest
): Promise<GrantApprovalResult> {
  // Validate policy approval
  if (!request.policyApproval) {
    return {
      success: false,
      eventsEmitted: [],
      dualControlMet: false,
      error: "Policy approval required for RTGS payments",
    };
  }

  // Check separation of duties
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
      error: `Separation of duties violation: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // Check for duplicate approval
  const alreadyApproved = payment.approvals.some(
    (approval) => approval.approverId === request.approverId
  );
  if (alreadyApproved) {
    return {
      success: false,
      eventsEmitted: [],
      dualControlMet: false,
      error: "DUPLICATE_APPROVAL: Approver has already approved this payment",
    };
  }

  const events: RTGSPaymentEvent[] = [];

  // Emit ApprovalGranted event
  const approvalEvent: RTGSPaymentEvent = {
    type: "ApprovalGranted",
    paymentIntentId: payment.paymentIntentId,
    occurredAt: new Date(),
    approverId: request.approverId,
    approverRole: request.approverRole,
    approvalSequence: payment.approvals.length + 1,
  };
  events.push(approvalEvent);

  // Apply event to get updated payment state
  let updatedPayment = applyRTGSEvent(payment, approvalEvent);

  // Check if dual-control is met
  const requiredApprovers = payment.approvalThreshold?.minApprovers || 2;
  const currentApprovers = updatedPayment.approvals.length;
  const dualControlMet = currentApprovers >= requiredApprovers;

  if (dualControlMet) {
    // Emit DualControlVerified event
    const dualControlEvent: RTGSPaymentEvent = {
      type: "DualControlVerified",
      paymentIntentId: payment.paymentIntentId,
      occurredAt: new Date(),
      approvers: updatedPayment.approvals,
      allRequirementsMet: true,
    };
    events.push(dualControlEvent);
  }

  return {
    success: true,
    eventsEmitted: events,
    dualControlMet,
  };
}
