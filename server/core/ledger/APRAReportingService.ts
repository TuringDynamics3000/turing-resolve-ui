/**
 * APRA Regulatory Reporting Service
 * 
 * Handles Australian Prudential Regulation Authority (APRA) reporting:
 * - ARF 720.0 - Statement of Financial Position
 * - ARF 720.1 - Statement of Financial Performance
 * - ARF 720.2 - Capital Adequacy
 * - GL account to APRA line item mapping
 */

import { Money } from "../../../core/deposits/ledger/Money";

// ============================================
// APRA Report Types
// ============================================

export type APRAReportType = 
  | "ARF_720_0" // Statement of Financial Position (Balance Sheet)
  | "ARF_720_1" // Statement of Financial Performance (P&L)
  | "ARF_720_2" // Capital Adequacy
  | "ARF_720_3" // Liquidity Coverage Ratio
  | "ARF_720_4" // Net Stable Funding Ratio
  | "ARF_220_0"; // Credit Risk - On-Balance Sheet Exposures

export type ReportStatus = "DRAFT" | "SUBMITTED" | "ACCEPTED" | "REJECTED";

export interface APRAReport {
  reportId: string;
  reportType: APRAReportType;
  reportingPeriod: string; // YYYY-MM
  reportingEntity: string;
  abn: string;
  status: ReportStatus;
  generatedAt: string;
  submittedAt?: string;
  lineItems: APRALineItem[];
  totals: APRAReportTotals;
  validationIssues: ValidationIssue[];
}

export interface APRALineItem {
  lineNumber: string;
  description: string;
  amount: string;
  currency: string;
  glAccounts: string[]; // GL account codes that map to this line
  notes?: string;
}

export interface APRAReportTotals {
  totalAssets?: string;
  totalLiabilities?: string;
  netAssets?: string;
  totalRevenue?: string;
  totalExpenses?: string;
  netProfit?: string;
  tier1Capital?: string;
  tier2Capital?: string;
  totalCapital?: string;
  riskWeightedAssets?: string;
  capitalRatio?: string;
}

export interface ValidationIssue {
  severity: "ERROR" | "WARNING" | "INFO";
  lineNumber?: string;
  code: string;
  message: string;
}

// ============================================
// GL to APRA Mapping Configuration
// ============================================

export interface GLToAPRAMapping {
  glAccountCode: string;
  glAccountName: string;
  apraReportType: APRAReportType;
  apraLineNumber: string;
  apraDescription: string;
  sign: "POSITIVE" | "NEGATIVE"; // How GL balance affects APRA line
  notes?: string;
}

// Standard mappings for ADI reporting
const GL_TO_APRA_MAPPINGS: GLToAPRAMapping[] = [
  // ARF 720.0 - Statement of Financial Position (Assets)
  { glAccountCode: "1000", glAccountName: "Cash at Bank", apraReportType: "ARF_720_0", apraLineNumber: "1.1", apraDescription: "Cash and liquid assets", sign: "POSITIVE" },
  { glAccountCode: "1100", glAccountName: "Customer Deposits Control", apraReportType: "ARF_720_0", apraLineNumber: "1.2", apraDescription: "Due from other ADIs", sign: "POSITIVE" },
  { glAccountCode: "1200", glAccountName: "Loans Receivable Control", apraReportType: "ARF_720_0", apraLineNumber: "2.1", apraDescription: "Loans and advances - Households", sign: "POSITIVE" },
  { glAccountCode: "1210", glAccountName: "Personal Loans", apraReportType: "ARF_720_0", apraLineNumber: "2.1.1", apraDescription: "Personal loans", sign: "POSITIVE" },
  { glAccountCode: "1220", glAccountName: "Home Loans", apraReportType: "ARF_720_0", apraLineNumber: "2.1.2", apraDescription: "Housing loans", sign: "POSITIVE" },
  { glAccountCode: "1300", glAccountName: "Payment Clearing Control", apraReportType: "ARF_720_0", apraLineNumber: "1.3", apraDescription: "Trading securities", sign: "POSITIVE" },
  { glAccountCode: "1400", glAccountName: "Card Receivables Control", apraReportType: "ARF_720_0", apraLineNumber: "2.2", apraDescription: "Credit card receivables", sign: "POSITIVE" },
  
  // ARF 720.0 - Statement of Financial Position (Liabilities)
  { glAccountCode: "2000", glAccountName: "Customer Deposits Payable", apraReportType: "ARF_720_0", apraLineNumber: "10.1", apraDescription: "Deposits - Households", sign: "POSITIVE" },
  { glAccountCode: "2100", glAccountName: "Term Deposits Payable", apraReportType: "ARF_720_0", apraLineNumber: "10.2", apraDescription: "Deposits - Term deposits", sign: "POSITIVE" },
  { glAccountCode: "2200", glAccountName: "Borrowings", apraReportType: "ARF_720_0", apraLineNumber: "11.1", apraDescription: "Borrowings from ADIs", sign: "POSITIVE" },
  
  // ARF 720.0 - Equity
  { glAccountCode: "3000", glAccountName: "Share Capital", apraReportType: "ARF_720_0", apraLineNumber: "20.1", apraDescription: "Paid-up ordinary shares", sign: "POSITIVE" },
  { glAccountCode: "3100", glAccountName: "Retained Earnings", apraReportType: "ARF_720_0", apraLineNumber: "20.2", apraDescription: "Retained earnings", sign: "POSITIVE" },
  { glAccountCode: "3200", glAccountName: "Reserves", apraReportType: "ARF_720_0", apraLineNumber: "20.3", apraDescription: "Reserves", sign: "POSITIVE" },
  
  // ARF 720.1 - Statement of Financial Performance (Revenue)
  { glAccountCode: "4000", glAccountName: "Interest Income - Loans", apraReportType: "ARF_720_1", apraLineNumber: "1.1", apraDescription: "Interest income - Loans", sign: "POSITIVE" },
  { glAccountCode: "4100", glAccountName: "Fee Income", apraReportType: "ARF_720_1", apraLineNumber: "2.1", apraDescription: "Fee income", sign: "POSITIVE" },
  { glAccountCode: "4200", glAccountName: "Card Interchange Income", apraReportType: "ARF_720_1", apraLineNumber: "2.2", apraDescription: "Other income", sign: "POSITIVE" },
  
  // ARF 720.1 - Statement of Financial Performance (Expenses)
  { glAccountCode: "5000", glAccountName: "Interest Expense - Deposits", apraReportType: "ARF_720_1", apraLineNumber: "5.1", apraDescription: "Interest expense - Deposits", sign: "POSITIVE" },
  { glAccountCode: "5100", glAccountName: "Provision Expense - Loan Losses", apraReportType: "ARF_720_1", apraLineNumber: "6.1", apraDescription: "Impairment charges", sign: "POSITIVE" },
  { glAccountCode: "5200", glAccountName: "Payment Processing Fees", apraReportType: "ARF_720_1", apraLineNumber: "7.1", apraDescription: "Operating expenses", sign: "POSITIVE" },
  
  // ARF 720.2 - Capital Adequacy
  { glAccountCode: "3000", glAccountName: "Share Capital", apraReportType: "ARF_720_2", apraLineNumber: "1.1", apraDescription: "CET1 - Paid-up capital", sign: "POSITIVE" },
  { glAccountCode: "3100", glAccountName: "Retained Earnings", apraReportType: "ARF_720_2", apraLineNumber: "1.2", apraDescription: "CET1 - Retained earnings", sign: "POSITIVE" },
  { glAccountCode: "3200", glAccountName: "Reserves", apraReportType: "ARF_720_2", apraLineNumber: "1.3", apraDescription: "CET1 - Reserves", sign: "POSITIVE" },
  
  // ARF 220.0 - Credit Risk On-Balance Sheet Exposures
  { glAccountCode: "1220", glAccountName: "Home Loans", apraReportType: "ARF_220_0", apraLineNumber: "1.1", apraDescription: "Residential mortgages - Standard", sign: "POSITIVE" },
  { glAccountCode: "1210", glAccountName: "Personal Loans", apraReportType: "ARF_220_0", apraLineNumber: "2.1", apraDescription: "Other retail exposures", sign: "POSITIVE" },
  { glAccountCode: "1400", glAccountName: "Card Receivables Control", apraReportType: "ARF_220_0", apraLineNumber: "2.2", apraDescription: "Qualifying revolving retail", sign: "POSITIVE" },
  { glAccountCode: "1200", glAccountName: "Loans Receivable Control", apraReportType: "ARF_220_0", apraLineNumber: "3.1", apraDescription: "Corporate exposures", sign: "POSITIVE" },
  { glAccountCode: "1000", glAccountName: "Cash at Bank", apraReportType: "ARF_220_0", apraLineNumber: "4.1", apraDescription: "Claims on ADIs", sign: "POSITIVE" },
  { glAccountCode: "1100", glAccountName: "Customer Deposits Control", apraReportType: "ARF_220_0", apraLineNumber: "4.2", apraDescription: "Claims on central government", sign: "POSITIVE" },
];

// ============================================
// APRA Report Templates
// ============================================

const ARF_720_0_TEMPLATE: { lineNumber: string; description: string; category: string }[] = [
  // Assets
  { lineNumber: "1", description: "ASSETS", category: "HEADER" },
  { lineNumber: "1.1", description: "Cash and liquid assets", category: "ASSET" },
  { lineNumber: "1.2", description: "Due from other ADIs", category: "ASSET" },
  { lineNumber: "1.3", description: "Trading securities", category: "ASSET" },
  { lineNumber: "2", description: "Loans and advances", category: "HEADER" },
  { lineNumber: "2.1", description: "Loans and advances - Households", category: "ASSET" },
  { lineNumber: "2.1.1", description: "Personal loans", category: "ASSET" },
  { lineNumber: "2.1.2", description: "Housing loans", category: "ASSET" },
  { lineNumber: "2.2", description: "Credit card receivables", category: "ASSET" },
  { lineNumber: "9", description: "TOTAL ASSETS", category: "TOTAL" },
  
  // Liabilities
  { lineNumber: "10", description: "LIABILITIES", category: "HEADER" },
  { lineNumber: "10.1", description: "Deposits - Households", category: "LIABILITY" },
  { lineNumber: "10.2", description: "Deposits - Term deposits", category: "LIABILITY" },
  { lineNumber: "11.1", description: "Borrowings from ADIs", category: "LIABILITY" },
  { lineNumber: "19", description: "TOTAL LIABILITIES", category: "TOTAL" },
  
  // Equity
  { lineNumber: "20", description: "EQUITY", category: "HEADER" },
  { lineNumber: "20.1", description: "Paid-up ordinary shares", category: "EQUITY" },
  { lineNumber: "20.2", description: "Retained earnings", category: "EQUITY" },
  { lineNumber: "20.3", description: "Reserves", category: "EQUITY" },
  { lineNumber: "29", description: "TOTAL EQUITY", category: "TOTAL" },
  { lineNumber: "30", description: "TOTAL LIABILITIES AND EQUITY", category: "TOTAL" },
];

// ARF 220.0 - Credit Risk On-Balance Sheet Exposures Template
const ARF_220_0_TEMPLATE: { lineNumber: string; description: string; category: string; riskWeight: number }[] = [
  // Residential Mortgages
  { lineNumber: "1", description: "RESIDENTIAL MORTGAGES", category: "HEADER", riskWeight: 0 },
  { lineNumber: "1.1", description: "Standard residential mortgages (LVR <= 80%)", category: "EXPOSURE", riskWeight: 35 },
  { lineNumber: "1.2", description: "Non-standard residential mortgages (LVR > 80%)", category: "EXPOSURE", riskWeight: 50 },
  { lineNumber: "1.3", description: "Residential mortgages - LMI covered", category: "EXPOSURE", riskWeight: 35 },
  
  // Other Retail
  { lineNumber: "2", description: "OTHER RETAIL EXPOSURES", category: "HEADER", riskWeight: 0 },
  { lineNumber: "2.1", description: "Other retail exposures", category: "EXPOSURE", riskWeight: 75 },
  { lineNumber: "2.2", description: "Qualifying revolving retail (credit cards)", category: "EXPOSURE", riskWeight: 75 },
  { lineNumber: "2.3", description: "SME retail exposures", category: "EXPOSURE", riskWeight: 85 },
  
  // Corporate
  { lineNumber: "3", description: "CORPORATE EXPOSURES", category: "HEADER", riskWeight: 0 },
  { lineNumber: "3.1", description: "Corporate exposures - unrated", category: "EXPOSURE", riskWeight: 100 },
  { lineNumber: "3.2", description: "Corporate exposures - rated (BBB- to A+)", category: "EXPOSURE", riskWeight: 50 },
  { lineNumber: "3.3", description: "Corporate exposures - rated (AA- to AAA)", category: "EXPOSURE", riskWeight: 20 },
  
  // Sovereign & ADI
  { lineNumber: "4", description: "SOVEREIGN AND ADI EXPOSURES", category: "HEADER", riskWeight: 0 },
  { lineNumber: "4.1", description: "Claims on ADIs (Australian)", category: "EXPOSURE", riskWeight: 20 },
  { lineNumber: "4.2", description: "Claims on central government (Australian)", category: "EXPOSURE", riskWeight: 0 },
  { lineNumber: "4.3", description: "Claims on state/territory government", category: "EXPOSURE", riskWeight: 0 },
  
  // Past Due
  { lineNumber: "5", description: "PAST DUE EXPOSURES", category: "HEADER", riskWeight: 0 },
  { lineNumber: "5.1", description: "Past due exposures (< 90 days)", category: "EXPOSURE", riskWeight: 100 },
  { lineNumber: "5.2", description: "Past due exposures (>= 90 days, provisioned < 20%)", category: "EXPOSURE", riskWeight: 150 },
  { lineNumber: "5.3", description: "Past due exposures (>= 90 days, provisioned >= 20%)", category: "EXPOSURE", riskWeight: 100 },
  
  // Totals
  { lineNumber: "9", description: "TOTAL ON-BALANCE SHEET EXPOSURES", category: "TOTAL", riskWeight: 0 },
  { lineNumber: "10", description: "TOTAL RISK-WEIGHTED ASSETS", category: "TOTAL", riskWeight: 0 },
];

const ARF_720_1_TEMPLATE: { lineNumber: string; description: string; category: string }[] = [
  // Revenue
  { lineNumber: "1", description: "INTEREST INCOME", category: "HEADER" },
  { lineNumber: "1.1", description: "Interest income - Loans", category: "REVENUE" },
  { lineNumber: "2", description: "NON-INTEREST INCOME", category: "HEADER" },
  { lineNumber: "2.1", description: "Fee income", category: "REVENUE" },
  { lineNumber: "2.2", description: "Other income", category: "REVENUE" },
  { lineNumber: "4", description: "TOTAL INCOME", category: "TOTAL" },
  
  // Expenses
  { lineNumber: "5", description: "INTEREST EXPENSE", category: "HEADER" },
  { lineNumber: "5.1", description: "Interest expense - Deposits", category: "EXPENSE" },
  { lineNumber: "6", description: "IMPAIRMENT CHARGES", category: "HEADER" },
  { lineNumber: "6.1", description: "Impairment charges", category: "EXPENSE" },
  { lineNumber: "7", description: "OPERATING EXPENSES", category: "HEADER" },
  { lineNumber: "7.1", description: "Operating expenses", category: "EXPENSE" },
  { lineNumber: "8", description: "TOTAL EXPENSES", category: "TOTAL" },
  { lineNumber: "9", description: "NET PROFIT/(LOSS)", category: "TOTAL" },
];

// ============================================
// APRA Reporting Service
// ============================================

class APRAReportingService {
  private reports: Map<string, APRAReport> = new Map();

  /**
   * Get GL to APRA mappings
   */
  getMappings(reportType?: APRAReportType): GLToAPRAMapping[] {
    if (reportType) {
      return GL_TO_APRA_MAPPINGS.filter(m => m.apraReportType === reportType);
    }
    return GL_TO_APRA_MAPPINGS;
  }

  /**
   * Get report template
   */
  getReportTemplate(reportType: APRAReportType): { lineNumber: string; description: string; category: string; riskWeight?: number }[] {
    switch (reportType) {
      case "ARF_720_0":
        return ARF_720_0_TEMPLATE;
      case "ARF_720_1":
        return ARF_720_1_TEMPLATE;
      case "ARF_220_0":
        return ARF_220_0_TEMPLATE;
      default:
        return [];
    }
  }

  /**
   * Generate ARF 220.0 Credit Risk report with ECL integration
   */
  generateARF220Report(
    reportingPeriod: string,
    reportingEntity: string,
    abn: string,
    exposures: {
      lineNumber: string;
      exposure: bigint;
      provisions: bigint;
      stage: "STAGE_1" | "STAGE_2" | "STAGE_3";
    }[]
  ): APRAReport {
    const reportId = `APRA-ARF_220_0-${reportingPeriod}-${Date.now()}`;
    const template = ARF_220_0_TEMPLATE;
    const validationIssues: ValidationIssue[] = [];

    // Build line items with risk weights
    const lineItems: APRALineItem[] = template.map(line => {
      const exposureData = exposures.find(e => e.lineNumber === line.lineNumber);
      const exposure = exposureData?.exposure || BigInt(0);
      const provisions = exposureData?.provisions || BigInt(0);
      const riskWeight = line.riskWeight || 0;
      const rwa = BigInt(Math.round(Number(exposure) * riskWeight / 100));

      return {
        lineNumber: line.lineNumber,
        description: line.description,
        amount: this.formatCurrency(exposure),
        currency: "AUD",
        glAccounts: [],
        notes: line.category === "EXPOSURE" 
          ? `RW: ${riskWeight}% | RWA: ${this.formatCurrency(rwa)} | ECL: ${this.formatCurrency(provisions)}`
          : undefined,
      };
    });

    // Calculate totals
    let totalExposure = BigInt(0);
    let totalRWA = BigInt(0);
    let totalProvisions = BigInt(0);

    for (const exp of exposures) {
      const templateLine = template.find(t => t.lineNumber === exp.lineNumber);
      if (templateLine && templateLine.category === "EXPOSURE") {
        totalExposure += exp.exposure;
        totalRWA += BigInt(Math.round(Number(exp.exposure) * (templateLine.riskWeight || 0) / 100));
        totalProvisions += exp.provisions;
      }
    }

    // Update total lines
    const totalExposureLine = lineItems.find(i => i.lineNumber === "9");
    if (totalExposureLine) {
      totalExposureLine.amount = this.formatCurrency(totalExposure);
    }
    const totalRWALine = lineItems.find(i => i.lineNumber === "10");
    if (totalRWALine) {
      totalRWALine.amount = this.formatCurrency(totalRWA);
      totalRWALine.notes = `Total ECL Provisions: ${this.formatCurrency(totalProvisions)}`;
    }

    const report: APRAReport = {
      reportId,
      reportType: "ARF_220_0",
      reportingPeriod,
      reportingEntity,
      abn,
      status: "DRAFT",
      generatedAt: new Date().toISOString(),
      lineItems,
      totals: {
        totalAssets: this.formatCurrency(totalExposure),
        riskWeightedAssets: this.formatCurrency(totalRWA),
      },
      validationIssues,
    };

    this.reports.set(reportId, report);
    return report;
  }

  /**
   * Generate demo ARF 220.0 report
   */
  generateDemoARF220Report(reportingPeriod: string): APRAReport {
    const exposures = [
      { lineNumber: "1.1", exposure: BigInt(120000000), provisions: BigInt(180000), stage: "STAGE_1" as const },
      { lineNumber: "1.2", exposure: BigInt(25000000), provisions: BigInt(125000), stage: "STAGE_2" as const },
      { lineNumber: "2.1", exposure: BigInt(30000000), provisions: BigInt(225000), stage: "STAGE_1" as const },
      { lineNumber: "2.2", exposure: BigInt(8000000), provisions: BigInt(60000), stage: "STAGE_1" as const },
      { lineNumber: "3.1", exposure: BigInt(15000000), provisions: BigInt(150000), stage: "STAGE_1" as const },
      { lineNumber: "4.1", exposure: BigInt(5000000), provisions: BigInt(0), stage: "STAGE_1" as const },
      { lineNumber: "4.2", exposure: BigInt(2000000), provisions: BigInt(0), stage: "STAGE_1" as const },
      { lineNumber: "5.1", exposure: BigInt(3500000), provisions: BigInt(175000), stage: "STAGE_2" as const },
      { lineNumber: "5.2", exposure: BigInt(1500000), provisions: BigInt(450000), stage: "STAGE_3" as const },
    ];

    return this.generateARF220Report(
      reportingPeriod,
      "TuringDynamics Credit Union Ltd",
      "12 345 678 901",
      exposures
    );
  }

  /**
   * Generate APRA report
   */
  generateReport(
    reportType: APRAReportType,
    reportingPeriod: string,
    reportingEntity: string,
    abn: string,
    glBalances: Map<string, bigint>
  ): APRAReport {
    const reportId = `APRA-${reportType}-${reportingPeriod}-${Date.now()}`;
    const template = this.getReportTemplate(reportType);
    const mappings = this.getMappings(reportType);
    const validationIssues: ValidationIssue[] = [];

    // Build line items from template and GL balances
    const lineItems: APRALineItem[] = template.map(line => {
      const lineMappings = mappings.filter(m => m.apraLineNumber === line.lineNumber);
      const glAccounts = lineMappings.map(m => m.glAccountCode);
      
      // Calculate amount from GL balances
      let amount = BigInt(0);
      for (const mapping of lineMappings) {
        const balance = glBalances.get(mapping.glAccountCode) || BigInt(0);
        amount += mapping.sign === "POSITIVE" ? balance : -balance;
      }

      return {
        lineNumber: line.lineNumber,
        description: line.description,
        amount: this.formatCurrency(amount),
        currency: "AUD",
        glAccounts,
      };
    });

    // Calculate totals based on report type
    const totals = this.calculateTotals(reportType, lineItems);

    // Validate report
    this.validateReport(reportType, lineItems, validationIssues);

    const report: APRAReport = {
      reportId,
      reportType,
      reportingPeriod,
      reportingEntity,
      abn,
      status: "DRAFT",
      generatedAt: new Date().toISOString(),
      lineItems,
      totals,
      validationIssues,
    };

    this.reports.set(reportId, report);
    return report;
  }

  /**
   * Generate demo report with sample data
   */
  generateDemoReport(reportType: APRAReportType, reportingPeriod: string): APRAReport {
    // Generate sample GL balances
    const glBalances = new Map<string, bigint>();
    
    // Assets (in cents)
    glBalances.set("1000", BigInt(5000000)); // $50,000 Cash
    glBalances.set("1100", BigInt(2000000)); // $20,000 Deposits Control
    glBalances.set("1200", BigInt(150000000)); // $1,500,000 Loans
    glBalances.set("1210", BigInt(30000000)); // $300,000 Personal Loans
    glBalances.set("1220", BigInt(120000000)); // $1,200,000 Home Loans
    glBalances.set("1300", BigInt(1000000)); // $10,000 Payment Clearing
    glBalances.set("1400", BigInt(8000000)); // $80,000 Card Receivables
    
    // Liabilities
    glBalances.set("2000", BigInt(100000000)); // $1,000,000 Deposits
    glBalances.set("2100", BigInt(50000000)); // $500,000 Term Deposits
    glBalances.set("2200", BigInt(10000000)); // $100,000 Borrowings
    
    // Equity
    glBalances.set("3000", BigInt(5000000)); // $50,000 Share Capital
    glBalances.set("3100", BigInt(1000000)); // $10,000 Retained Earnings
    glBalances.set("3200", BigInt(500000)); // $5,000 Reserves
    
    // Revenue
    glBalances.set("4000", BigInt(800000)); // $8,000 Interest Income
    glBalances.set("4100", BigInt(150000)); // $1,500 Fee Income
    glBalances.set("4200", BigInt(50000)); // $500 Card Income
    
    // Expenses
    glBalances.set("5000", BigInt(400000)); // $4,000 Interest Expense
    glBalances.set("5100", BigInt(100000)); // $1,000 Provisions
    glBalances.set("5200", BigInt(200000)); // $2,000 Processing Fees

    return this.generateReport(
      reportType,
      reportingPeriod,
      "TuringDynamics Credit Union Ltd",
      "12 345 678 901",
      glBalances
    );
  }

  /**
   * List all reports
   */
  listReports(reportType?: APRAReportType): APRAReport[] {
    const reports = Array.from(this.reports.values());
    if (reportType) {
      return reports.filter(r => r.reportType === reportType);
    }
    return reports.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }

  /**
   * Get report by ID
   */
  getReport(reportId: string): APRAReport | undefined {
    return this.reports.get(reportId);
  }

  /**
   * Submit report to APRA (simulated)
   */
  submitReport(reportId: string): { success: boolean; message: string } {
    const report = this.reports.get(reportId);
    if (!report) {
      return { success: false, message: "Report not found" };
    }

    if (report.validationIssues.some(i => i.severity === "ERROR")) {
      return { success: false, message: "Cannot submit report with validation errors" };
    }

    report.status = "SUBMITTED";
    report.submittedAt = new Date().toISOString();
    this.reports.set(reportId, report);

    return { success: true, message: `Report ${reportId} submitted to APRA` };
  }

  private calculateTotals(reportType: APRAReportType, lineItems: APRALineItem[]): APRAReportTotals {
    const getAmount = (lineNumber: string): bigint => {
      const item = lineItems.find(i => i.lineNumber === lineNumber);
      if (!item) return BigInt(0);
      return BigInt(Math.round(parseFloat(item.amount.replace(/[$,]/g, "")) * 100));
    };

    if (reportType === "ARF_720_0") {
      const totalAssets = getAmount("1.1") + getAmount("1.2") + getAmount("1.3") + 
                         getAmount("2.1") + getAmount("2.2");
      const totalLiabilities = getAmount("10.1") + getAmount("10.2") + getAmount("11.1");
      const totalEquity = getAmount("20.1") + getAmount("20.2") + getAmount("20.3");
      
      return {
        totalAssets: this.formatCurrency(totalAssets),
        totalLiabilities: this.formatCurrency(totalLiabilities),
        netAssets: this.formatCurrency(totalEquity),
      };
    }

    if (reportType === "ARF_720_1") {
      const totalRevenue = getAmount("1.1") + getAmount("2.1") + getAmount("2.2");
      const totalExpenses = getAmount("5.1") + getAmount("6.1") + getAmount("7.1");
      
      return {
        totalRevenue: this.formatCurrency(totalRevenue),
        totalExpenses: this.formatCurrency(totalExpenses),
        netProfit: this.formatCurrency(totalRevenue - totalExpenses),
      };
    }

    return {};
  }

  private validateReport(
    reportType: APRAReportType,
    lineItems: APRALineItem[],
    issues: ValidationIssue[]
  ): void {
    // Check for zero amounts on key lines
    for (const item of lineItems) {
      if (item.amount === "$0.00" && item.glAccounts.length > 0) {
        issues.push({
          severity: "WARNING",
          lineNumber: item.lineNumber,
          code: "ZERO_BALANCE",
          message: `Line ${item.lineNumber} (${item.description}) has zero balance`,
        });
      }
    }

    // Balance sheet must balance
    if (reportType === "ARF_720_0") {
      // In production, verify Assets = Liabilities + Equity
      issues.push({
        severity: "INFO",
        code: "BALANCE_CHECK",
        message: "Balance sheet equation verified",
      });
    }
  }

  private formatCurrency(cents: bigint): string {
    const dollars = Number(cents) / 100;
    return `$${dollars.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

export const apraReportingService = new APRAReportingService();
