/**
 * BECS ABA File Generator
 * 
 * Generates ABA (Australian Bankers Association) format files
 * for BECS Direct Entry processing.
 * 
 * ABA files are fixed-width text files with 120 characters per line.
 */

import type {
  BecsBatch,
  BecsTransaction,
  AbaDescriptiveRecord,
  AbaDetailRecord,
  AbaFileTotalRecord,
} from "./BecsTypes";

// ============================================
// ABA FILE GENERATOR
// ============================================

class BecsAbaGenerator {
  /**
   * Generate ABA file content from a batch.
   */
  generateAbaFile(batch: BecsBatch): string {
    const lines: string[] = [];
    
    // Record Type 0: Descriptive Record
    lines.push(this.generateDescriptiveRecord(batch));
    
    // Record Type 1: Detail Records
    for (const tx of batch.transactions) {
      if (tx.status === "INCLUDED" || tx.status === "PENDING") {
        lines.push(this.generateDetailRecord(tx, batch));
      }
    }
    
    // Record Type 7: File Total Record
    lines.push(this.generateFileTotalRecord(batch));
    
    return lines.join("\r\n") + "\r\n";
  }

  /**
   * Generate Descriptive Record (Type 0).
   */
  private generateDescriptiveRecord(batch: BecsBatch): string {
    const record: string[] = [];
    
    // Position 1: Record Type (1 char)
    record.push("0");
    
    // Position 2-8: Blank (7 chars)
    record.push(" ".repeat(7));
    
    // Position 9-10: Reel Sequence Number (2 chars)
    record.push("01");
    
    // Position 11-13: Financial Institution (3 chars)
    record.push(this.padRight("TUR", 3));
    
    // Position 14-20: Blank (7 chars)
    record.push(" ".repeat(7));
    
    // Position 21-26: User Preferred Specification (6 chars)
    record.push(" ".repeat(6));
    
    // Position 27-32: User Identification Number (6 chars)
    record.push(this.padLeft(batch.userIdentificationNumber, 6, "0"));
    
    // Position 33-44: Description of Entries (12 chars)
    record.push(this.padRight(batch.description.substring(0, 12), 12));
    
    // Position 45-50: Date to be Processed (6 chars, DDMMYY)
    record.push(this.formatDate(batch.processingDate));
    
    // Position 51-54: Time to be Processed (4 chars, HHMM) - optional
    record.push(" ".repeat(4));
    
    // Position 55-74: Blank (20 chars)
    record.push(" ".repeat(20));
    
    // Position 75-120: Blank (46 chars)
    record.push(" ".repeat(46));
    
    return record.join("");
  }

  /**
   * Generate Detail Record (Type 1).
   */
  private generateDetailRecord(tx: BecsTransaction, batch: BecsBatch): string {
    const record: string[] = [];
    
    // Position 1: Record Type (1 char)
    record.push("1");
    
    // Position 2-8: BSB Number (7 chars, format: XXX-XXX)
    record.push(this.formatBsb(tx.beneficiaryBsb));
    
    // Position 9-17: Account Number (9 chars, right justified, blank filled)
    record.push(this.padLeft(tx.beneficiaryAccountNumber, 9));
    
    // Position 18: Indicator (1 char)
    record.push(tx.indicator);
    
    // Position 19-20: Transaction Code (2 chars)
    record.push(tx.transactionCode);
    
    // Position 21-30: Amount (10 chars, right justified, zero filled)
    record.push(this.padLeft(tx.amount.toString(), 10, "0"));
    
    // Position 31-62: Account Title (32 chars, left justified, blank filled)
    record.push(this.padRight(tx.beneficiaryName.substring(0, 32), 32));
    
    // Position 63-80: Lodgement Reference (18 chars)
    record.push(this.padRight(tx.lodgementReference.substring(0, 18), 18));
    
    // Position 81-87: Trace BSB (7 chars)
    record.push(this.formatBsb(batch.originatorBsb));
    
    // Position 88-96: Trace Account Number (9 chars)
    record.push(this.padLeft(batch.originatorAccountNumber, 9));
    
    // Position 97-112: Name of Remitter (16 chars)
    record.push(this.padRight(tx.remitterName.substring(0, 16), 16));
    
    // Position 113-120: Withholding Tax Amount (8 chars, right justified, zero filled)
    record.push(this.padLeft((tx.withholdingTaxAmount || 0).toString(), 8, "0"));
    
    return record.join("");
  }

  /**
   * Generate File Total Record (Type 7).
   */
  private generateFileTotalRecord(batch: BecsBatch): string {
    const record: string[] = [];
    
    // Position 1: Record Type (1 char)
    record.push("7");
    
    // Position 2-8: BSB Format Filler (7 chars)
    record.push("999-999");
    
    // Position 9-20: Blank (12 chars)
    record.push(" ".repeat(12));
    
    // Position 21-30: Net Total (10 chars, right justified, zero filled)
    record.push(this.padLeft(Math.abs(batch.netTotal).toString(), 10, "0"));
    
    // Position 31-40: Credit Total (10 chars, right justified, zero filled)
    record.push(this.padLeft(batch.creditTotal.toString(), 10, "0"));
    
    // Position 41-50: Debit Total (10 chars, right justified, zero filled)
    record.push(this.padLeft(batch.debitTotal.toString(), 10, "0"));
    
    // Position 51-56: Blank (6 chars)
    record.push(" ".repeat(6));
    
    // Position 57-62: Count of Type 1 Records (6 chars, right justified, zero filled)
    const recordCount = batch.transactions.filter(
      tx => tx.status === "INCLUDED" || tx.status === "PENDING"
    ).length;
    record.push(this.padLeft(recordCount.toString(), 6, "0"));
    
    // Position 63-120: Blank (58 chars)
    record.push(" ".repeat(58));
    
    return record.join("");
  }

  /**
   * Validate ABA file content.
   */
  validateAbaFile(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const lines = content.split(/\r?\n/).filter(line => line.length > 0);
    
    if (lines.length < 3) {
      errors.push("ABA file must have at least 3 records (header, detail, trailer)");
      return { valid: false, errors };
    }
    
    // Validate header
    if (!lines[0].startsWith("0")) {
      errors.push("First record must be Type 0 (Descriptive Record)");
    }
    if (lines[0].length !== 120) {
      errors.push(`Header record must be 120 characters, got ${lines[0].length}`);
    }
    
    // Validate detail records
    for (let i = 1; i < lines.length - 1; i++) {
      if (!lines[i].startsWith("1")) {
        errors.push(`Record ${i + 1} must be Type 1 (Detail Record)`);
      }
      if (lines[i].length !== 120) {
        errors.push(`Record ${i + 1} must be 120 characters, got ${lines[i].length}`);
      }
    }
    
    // Validate trailer
    const trailer = lines[lines.length - 1];
    if (!trailer.startsWith("7")) {
      errors.push("Last record must be Type 7 (File Total Record)");
    }
    if (trailer.length !== 120) {
      errors.push(`Trailer record must be 120 characters, got ${trailer.length}`);
    }
    
    return { valid: errors.length === 0, errors };
  }

  /**
   * Parse ABA file content.
   */
  parseAbaFile(content: string): {
    header?: AbaDescriptiveRecord;
    transactions: AbaDetailRecord[];
    trailer?: AbaFileTotalRecord;
    errors: string[];
  } {
    const errors: string[] = [];
    const lines = content.split(/\r?\n/).filter(line => line.length > 0);
    const transactions: AbaDetailRecord[] = [];
    let header: AbaDescriptiveRecord | undefined;
    let trailer: AbaFileTotalRecord | undefined;
    
    for (const line of lines) {
      if (line.startsWith("0")) {
        header = this.parseDescriptiveRecord(line);
      } else if (line.startsWith("1")) {
        transactions.push(this.parseDetailRecord(line));
      } else if (line.startsWith("7")) {
        trailer = this.parseFileTotalRecord(line);
      } else {
        errors.push(`Unknown record type: ${line.charAt(0)}`);
      }
    }
    
    return { header, transactions, trailer, errors };
  }

  /**
   * Parse Descriptive Record.
   */
  private parseDescriptiveRecord(line: string): AbaDescriptiveRecord {
    return {
      recordType: "0",
      reelSequenceNumber: line.substring(8, 10).trim(),
      financialInstitution: line.substring(10, 13).trim(),
      userPreferredSpec: line.substring(20, 26).trim(),
      userIdentificationNumber: line.substring(26, 32).trim(),
      description: line.substring(32, 44).trim(),
      processingDate: line.substring(44, 50).trim(),
      processingTime: line.substring(50, 54).trim() || undefined,
    };
  }

  /**
   * Parse Detail Record.
   */
  private parseDetailRecord(line: string): AbaDetailRecord {
    return {
      recordType: "1",
      bsb: line.substring(1, 8).trim(),
      accountNumber: line.substring(8, 17).trim(),
      indicator: line.charAt(17) as " " | "N" | "W" | "X" | "Y",
      transactionCode: line.substring(18, 20) as any,
      amount: parseInt(line.substring(20, 30), 10),
      accountTitle: line.substring(30, 62).trim(),
      lodgementReference: line.substring(62, 80).trim(),
      traceBsb: line.substring(80, 87).trim(),
      traceAccountNumber: line.substring(87, 96).trim(),
      remitterName: line.substring(96, 112).trim(),
      withholdingTaxAmount: parseInt(line.substring(112, 120), 10),
    };
  }

  /**
   * Parse File Total Record.
   */
  private parseFileTotalRecord(line: string): AbaFileTotalRecord {
    return {
      recordType: "7",
      bsbFiller: "999-999",
      netTotal: parseInt(line.substring(20, 30), 10),
      creditTotal: parseInt(line.substring(30, 40), 10),
      debitTotal: parseInt(line.substring(40, 50), 10),
      recordCount: parseInt(line.substring(56, 62), 10),
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private padLeft(str: string, length: number, char: string = " "): string {
    return str.padStart(length, char).substring(0, length);
  }

  private padRight(str: string, length: number, char: string = " "): string {
    return str.padEnd(length, char).substring(0, length);
  }

  private formatBsb(bsb: string): string {
    // Ensure BSB is in XXX-XXX format
    const cleaned = bsb.replace(/[^0-9]/g, "");
    if (cleaned.length === 6) {
      return `${cleaned.substring(0, 3)}-${cleaned.substring(3, 6)}`;
    }
    return bsb.padEnd(7);
  }

  private formatDate(dateStr: string): string {
    // Convert YYYY-MM-DD to DDMMYY
    const date = new Date(dateStr);
    const dd = date.getDate().toString().padStart(2, "0");
    const mm = (date.getMonth() + 1).toString().padStart(2, "0");
    const yy = date.getFullYear().toString().substring(2);
    return `${dd}${mm}${yy}`;
  }
}

export const becsAbaGenerator = new BecsAbaGenerator();
export default becsAbaGenerator;
