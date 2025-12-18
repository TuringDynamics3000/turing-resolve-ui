/**
 * BECS Types
 * 
 * Types for the Bulk Electronic Clearing System (BECS).
 * BECS uses the ABA (Australian Bankers Association) file format.
 * 
 * File Structure:
 * - Record Type 0: Descriptive Record (header)
 * - Record Type 1: Detail Records (transactions)
 * - Record Type 7: File Total Record (trailer)
 */

// ============================================
// BECS CORE TYPES
// ============================================

export type BecsTransactionCode =
  | "13"  // Externally initiated debit
  | "50"  // Externally initiated credit (general)
  | "51"  // Australian Government Security Interest
  | "52"  // Family Allowance
  | "53"  // Pay
  | "54"  // Pension
  | "55"  // Allotment
  | "56"  // Dividend
  | "57";  // Debenture/Note Interest

export type BecsSettlementCycle =
  | "SAME_DAY"   // DE (Direct Entry) Same Day
  | "NEXT_DAY";  // Standard overnight settlement

export type BecsBatchStatus =
  | "DRAFT"
  | "VALIDATED"
  | "SUBMITTED"
  | "PROCESSING"
  | "SETTLED"
  | "PARTIALLY_SETTLED"
  | "FAILED"
  | "REJECTED";

// ============================================
// ABA FILE FORMAT TYPES
// ============================================

/**
 * ABA Descriptive Record (Type 0)
 * Fixed 120 characters
 */
export interface AbaDescriptiveRecord {
  recordType: "0";
  
  // Reel sequence number (7 chars, right justified, zero filled)
  reelSequenceNumber: string;
  
  // Financial institution (3 chars)
  financialInstitution: string;
  
  // User preferred specification (blank or as agreed)
  userPreferredSpec: string;
  
  // User identification number (6 chars)
  userIdentificationNumber: string;
  
  // Description of entries (12 chars)
  description: string;
  
  // Date to be processed (DDMMYY)
  processingDate: string;
  
  // Time to be processed (HHMM) - optional
  processingTime?: string;
}

/**
 * ABA Detail Record (Type 1)
 * Fixed 120 characters
 */
export interface AbaDetailRecord {
  recordType: "1";
  
  // BSB number (7 chars, format: XXX-XXX)
  bsb: string;
  
  // Account number (9 chars, right justified, blank filled)
  accountNumber: string;
  
  // Indicator (1 char: blank, N, W, X, Y)
  indicator: " " | "N" | "W" | "X" | "Y";
  
  // Transaction code (2 chars)
  transactionCode: BecsTransactionCode;
  
  // Amount (10 chars, right justified, zero filled, in cents)
  amount: number;
  
  // Account title (32 chars, left justified, blank filled)
  accountTitle: string;
  
  // Lodgement reference (18 chars)
  lodgementReference: string;
  
  // Trace BSB (7 chars)
  traceBsb: string;
  
  // Trace account number (9 chars)
  traceAccountNumber: string;
  
  // Name of remitter (16 chars)
  remitterName: string;
  
  // Withholding tax amount (8 chars, right justified, zero filled)
  withholdingTaxAmount: number;
}

/**
 * ABA File Total Record (Type 7)
 * Fixed 120 characters
 */
export interface AbaFileTotalRecord {
  recordType: "7";
  
  // BSB format filler (7 chars: "999-999")
  bsbFiller: "999-999";
  
  // Net total (10 chars, right justified, zero filled)
  netTotal: number;
  
  // Credit total (10 chars, right justified, zero filled)
  creditTotal: number;
  
  // Debit total (10 chars, right justified, zero filled)
  debitTotal: number;
  
  // Count of type 1 records (6 chars, right justified, zero filled)
  recordCount: number;
}

// ============================================
// BECS BATCH TYPES
// ============================================

export interface BecsBatch {
  batchId: string;
  
  // Batch metadata
  description: string;
  settlementCycle: BecsSettlementCycle;
  processingDate: string;
  
  // Originator
  originatorBsb: string;
  originatorAccountNumber: string;
  originatorName: string;
  userIdentificationNumber: string;
  
  // Transactions
  transactions: BecsTransaction[];
  
  // Totals
  creditCount: number;
  debitCount: number;
  creditTotal: number;
  debitTotal: number;
  netTotal: number;
  
  // Status
  status: BecsBatchStatus;
  
  // File reference (after generation)
  abaFileReference?: string;
  abaFileContent?: string;
  
  // Submission
  submittedAt?: string;
  settledAt?: string;
  
  // Errors
  validationErrors?: string[];
  rejectionReason?: string;
  
  // Audit
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface BecsTransaction {
  transactionId: string;
  
  // Payment details
  transactionCode: BecsTransactionCode;
  amount: number;  // In cents
  
  // Beneficiary
  beneficiaryBsb: string;
  beneficiaryAccountNumber: string;
  beneficiaryName: string;
  
  // Reference
  lodgementReference: string;
  remitterName: string;
  
  // Withholding tax (optional)
  withholdingTaxAmount?: number;
  
  // Indicator
  indicator: " " | "N" | "W" | "X" | "Y";
  
  // Status within batch
  status: "PENDING" | "INCLUDED" | "EXCLUDED" | "SETTLED" | "RETURNED";
  returnReason?: string;
  
  // Link to payment
  paymentId?: string;
}

// ============================================
// BECS ADAPTER CONFIG
// ============================================

export interface BecsAdapterConfig {
  // Institution details
  financialInstitution: string;  // 3-char code
  userIdentificationNumber: string;  // 6-char APCA number
  
  // Originator details
  originatorBsb: string;
  originatorAccountNumber: string;
  originatorName: string;
  
  // Processing
  defaultSettlementCycle: BecsSettlementCycle;
  sameDayCutoffTime: string;  // HH:MM format
  
  // File generation
  outputDirectory: string;
  fileNamePrefix: string;
  
  // Limits
  maxTransactionsPerBatch: number;
  maxBatchAmount: number;
}

export const DEFAULT_BECS_CONFIG: BecsAdapterConfig = {
  financialInstitution: "TUR",
  userIdentificationNumber: "123456",
  originatorBsb: "000-000",
  originatorAccountNumber: "123456789",
  originatorName: "TURINGDYNAMICS",
  defaultSettlementCycle: "NEXT_DAY",
  sameDayCutoffTime: "09:00",
  outputDirectory: "/var/becs/outbound",
  fileNamePrefix: "TURING_DE",
  maxTransactionsPerBatch: 10000,
  maxBatchAmount: 100000000,  // $1M in cents
};

// ============================================
// BECS CALLBACK TYPES
// ============================================

export interface BecsCallback {
  callbackId: string;
  callbackType: "ACKNOWLEDGMENT" | "SETTLEMENT" | "RETURN";
  receivedAt: string;
  
  // Batch reference
  batchId: string;
  abaFileReference: string;
  
  // Status
  status: "ACCEPTED" | "REJECTED" | "SETTLED" | "PARTIALLY_SETTLED";
  
  // Settlement details
  settledCount?: number;
  settledAmount?: number;
  
  // Returns
  returnedTransactions?: {
    transactionId: string;
    returnCode: string;
    returnReason: string;
  }[];
  
  // Rejection
  rejectionCode?: string;
  rejectionReason?: string;
}

// ============================================
// BECS RETURN CODES
// ============================================

export const BECS_RETURN_CODES: Record<string, string> = {
  "1": "Invalid BSB number",
  "2": "Payment stopped",
  "3": "Account closed",
  "4": "Customer deceased",
  "5": "No account/incorrect account number",
  "6": "Refer to customer",
  "7": "Invalid user ID number",
  "8": "Invalid amount",
  "9": "Originator not authorised",
};
