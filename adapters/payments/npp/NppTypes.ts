/**
 * NPP Types
 * 
 * ISO 20022 message types for the New Payments Platform (NPP)
 * 
 * NPP uses ISO 20022 XML messages:
 * - pacs.008: FI to FI Customer Credit Transfer
 * - pacs.002: FI to FI Payment Status Report
 * - pacs.004: Payment Return
 * - camt.056: FI to FI Payment Cancellation Request
 */

// ============================================
// NPP CORE TYPES
// ============================================

export type NppMessageType =
  | "pacs.008"  // Credit Transfer
  | "pacs.002"  // Status Report
  | "pacs.004"  // Payment Return
  | "camt.056"; // Cancellation Request

export type NppTransactionStatus =
  | "ACCP"  // Accepted Customer Profile
  | "ACSC"  // Accepted Settlement Completed
  | "ACSP"  // Accepted Settlement In Process
  | "ACTC"  // Accepted Technical Validation
  | "ACWC"  // Accepted With Change
  | "PDNG"  // Pending
  | "RCVD"  // Received
  | "RJCT"; // Rejected

export type NppRejectReasonCode =
  | "AC01"  // Incorrect Account Number
  | "AC04"  // Closed Account Number
  | "AC06"  // Blocked Account
  | "AG01"  // Transaction Forbidden
  | "AG02"  // Invalid Bank Operation Code
  | "AM01"  // Zero Amount
  | "AM02"  // Not Allowed Amount
  | "AM03"  // Not Allowed Currency
  | "AM04"  // Insufficient Funds
  | "AM05"  // Duplication
  | "BE01"  // Inconsistent With End Customer
  | "BE04"  // Missing Creditor Address
  | "BE05"  // Unrecognised Initiating Party
  | "DT01"  // Invalid Date
  | "FF01"  // Invalid File Format
  | "MD01"  // No Mandate
  | "MS02"  // Not Specified Reason Customer Generated
  | "MS03"  // Not Specified Reason Agent Generated
  | "RC01"  // Bank Identifier Incorrect
  | "RR01"  // Missing Debtor Account Or Identification
  | "RR02"  // Missing Debtor Name Or Address
  | "RR03"  // Missing Creditor Name Or Address
  | "RR04"  // Regulatory Reason
  | "TM01"; // Cut Off Time

// ============================================
// NPP MESSAGE STRUCTURES
// ============================================

/**
 * NPP Credit Transfer (pacs.008)
 */
export interface NppCreditTransfer {
  messageId: string;
  creationDateTime: string;
  numberOfTransactions: number;
  settlementMethod: "CLRG" | "INDA" | "INGA";
  
  // Payment Information
  paymentInformation: {
    paymentInformationId: string;
    paymentMethod: "TRF";
    requestedExecutionDate: string;
    
    // Debtor
    debtor: NppParty;
    debtorAccount: NppAccount;
    debtorAgent: NppAgent;
    
    // Credit Transfer Transaction
    creditTransferTransaction: {
      paymentId: NppPaymentId;
      amount: NppAmount;
      creditor: NppParty;
      creditorAccount: NppAccount;
      creditorAgent: NppAgent;
      remittanceInformation?: NppRemittanceInfo;
    };
  };
}

/**
 * NPP Payment Status Report (pacs.002)
 */
export interface NppPaymentStatusReport {
  messageId: string;
  creationDateTime: string;
  originalMessageId: string;
  originalMessageNameId: string;
  
  // Transaction Status
  transactionStatus: NppTransactionStatus;
  statusReasonInformation?: {
    reason: {
      code: NppRejectReasonCode;
    };
    additionalInformation?: string;
  };
  
  // Original Transaction
  originalTransactionReference?: {
    amount: NppAmount;
    requestedExecutionDate: string;
    debtor: NppParty;
    debtorAccount: NppAccount;
    creditor: NppParty;
    creditorAccount: NppAccount;
  };
}

/**
 * NPP Payment Return (pacs.004)
 */
export interface NppPaymentReturn {
  messageId: string;
  creationDateTime: string;
  originalMessageId: string;
  
  // Return Information
  returnReason: {
    code: NppRejectReasonCode;
  };
  returnedAmount: NppAmount;
  
  // Original Transaction
  originalTransactionReference: {
    paymentId: NppPaymentId;
    amount: NppAmount;
    debtor: NppParty;
    creditor: NppParty;
  };
}

// ============================================
// NPP COMPONENT TYPES
// ============================================

export interface NppParty {
  name: string;
  postalAddress?: {
    streetName?: string;
    buildingNumber?: string;
    postCode?: string;
    townName?: string;
    countrySubDivision?: string;
    country: string;
  };
  identification?: {
    organisationId?: {
      bic?: string;
      other?: {
        id: string;
        schemeName: string;
      };
    };
    privateId?: {
      dateAndPlaceOfBirth?: {
        birthDate: string;
        cityOfBirth: string;
        countryOfBirth: string;
      };
      other?: {
        id: string;
        schemeName: string;
      };
    };
  };
}

export interface NppAccount {
  identification: {
    iban?: string;
    other?: {
      id: string;  // BSB + Account Number
      schemeName: {
        code: "BBAN" | "CUST";
      };
    };
  };
  type?: {
    code: "CACC" | "SVGS" | "LOAN";  // Current, Savings, Loan
  };
  currency?: string;
}

export interface NppAgent {
  financialInstitutionId: {
    bic?: string;
    clearingSystemMemberId?: {
      clearingSystemId: {
        code: "AUBSB";  // Australian BSB
      };
      memberId: string;  // BSB number
    };
  };
}

export interface NppPaymentId {
  instructionId: string;
  endToEndId: string;
  transactionId?: string;
  uetr?: string;  // Unique End-to-end Transaction Reference
}

export interface NppAmount {
  value: number;
  currency: string;
}

export interface NppRemittanceInfo {
  unstructured?: string[];
  structured?: {
    creditorReferenceInformation?: {
      type: {
        codOrPrtry: {
          code: "SCOR" | "RADM" | "RPIN";
        };
      };
      reference: string;
    };
  };
}

// ============================================
// NPP OSKO OVERLAY
// ============================================

/**
 * Osko-specific extensions for NPP
 */
export interface OskoPaymentInfo {
  serviceLevel: "OSKO";
  categoryPurpose?: "SALA" | "PENS" | "SUPP" | "TRAD";  // Salary, Pension, Supplier, Trade
  
  // PayID (alias) support
  payId?: {
    type: "TELI" | "EMAL" | "ORGN" | "AUBN";  // Phone, Email, Org Name, ABN
    value: string;
  };
  
  // Request to Pay
  requestToPay?: {
    requestId: string;
    expiryDateTime: string;
    amount: NppAmount;
    creditorReference: string;
  };
}

// ============================================
// NPP CALLBACK TYPES
// ============================================

export interface NppCallback {
  callbackId: string;
  callbackType: "STATUS" | "RETURN" | "CANCELLATION";
  receivedAt: string;
  
  // Original reference
  originalMessageId: string;
  originalEndToEndId: string;
  
  // Status
  status: NppTransactionStatus;
  reasonCode?: NppRejectReasonCode;
  reasonDescription?: string;
  
  // Settlement (if applicable)
  settlementDate?: string;
  settlementReference?: string;
}

// ============================================
// NPP ADAPTER CONFIG
// ============================================

export interface NppAdapterConfig {
  // Connection
  endpoint: string;
  participantBic: string;
  participantBsb: string;
  
  // Authentication
  certificatePath: string;
  privateKeyPath: string;
  
  // Timeouts
  connectionTimeoutMs: number;
  readTimeoutMs: number;
  
  // Retry
  maxRetries: number;
  retryDelayMs: number;
  
  // Features
  oskoEnabled: boolean;
  payIdEnabled: boolean;
  requestToPayEnabled: boolean;
}

export const DEFAULT_NPP_CONFIG: NppAdapterConfig = {
  endpoint: "https://npp.rba.gov.au/api/v1",
  participantBic: "TURIAUSX",
  participantBsb: "000-000",
  certificatePath: "/etc/npp/cert.pem",
  privateKeyPath: "/etc/npp/key.pem",
  connectionTimeoutMs: 5000,
  readTimeoutMs: 30000,
  maxRetries: 3,
  retryDelayMs: 1000,
  oskoEnabled: true,
  payIdEnabled: true,
  requestToPayEnabled: false,
};
