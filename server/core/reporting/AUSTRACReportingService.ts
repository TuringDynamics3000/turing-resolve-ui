/**
 * AUSTRAC Reporting Service
 * 
 * TuringDynamics Core - Regulatory Reporting for Australian ADIs
 * 
 * Implements AUSTRAC reporting requirements under:
 * - Anti-Money Laundering and Counter-Terrorism Financing Act 2006 (AML/CTF Act)
 * - AML/CTF Rules 2007
 * 
 * Report Types:
 * - Threshold Transaction Reports (TTRs) - Cash transactions ≥$10,000 AUD
 * - International Funds Transfer Instructions (IFTIs) - Cross-border transfers
 * - Suspicious Matter Reports (SMRs) - Suspicious activity
 * - AML/CTF Compliance Reports - Annual compliance reporting
 * 
 * CRITICAL: All reports must be filed within prescribed timeframes.
 * TTRs: 10 business days | IFTIs: 10 business days | SMRs: 24 hours (urgent) / 3 days (standard)
 */

import { nanoid } from "nanoid";

// ============================================
// AUSTRAC REPORT TYPES
// ============================================

export type AUSTRACReportType = 
  | "TTR"      // Threshold Transaction Report
  | "IFTI"     // International Funds Transfer Instruction
  | "SMR"      // Suspicious Matter Report
  | "COMPLIANCE"; // Annual Compliance Report

export type ReportStatus = 
  | "DRAFT"
  | "PENDING_REVIEW"
  | "SUBMITTED"
  | "ACCEPTED"
  | "REJECTED"
  | "AMENDED";

export type SuspicionIndicator =
  | "STRUCTURING"           // Breaking up transactions to avoid thresholds
  | "UNUSUAL_PATTERN"       // Unusual transaction patterns
  | "HIGH_RISK_JURISDICTION" // Transactions with high-risk countries
  | "INCONSISTENT_PROFILE"  // Activity inconsistent with customer profile
  | "RAPID_MOVEMENT"        // Rapid movement of funds
  | "THIRD_PARTY"           // Third-party involvement
  | "CASH_INTENSIVE"        // Unusual cash activity
  | "SHELL_COMPANY"         // Suspected shell company involvement
  | "PEP_RELATED"           // Politically Exposed Person connection
  | "SANCTIONS_CONCERN";    // Potential sanctions evasion

// ============================================
// TRANSACTION RECORD (AUSTRAC Format)
// ============================================

export interface AUSTRACTransaction {
  transactionId: string;
  reportingEntityId: string;
  transactionDate: string;
  transactionTime: string;
  transactionType: "DEPOSIT" | "WITHDRAWAL" | "TRANSFER_IN" | "TRANSFER_OUT" | "PAYMENT";
  
  // Amount details
  amount: number;
  currency: string;
  amountAUD: number;  // Always include AUD equivalent
  
  // Parties
  originatorName: string;
  originatorAccountNumber: string;
  originatorBSB?: string;
  originatorCountry: string;
  
  beneficiaryName: string;
  beneficiaryAccountNumber: string;
  beneficiaryBSB?: string;
  beneficiaryCountry: string;
  
  // Additional details
  paymentMethod: "CASH" | "ELECTRONIC" | "CHEQUE" | "CARD";
  narrative: string;
  
  // Risk indicators
  isCashTransaction: boolean;
  isInternational: boolean;
  riskScore: number;
  suspicionIndicators: SuspicionIndicator[];
  
  // Audit
  capturedAt: string;
  capturedBy: string;
}

// ============================================
// THRESHOLD TRANSACTION REPORT (TTR)
// ============================================

export interface ThresholdTransactionReport {
  reportId: string;
  reportType: "TTR";
  status: ReportStatus;
  
  // Reporting entity
  reportingEntityABN: string;
  reportingEntityName: string;
  
  // Transaction details
  transaction: AUSTRACTransaction;
  
  // Customer details
  customerType: "INDIVIDUAL" | "COMPANY" | "TRUST" | "OTHER";
  customerName: string;
  customerDOB?: string;
  customerAddress: string;
  customerIdType: string;
  customerIdNumber: string;
  customerIdCountry: string;
  
  // Filing details
  filingDeadline: string;
  filedAt?: string;
  austracReferenceNumber?: string;
  
  // Audit trail
  createdAt: string;
  createdBy: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

// ============================================
// INTERNATIONAL FUNDS TRANSFER INSTRUCTION (IFTI)
// ============================================

export interface InternationalFundsTransferReport {
  reportId: string;
  reportType: "IFTI";
  status: ReportStatus;
  
  // Reporting entity
  reportingEntityABN: string;
  reportingEntityName: string;
  
  // Transfer details
  transferDirection: "INBOUND" | "OUTBOUND";
  transaction: AUSTRACTransaction;
  
  // Ordering institution
  orderingInstitutionName: string;
  orderingInstitutionBIC: string;
  orderingInstitutionCountry: string;
  
  // Beneficiary institution
  beneficiaryInstitutionName: string;
  beneficiaryInstitutionBIC: string;
  beneficiaryInstitutionCountry: string;
  
  // Correspondent banks
  correspondentBanks: {
    name: string;
    bic: string;
    country: string;
  }[];
  
  // Filing details
  filingDeadline: string;
  filedAt?: string;
  austracReferenceNumber?: string;
  
  // Audit trail
  createdAt: string;
  createdBy: string;
}

// ============================================
// SUSPICIOUS MATTER REPORT (SMR)
// ============================================

export interface SuspiciousMatterReport {
  reportId: string;
  reportType: "SMR";
  status: ReportStatus;
  urgency: "STANDARD" | "URGENT";  // Urgent = terrorism financing concern
  
  // Reporting entity
  reportingEntityABN: string;
  reportingEntityName: string;
  
  // Subject of suspicion
  subjectType: "INDIVIDUAL" | "COMPANY" | "TRANSACTION" | "ACCOUNT";
  subjectName: string;
  subjectIdentifiers: {
    type: string;
    value: string;
  }[];
  
  // Suspicion details
  suspicionIndicators: SuspicionIndicator[];
  suspicionNarrative: string;
  suspicionFirstIdentified: string;
  suspicionIdentifiedBy: string;
  
  // Related transactions
  relatedTransactions: AUSTRACTransaction[];
  totalValueInvolved: number;
  
  // Risk assessment
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  predicateOffenseTypes: string[];
  
  // Filing details
  filingDeadline: string;  // 24 hours for urgent, 3 days for standard
  filedAt?: string;
  austracReferenceNumber?: string;
  
  // Audit trail
  createdAt: string;
  createdBy: string;
  reviewedAt?: string;
  reviewedBy?: string;
  escalatedAt?: string;
  escalatedTo?: string;
}

// ============================================
// AUSTRAC REPORTING SERVICE
// ============================================

class AUSTRACReportingService {
  private reports: Map<string, ThresholdTransactionReport | InternationalFundsTransferReport | SuspiciousMatterReport> = new Map();
  private transactions: AUSTRACTransaction[] = [];
  
  // Thresholds
  private readonly TTR_THRESHOLD_AUD = 10000;
  private readonly HIGH_RISK_COUNTRIES = [
    "AF", "IR", "KP", "SY", "YE", "MM", "VE", "CU", "SD", "SS"
  ];
  
  // Reporting entity details
  private readonly REPORTING_ENTITY = {
    abn: "12 345 678 901",
    name: "TuringDynamics Pty Ltd",
  };

  /**
   * Record a transaction for AUSTRAC monitoring.
   */
  recordTransaction(tx: Omit<AUSTRACTransaction, "transactionId" | "capturedAt" | "riskScore" | "suspicionIndicators">): AUSTRACTransaction {
    const riskScore = this.calculateRiskScore(tx);
    const suspicionIndicators = this.detectSuspicionIndicators(tx);
    
    const transaction: AUSTRACTransaction = {
      ...tx,
      transactionId: `TXN-${nanoid(12)}`,
      capturedAt: new Date().toISOString(),
      riskScore,
      suspicionIndicators,
    };
    
    this.transactions.push(transaction);
    
    // Auto-generate reports if thresholds met
    this.checkAndGenerateReports(transaction);
    
    return transaction;
  }

  /**
   * Calculate transaction risk score (0-100).
   */
  private calculateRiskScore(tx: Omit<AUSTRACTransaction, "transactionId" | "capturedAt" | "riskScore" | "suspicionIndicators">): number {
    let score = 0;
    
    // Amount-based risk
    if (tx.amountAUD >= 10000) score += 20;
    if (tx.amountAUD >= 50000) score += 15;
    if (tx.amountAUD >= 100000) score += 15;
    
    // Cash transactions
    if (tx.isCashTransaction) score += 25;
    
    // International transactions
    if (tx.isInternational) score += 15;
    
    // High-risk jurisdictions
    if (this.HIGH_RISK_COUNTRIES.includes(tx.originatorCountry) || 
        this.HIGH_RISK_COUNTRIES.includes(tx.beneficiaryCountry)) {
      score += 30;
    }
    
    return Math.min(score, 100);
  }

  /**
   * Detect suspicion indicators from transaction patterns.
   */
  private detectSuspicionIndicators(tx: Omit<AUSTRACTransaction, "transactionId" | "capturedAt" | "riskScore" | "suspicionIndicators">): SuspicionIndicator[] {
    const indicators: SuspicionIndicator[] = [];
    
    // Check for structuring (multiple transactions just under threshold)
    const recentTxs = this.transactions.filter(t => 
      t.originatorAccountNumber === tx.originatorAccountNumber &&
      new Date(t.transactionDate).getTime() > Date.now() - 24 * 60 * 60 * 1000
    );
    
    const totalRecent = recentTxs.reduce((sum, t) => sum + t.amountAUD, 0) + tx.amountAUD;
    if (recentTxs.length >= 2 && tx.amountAUD < 10000 && totalRecent >= 10000) {
      indicators.push("STRUCTURING");
    }
    
    // High-risk jurisdiction
    if (this.HIGH_RISK_COUNTRIES.includes(tx.originatorCountry) || 
        this.HIGH_RISK_COUNTRIES.includes(tx.beneficiaryCountry)) {
      indicators.push("HIGH_RISK_JURISDICTION");
    }
    
    // Cash intensive
    if (tx.isCashTransaction && tx.amountAUD >= 5000) {
      indicators.push("CASH_INTENSIVE");
    }
    
    // Rapid movement (same-day in and out)
    const sameDayIn = this.transactions.filter(t =>
      t.beneficiaryAccountNumber === tx.originatorAccountNumber &&
      t.transactionDate === tx.transactionDate &&
      t.transactionType === "TRANSFER_IN"
    );
    if (sameDayIn.length > 0 && tx.transactionType === "TRANSFER_OUT") {
      indicators.push("RAPID_MOVEMENT");
    }
    
    return indicators;
  }

  /**
   * Check thresholds and auto-generate required reports.
   */
  private checkAndGenerateReports(tx: AUSTRACTransaction): void {
    // TTR for cash transactions >= $10,000
    if (tx.isCashTransaction && tx.amountAUD >= this.TTR_THRESHOLD_AUD) {
      this.generateTTR(tx);
    }
    
    // IFTI for international transfers
    if (tx.isInternational) {
      this.generateIFTI(tx);
    }
    
    // SMR for high-risk transactions
    if (tx.riskScore >= 70 || tx.suspicionIndicators.length >= 2) {
      this.generateSMR(tx);
    }
  }

  /**
   * Generate Threshold Transaction Report.
   */
  generateTTR(tx: AUSTRACTransaction): ThresholdTransactionReport {
    const report: ThresholdTransactionReport = {
      reportId: `TTR-${nanoid(10)}`,
      reportType: "TTR",
      status: "DRAFT",
      reportingEntityABN: this.REPORTING_ENTITY.abn,
      reportingEntityName: this.REPORTING_ENTITY.name,
      transaction: tx,
      customerType: "INDIVIDUAL",
      customerName: tx.originatorName,
      customerAddress: "Address on file",
      customerIdType: "DRIVERS_LICENCE",
      customerIdNumber: "DL123456",
      customerIdCountry: "AU",
      filingDeadline: this.calculateDeadline(10),
      createdAt: new Date().toISOString(),
      createdBy: "SYSTEM",
    };
    
    this.reports.set(report.reportId, report);
    return report;
  }

  /**
   * Generate International Funds Transfer Instruction report.
   */
  generateIFTI(tx: AUSTRACTransaction): InternationalFundsTransferReport {
    const report: InternationalFundsTransferReport = {
      reportId: `IFTI-${nanoid(10)}`,
      reportType: "IFTI",
      status: "DRAFT",
      reportingEntityABN: this.REPORTING_ENTITY.abn,
      reportingEntityName: this.REPORTING_ENTITY.name,
      transferDirection: tx.transactionType === "TRANSFER_IN" ? "INBOUND" : "OUTBOUND",
      transaction: tx,
      orderingInstitutionName: "Originating Bank",
      orderingInstitutionBIC: "ORIGAU2S",
      orderingInstitutionCountry: tx.originatorCountry,
      beneficiaryInstitutionName: "Beneficiary Bank",
      beneficiaryInstitutionBIC: "BENESG2S",
      beneficiaryInstitutionCountry: tx.beneficiaryCountry,
      correspondentBanks: [],
      filingDeadline: this.calculateDeadline(10),
      createdAt: new Date().toISOString(),
      createdBy: "SYSTEM",
    };
    
    this.reports.set(report.reportId, report);
    return report;
  }

  /**
   * Generate Suspicious Matter Report.
   */
  generateSMR(tx: AUSTRACTransaction): SuspiciousMatterReport {
    const isUrgent = tx.suspicionIndicators.includes("HIGH_RISK_JURISDICTION") && tx.amountAUD >= 50000;
    
    const report: SuspiciousMatterReport = {
      reportId: `SMR-${nanoid(10)}`,
      reportType: "SMR",
      status: "DRAFT",
      urgency: isUrgent ? "URGENT" : "STANDARD",
      reportingEntityABN: this.REPORTING_ENTITY.abn,
      reportingEntityName: this.REPORTING_ENTITY.name,
      subjectType: "TRANSACTION",
      subjectName: tx.originatorName,
      subjectIdentifiers: [
        { type: "ACCOUNT", value: tx.originatorAccountNumber },
      ],
      suspicionIndicators: tx.suspicionIndicators,
      suspicionNarrative: this.generateSuspicionNarrative(tx),
      suspicionFirstIdentified: new Date().toISOString(),
      suspicionIdentifiedBy: "AUTOMATED_MONITORING",
      relatedTransactions: [tx],
      totalValueInvolved: tx.amountAUD,
      riskLevel: tx.riskScore >= 80 ? "CRITICAL" : tx.riskScore >= 60 ? "HIGH" : "MEDIUM",
      predicateOffenseTypes: this.inferPredicateOffenses(tx.suspicionIndicators),
      filingDeadline: this.calculateDeadline(isUrgent ? 1 : 3),
      createdAt: new Date().toISOString(),
      createdBy: "SYSTEM",
    };
    
    this.reports.set(report.reportId, report);
    return report;
  }

  /**
   * Generate narrative for SMR.
   */
  private generateSuspicionNarrative(tx: AUSTRACTransaction): string {
    const parts: string[] = [];
    
    parts.push(`Transaction ${tx.transactionId} flagged for review.`);
    parts.push(`Amount: ${tx.amountAUD.toLocaleString()} AUD.`);
    
    if (tx.suspicionIndicators.includes("STRUCTURING")) {
      parts.push("Pattern consistent with structuring to avoid reporting thresholds.");
    }
    if (tx.suspicionIndicators.includes("HIGH_RISK_JURISDICTION")) {
      parts.push(`Transaction involves high-risk jurisdiction: ${tx.originatorCountry}/${tx.beneficiaryCountry}.`);
    }
    if (tx.suspicionIndicators.includes("RAPID_MOVEMENT")) {
      parts.push("Funds moved rapidly through account (same-day in/out).");
    }
    if (tx.suspicionIndicators.includes("CASH_INTENSIVE")) {
      parts.push("Unusual cash activity for customer profile.");
    }
    
    return parts.join(" ");
  }

  /**
   * Infer predicate offenses from indicators.
   */
  private inferPredicateOffenses(indicators: SuspicionIndicator[]): string[] {
    const offenses: string[] = [];
    
    if (indicators.includes("STRUCTURING")) {
      offenses.push("MONEY_LAUNDERING");
    }
    if (indicators.includes("HIGH_RISK_JURISDICTION")) {
      offenses.push("SANCTIONS_EVASION", "TERRORISM_FINANCING");
    }
    if (indicators.includes("RAPID_MOVEMENT")) {
      offenses.push("MONEY_LAUNDERING", "FRAUD");
    }
    
    return [...new Set(offenses)];
  }

  /**
   * Calculate filing deadline.
   */
  private calculateDeadline(businessDays: number): string {
    const deadline = new Date();
    let daysAdded = 0;
    
    while (daysAdded < businessDays) {
      deadline.setDate(deadline.getDate() + 1);
      const day = deadline.getDay();
      if (day !== 0 && day !== 6) {
        daysAdded++;
      }
    }
    
    return deadline.toISOString();
  }

  /**
   * Get all pending reports.
   */
  getPendingReports(): (ThresholdTransactionReport | InternationalFundsTransferReport | SuspiciousMatterReport)[] {
    return Array.from(this.reports.values()).filter(r => 
      r.status === "DRAFT" || r.status === "PENDING_REVIEW"
    );
  }

  /**
   * Get reports by type.
   */
  getReportsByType(type: AUSTRACReportType): (ThresholdTransactionReport | InternationalFundsTransferReport | SuspiciousMatterReport)[] {
    return Array.from(this.reports.values()).filter(r => r.reportType === type);
  }

  /**
   * Get overdue reports.
   */
  getOverdueReports(): (ThresholdTransactionReport | InternationalFundsTransferReport | SuspiciousMatterReport)[] {
    const now = new Date();
    return Array.from(this.reports.values()).filter(r => 
      (r.status === "DRAFT" || r.status === "PENDING_REVIEW") &&
      new Date(r.filingDeadline) < now
    );
  }

  /**
   * Submit report to AUSTRAC.
   */
  submitReport(reportId: string, submittedBy: string): { success: boolean; referenceNumber?: string; error?: string } {
    const report = this.reports.get(reportId);
    if (!report) {
      return { success: false, error: "Report not found" };
    }
    
    if (report.status !== "DRAFT" && report.status !== "PENDING_REVIEW") {
      return { success: false, error: `Cannot submit report in ${report.status} status` };
    }
    
    // Simulate AUSTRAC submission
    const referenceNumber = `AUSTRAC-${Date.now()}-${nanoid(6)}`;
    
    report.status = "SUBMITTED";
    report.filedAt = new Date().toISOString();
    (report as any).austracReferenceNumber = referenceNumber;
    
    return { success: true, referenceNumber };
  }

  /**
   * Get AUSTRAC-ready transaction dataset for regulatory export.
   */
  getTransactionDataset(options: {
    fromDate?: string;
    toDate?: string;
    minAmount?: number;
    includeInternational?: boolean;
    includeCash?: boolean;
  } = {}): {
    transactions: AUSTRACTransaction[];
    summary: {
      totalCount: number;
      totalValueAUD: number;
      cashCount: number;
      internationalCount: number;
      highRiskCount: number;
      suspiciousCount: number;
    };
    exportedAt: string;
    exportFormat: string;
  } {
    let filtered = [...this.transactions];
    
    if (options.fromDate) {
      filtered = filtered.filter(t => t.transactionDate >= options.fromDate!);
    }
    if (options.toDate) {
      filtered = filtered.filter(t => t.transactionDate <= options.toDate!);
    }
    if (options.minAmount) {
      filtered = filtered.filter(t => t.amountAUD >= options.minAmount!);
    }
    if (options.includeInternational === false) {
      filtered = filtered.filter(t => !t.isInternational);
    }
    if (options.includeCash === false) {
      filtered = filtered.filter(t => !t.isCashTransaction);
    }
    
    return {
      transactions: filtered,
      summary: {
        totalCount: filtered.length,
        totalValueAUD: filtered.reduce((sum, t) => sum + t.amountAUD, 0),
        cashCount: filtered.filter(t => t.isCashTransaction).length,
        internationalCount: filtered.filter(t => t.isInternational).length,
        highRiskCount: filtered.filter(t => t.riskScore >= 70).length,
        suspiciousCount: filtered.filter(t => t.suspicionIndicators.length > 0).length,
      },
      exportedAt: new Date().toISOString(),
      exportFormat: "AUSTRAC_V2",
    };
  }

  /**
   * Get compliance dashboard metrics.
   */
  getComplianceMetrics(): {
    pendingReports: { ttr: number; ifti: number; smr: number };
    overdueReports: number;
    submittedToday: number;
    averageFilingTime: number;
    complianceRate: number;
  } {
    const reports = Array.from(this.reports.values());
    const pending = reports.filter(r => r.status === "DRAFT" || r.status === "PENDING_REVIEW");
    const overdue = this.getOverdueReports();
    const today = new Date().toISOString().split("T")[0];
    const submittedToday = reports.filter(r => r.filedAt?.startsWith(today)).length;
    
    // Calculate average filing time
    const submitted = reports.filter(r => r.filedAt);
    const avgTime = submitted.length > 0
      ? submitted.reduce((sum, r) => {
          const created = new Date(r.createdAt).getTime();
          const filed = new Date(r.filedAt!).getTime();
          return sum + (filed - created);
        }, 0) / submitted.length / (1000 * 60 * 60 * 24)  // Convert to days
      : 0;
    
    // Compliance rate (filed before deadline)
    const total = reports.filter(r => r.status === "SUBMITTED" || r.status === "ACCEPTED").length;
    const onTime = reports.filter(r => 
      (r.status === "SUBMITTED" || r.status === "ACCEPTED") &&
      r.filedAt && new Date(r.filedAt) <= new Date(r.filingDeadline)
    ).length;
    
    return {
      pendingReports: {
        ttr: pending.filter(r => r.reportType === "TTR").length,
        ifti: pending.filter(r => r.reportType === "IFTI").length,
        smr: pending.filter(r => r.reportType === "SMR").length,
      },
      overdueReports: overdue.length,
      submittedToday,
      averageFilingTime: Math.round(avgTime * 10) / 10,
      complianceRate: total > 0 ? Math.round((onTime / total) * 100) : 100,
    };
  }
}

export const austracReportingService = new AUSTRACReportingService();
export default austracReportingService;
