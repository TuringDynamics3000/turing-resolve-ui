/**
 * NPP Message Mapper
 * 
 * Maps between internal payment domain and ISO 20022 NPP messages.
 * 
 * CRITICAL: This mapper is stateless and deterministic.
 * Same input always produces same output.
 */

import { nanoid } from "nanoid";
import type {
  NppCreditTransfer,
  NppPaymentStatusReport,
  NppPaymentReturn,
  NppCallback,
  NppParty,
  NppAccount,
  NppAgent,
  NppAmount,
  NppTransactionStatus,
  NppRejectReasonCode,
} from "./NppTypes";
import type { Payment, PaymentInstruction, PaymentParty } from "../../../server/core/payments/PaymentsSpine";

// ============================================
// INTERNAL TO NPP MAPPING
// ============================================

/**
 * Map internal payment to NPP Credit Transfer (pacs.008).
 */
export function mapToNppCreditTransfer(payment: Payment): NppCreditTransfer {
  const instruction = payment.instruction;
  const now = new Date().toISOString();
  
  return {
    messageId: `MSG-${nanoid(16)}`,
    creationDateTime: now,
    numberOfTransactions: 1,
    settlementMethod: "CLRG",
    
    paymentInformation: {
      paymentInformationId: instruction.instructionId,
      paymentMethod: "TRF",
      requestedExecutionDate: instruction.requestedExecutionDate,
      
      debtor: mapToNppParty(instruction.debtor),
      debtorAccount: mapToNppAccount(instruction.debtor),
      debtorAgent: mapToNppAgent(instruction.debtor.bsb),
      
      creditTransferTransaction: {
        paymentId: {
          instructionId: instruction.instructionId,
          endToEndId: instruction.endToEndId,
          uetr: `${nanoid(8)}-${nanoid(4)}-${nanoid(4)}-${nanoid(4)}-${nanoid(12)}`,
        },
        amount: {
          value: instruction.amount,
          currency: instruction.currency,
        },
        creditor: mapToNppParty(instruction.creditor),
        creditorAccount: mapToNppAccount(instruction.creditor),
        creditorAgent: mapToNppAgent(instruction.creditor.bsb),
        remittanceInformation: instruction.remittanceInfo ? {
          unstructured: [instruction.remittanceInfo],
        } : undefined,
      },
    },
  };
}

/**
 * Map internal party to NPP party.
 */
function mapToNppParty(party: PaymentParty): NppParty {
  return {
    name: party.name,
    postalAddress: party.address ? {
      streetName: party.address,
      country: party.country,
    } : undefined,
  };
}

/**
 * Map internal party to NPP account.
 */
function mapToNppAccount(party: PaymentParty): NppAccount {
  return {
    identification: {
      other: {
        id: `${party.bsb || "000000"}${party.accountNumber}`,
        schemeName: {
          code: "BBAN",
        },
      },
    },
    currency: "AUD",
  };
}

/**
 * Map BSB to NPP agent.
 */
function mapToNppAgent(bsb?: string): NppAgent {
  return {
    financialInstitutionId: {
      clearingSystemMemberId: {
        clearingSystemId: {
          code: "AUBSB",
        },
        memberId: bsb || "000-000",
      },
    },
  };
}

// ============================================
// NPP TO INTERNAL MAPPING
// ============================================

/**
 * Map NPP Payment Status Report to internal callback.
 */
export function mapFromNppStatusReport(report: NppPaymentStatusReport): NppCallback {
  return {
    callbackId: `CB-${nanoid(10)}`,
    callbackType: "STATUS",
    receivedAt: new Date().toISOString(),
    originalMessageId: report.originalMessageId,
    originalEndToEndId: report.originalTransactionReference?.debtor?.name || "",
    status: report.transactionStatus,
    reasonCode: report.statusReasonInformation?.reason?.code,
    reasonDescription: report.statusReasonInformation?.additionalInformation,
    settlementDate: report.transactionStatus === "ACSC" ? new Date().toISOString().split("T")[0] : undefined,
    settlementReference: report.messageId,
  };
}

/**
 * Map NPP Payment Return to internal callback.
 */
export function mapFromNppPaymentReturn(returnMsg: NppPaymentReturn): NppCallback {
  return {
    callbackId: `CB-${nanoid(10)}`,
    callbackType: "RETURN",
    receivedAt: new Date().toISOString(),
    originalMessageId: returnMsg.originalMessageId,
    originalEndToEndId: returnMsg.originalTransactionReference.paymentId.endToEndId,
    status: "RJCT",
    reasonCode: returnMsg.returnReason.code,
    reasonDescription: mapRejectCodeToDescription(returnMsg.returnReason.code),
  };
}

/**
 * Map NPP status to internal payment status.
 */
export function mapNppStatusToInternal(nppStatus: NppTransactionStatus): "PENDING" | "SETTLED" | "FAILED" {
  switch (nppStatus) {
    case "ACSC":
      return "SETTLED";
    case "RJCT":
      return "FAILED";
    case "ACCP":
    case "ACSP":
    case "ACTC":
    case "ACWC":
    case "PDNG":
    case "RCVD":
    default:
      return "PENDING";
  }
}

/**
 * Map reject code to human-readable description.
 */
export function mapRejectCodeToDescription(code: NppRejectReasonCode): string {
  const descriptions: Record<NppRejectReasonCode, string> = {
    AC01: "Incorrect account number",
    AC04: "Account closed",
    AC06: "Account blocked",
    AG01: "Transaction forbidden",
    AG02: "Invalid bank operation code",
    AM01: "Zero amount not allowed",
    AM02: "Amount not allowed",
    AM03: "Currency not allowed",
    AM04: "Insufficient funds",
    AM05: "Duplicate payment",
    BE01: "Inconsistent with end customer",
    BE04: "Missing creditor address",
    BE05: "Unrecognised initiating party",
    DT01: "Invalid date",
    FF01: "Invalid file format",
    MD01: "No mandate",
    MS02: "Reason not specified (customer)",
    MS03: "Reason not specified (agent)",
    RC01: "Bank identifier incorrect",
    RR01: "Missing debtor account or identification",
    RR02: "Missing debtor name or address",
    RR03: "Missing creditor name or address",
    RR04: "Regulatory reason",
    TM01: "Cut-off time exceeded",
  };
  
  return descriptions[code] || `Unknown reason: ${code}`;
}

// ============================================
// PAYMENT FACT MAPPING
// ============================================

export type PaymentFactType =
  | "PAYMENT_SENT"
  | "PAYMENT_SETTLED"
  | "PAYMENT_FAILED";

/**
 * Map NPP callback to Payment Fact.
 * 
 * AUTHORITATIVE MAPPING (from todo.md):
 * - Submission accepted → PAYMENT_SENT
 * - Settlement confirmed → PAYMENT_SETTLED
 * - Rejected/failed → PAYMENT_FAILED
 * - No other facts permitted
 */
export function mapCallbackToPaymentFact(callback: NppCallback): {
  factType: PaymentFactType;
  factData: Record<string, unknown>;
} | null {
  switch (callback.status) {
    case "ACCP":
    case "ACTC":
    case "RCVD":
      // Submission accepted
      return {
        factType: "PAYMENT_SENT",
        factData: {
          originalMessageId: callback.originalMessageId,
          endToEndId: callback.originalEndToEndId,
          acceptedAt: callback.receivedAt,
          schemeReference: callback.settlementReference,
        },
      };
    
    case "ACSC":
      // Settlement confirmed
      return {
        factType: "PAYMENT_SETTLED",
        factData: {
          originalMessageId: callback.originalMessageId,
          endToEndId: callback.originalEndToEndId,
          settledAt: callback.receivedAt,
          settlementDate: callback.settlementDate,
          settlementReference: callback.settlementReference,
        },
      };
    
    case "RJCT":
      // Rejected/failed
      return {
        factType: "PAYMENT_FAILED",
        factData: {
          originalMessageId: callback.originalMessageId,
          endToEndId: callback.originalEndToEndId,
          failedAt: callback.receivedAt,
          reasonCode: callback.reasonCode,
          reasonDescription: callback.reasonDescription,
        },
      };
    
    case "ACSP":
    case "ACWC":
    case "PDNG":
      // Intermediate states - no fact emitted
      return null;
    
    default:
      return null;
  }
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate NPP Credit Transfer message.
 */
export function validateNppCreditTransfer(msg: NppCreditTransfer): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!msg.messageId) {
    errors.push("Missing messageId");
  }
  
  if (!msg.paymentInformation) {
    errors.push("Missing paymentInformation");
  } else {
    const pi = msg.paymentInformation;
    
    if (!pi.debtor?.name) {
      errors.push("Missing debtor name");
    }
    
    if (!pi.debtorAccount?.identification) {
      errors.push("Missing debtor account");
    }
    
    const ctt = pi.creditTransferTransaction;
    if (!ctt) {
      errors.push("Missing creditTransferTransaction");
    } else {
      if (!ctt.amount?.value || ctt.amount.value <= 0) {
        errors.push("Invalid amount");
      }
      
      if (!ctt.creditor?.name) {
        errors.push("Missing creditor name");
      }
      
      if (!ctt.creditorAccount?.identification) {
        errors.push("Missing creditor account");
      }
      
      if (!ctt.paymentId?.endToEndId) {
        errors.push("Missing endToEndId");
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
