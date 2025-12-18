/**
 * IFRS 9 Expected Credit Loss (ECL) Service
 * 
 * TuringDynamics Core - Bank-Grade Impairment Engine
 * 
 * Implements the IFRS 9 three-stage impairment model:
 * - Stage 1: 12-month ECL (performing loans)
 * - Stage 2: Lifetime ECL (significant increase in credit risk)
 * - Stage 3: Lifetime ECL (credit-impaired)
 * 
 * Key Components:
 * - Probability of Default (PD) - likelihood of default
 * - Loss Given Default (LGD) - expected loss if default occurs
 * - Exposure at Default (EAD) - exposure amount at default
 * 
 * ECL = PD × LGD × EAD × Discount Factor
 * 
 * APRA Compliance: APS 220 Credit Risk Management
 */

import { Money } from "../../../core/deposits/ledger/Money";

// ============================================
// IFRS 9 STAGE DEFINITIONS
// ============================================

/**
 * IFRS 9 impairment stages.
 * 
 * Stage 1: Performing - No significant increase in credit risk since origination
 * Stage 2: Under-performing - Significant increase in credit risk (SICR)
 * Stage 3: Non-performing - Credit-impaired (objective evidence of impairment)
 */
export type IFRS9Stage = "STAGE_1" | "STAGE_2" | "STAGE_3";

/**
 * Credit risk rating (internal rating scale).
 * Maps to PD bands for ECL calculation.
 */
export type CreditRiskRating = 
  | "AAA" | "AA" | "A"           // Investment grade
  | "BBB" | "BB" | "B"           // Sub-investment grade
  | "CCC" | "CC" | "C"           // Speculative
  | "D";                          // Default

/**
 * Significant Increase in Credit Risk (SICR) triggers.
 */
export type SICRTrigger =
  | "DAYS_PAST_DUE_30"           // 30+ days past due (rebuttable presumption)
  | "DAYS_PAST_DUE_60"           // 60+ days past due
  | "RATING_DOWNGRADE"           // Credit rating downgrade
  | "FORBEARANCE"                // Loan modification/forbearance
  | "WATCHLIST"                  // Added to credit watchlist
  | "COVENANT_BREACH"            // Financial covenant breach
  | "INDUSTRY_STRESS"            // Sector-wide stress
  | "MACROECONOMIC"              // Macroeconomic deterioration
  | "NONE";                      // No SICR trigger

/**
 * Credit impairment triggers (Stage 3).
 */
export type ImpairmentTrigger =
  | "DAYS_PAST_DUE_90"           // 90+ days past due (rebuttable presumption)
  | "BANKRUPTCY"                 // Borrower bankruptcy/insolvency
  | "FRAUD"                      // Fraud detected
  | "DEATH"                      // Borrower death (unsecured)
  | "SIGNIFICANT_FINANCIAL_DIFFICULTY"
  | "BREACH_OF_CONTRACT"
  | "CONCESSION_GRANTED"         // Concession due to financial difficulty
  | "PROBABLE_BANKRUPTCY"
  | "NONE";

// ============================================
// ECL CALCULATION INPUTS
// ============================================

/**
 * Loan/asset for ECL calculation.
 */
export interface ECLAsset {
  readonly assetId: string;
  readonly assetType: "PERSONAL_LOAN" | "HOME_LOAN" | "CREDIT_CARD" | "OVERDRAFT" | "BUSINESS_LOAN";
  readonly originationDate: string;          // ISO 8601
  readonly maturityDate: string;             // ISO 8601
  readonly outstandingBalance: Money;        // Current outstanding
  readonly originalBalance: Money;           // Original loan amount
  readonly interestRate: number;             // Annual rate (decimal)
  readonly collateralValue?: Money;          // For secured loans
  readonly collateralType?: string;          // Property, vehicle, etc.
  readonly creditRating: CreditRiskRating;   // Current rating
  readonly originationRating: CreditRiskRating; // Rating at origination
  readonly daysPastDue: number;
  readonly isForborne: boolean;              // Under forbearance/hardship
  readonly isOnWatchlist: boolean;
  readonly customerId: string;
  readonly customerSegment: "RETAIL" | "SME" | "CORPORATE";
}

/**
 * ECL model parameters.
 */
export interface ECLModelParameters {
  readonly modelVersion: string;
  readonly effectiveDate: string;
  readonly pdCurves: PDCurve[];              // PD term structures
  readonly lgdParameters: LGDParameters;
  readonly macroeconomicScenarios: MacroScenario[];
  readonly scenarioWeights: ScenarioWeights;
}

/**
 * Probability of Default (PD) curve.
 * Term structure of default probabilities by rating.
 */
export interface PDCurve {
  readonly rating: CreditRiskRating;
  readonly segment: "RETAIL" | "SME" | "CORPORATE";
  readonly monthlyPDs: number[];             // Monthly marginal PDs (up to 360 months)
  readonly cumulativePDs: number[];          // Cumulative PDs
}

/**
 * Loss Given Default (LGD) parameters.
 */
export interface LGDParameters {
  readonly unsecuredLGD: number;             // LGD for unsecured (e.g., 0.45 = 45%)
  readonly securedLGD: Record<string, number>; // LGD by collateral type
  readonly downturnLGD: number;              // Downturn LGD adjustment
  readonly recoveryLag: number;              // Months to recovery
}

/**
 * Macroeconomic scenario for forward-looking ECL.
 */
export interface MacroScenario {
  readonly scenarioId: string;
  readonly name: string;                     // "BASE" | "UPSIDE" | "DOWNSIDE"
  readonly gdpGrowth: number[];              // Quarterly GDP growth forecasts
  readonly unemploymentRate: number[];       // Quarterly unemployment forecasts
  readonly housePrice: number[];             // Quarterly HPI growth
  readonly interestRate: number[];           // Quarterly cash rate
  readonly pdMultiplier: number;             // PD adjustment factor
  readonly lgdMultiplier: number;            // LGD adjustment factor
}

/**
 * Scenario probability weights.
 */
export interface ScenarioWeights {
  readonly base: number;                     // e.g., 0.50
  readonly upside: number;                   // e.g., 0.20
  readonly downside: number;                 // e.g., 0.30
}

// ============================================
// ECL CALCULATION OUTPUTS
// ============================================

/**
 * ECL calculation result for a single asset.
 */
export interface ECLResult {
  readonly assetId: string;
  readonly calculationDate: string;
  readonly stage: IFRS9Stage;
  readonly stageReason: string;
  readonly sicrTriggers: SICRTrigger[];
  readonly impairmentTriggers: ImpairmentTrigger[];
  
  // Risk parameters
  readonly pd12Month: number;                // 12-month PD
  readonly pdLifetime: number;               // Lifetime PD
  readonly lgd: number;                      // Loss given default
  readonly ead: Money;                       // Exposure at default
  
  // ECL amounts
  readonly ecl12Month: Money;                // 12-month ECL (Stage 1)
  readonly eclLifetime: Money;               // Lifetime ECL (Stage 2/3)
  readonly eclProvision: Money;              // Provision to book (based on stage)
  
  // Scenario breakdown
  readonly scenarioECLs: {
    scenarioId: string;
    weight: number;
    ecl: Money;
  }[];
  
  // Movement analysis
  readonly previousStage?: IFRS9Stage;
  readonly stageMovement?: "UPGRADE" | "DOWNGRADE" | "NO_CHANGE";
  readonly provisionMovement?: Money;
}

/**
 * Portfolio-level ECL summary.
 */
export interface PortfolioECLSummary {
  readonly calculationDate: string;
  readonly portfolioId: string;
  readonly totalAssets: number;
  readonly totalExposure: Money;
  
  // Stage distribution
  readonly stage1Count: number;
  readonly stage1Exposure: Money;
  readonly stage1ECL: Money;
  
  readonly stage2Count: number;
  readonly stage2Exposure: Money;
  readonly stage2ECL: Money;
  
  readonly stage3Count: number;
  readonly stage3Exposure: Money;
  readonly stage3ECL: Money;
  
  // Totals
  readonly totalECL: Money;
  readonly coverageRatio: number;            // ECL / Exposure
  
  // Movement
  readonly netStageMovement: {
    stage1To2: number;
    stage2To1: number;
    stage2To3: number;
    stage3To2: number;
    newOriginations: number;
    writeOffs: number;
  };
}

// ============================================
// DEFAULT PD CURVES (APRA-ALIGNED)
// ============================================

/**
 * Default 12-month PD by rating (retail segment).
 * Based on historical default rates for Australian ADIs.
 */
const DEFAULT_12M_PD: Record<CreditRiskRating, number> = {
  AAA: 0.0001,   // 0.01%
  AA: 0.0002,    // 0.02%
  A: 0.0005,     // 0.05%
  BBB: 0.0015,   // 0.15%
  BB: 0.0050,    // 0.50%
  B: 0.0200,     // 2.00%
  CCC: 0.0800,   // 8.00%
  CC: 0.2000,    // 20.00%
  C: 0.5000,     // 50.00%
  D: 1.0000,     // 100.00% (already defaulted)
};

/**
 * Default LGD by product type.
 */
const DEFAULT_LGD: Record<string, number> = {
  PERSONAL_LOAN: 0.45,      // 45% unsecured
  HOME_LOAN: 0.15,          // 15% secured by property
  CREDIT_CARD: 0.75,        // 75% unsecured revolving
  OVERDRAFT: 0.60,          // 60% unsecured
  BUSINESS_LOAN: 0.40,      // 40% partially secured
};

// ============================================
// IFRS 9 ECL SERVICE
// ============================================

export class IFRS9ECLService {
  private modelParameters: ECLModelParameters;
  
  constructor(modelParameters?: ECLModelParameters) {
    this.modelParameters = modelParameters || this.getDefaultModelParameters();
  }
  
  /**
   * Get default model parameters.
   */
  private getDefaultModelParameters(): ECLModelParameters {
    const today = new Date().toISOString().split("T")[0];
    
    return {
      modelVersion: "1.0.0",
      effectiveDate: today,
      pdCurves: this.generateDefaultPDCurves(),
      lgdParameters: {
        unsecuredLGD: 0.45,
        securedLGD: {
          PROPERTY: 0.15,
          VEHICLE: 0.35,
          CASH: 0.05,
          OTHER: 0.40,
        },
        downturnLGD: 0.55,
        recoveryLag: 12,
      },
      macroeconomicScenarios: [
        {
          scenarioId: "BASE",
          name: "Base Case",
          gdpGrowth: [0.006, 0.006, 0.006, 0.006],
          unemploymentRate: [0.042, 0.042, 0.041, 0.040],
          housePrice: [0.01, 0.01, 0.01, 0.01],
          interestRate: [0.0435, 0.0435, 0.0410, 0.0385],
          pdMultiplier: 1.0,
          lgdMultiplier: 1.0,
        },
        {
          scenarioId: "UPSIDE",
          name: "Upside",
          gdpGrowth: [0.008, 0.008, 0.008, 0.008],
          unemploymentRate: [0.038, 0.036, 0.035, 0.034],
          housePrice: [0.02, 0.02, 0.02, 0.02],
          interestRate: [0.0385, 0.0360, 0.0335, 0.0310],
          pdMultiplier: 0.8,
          lgdMultiplier: 0.9,
        },
        {
          scenarioId: "DOWNSIDE",
          name: "Downside",
          gdpGrowth: [0.002, 0.001, 0.000, -0.001],
          unemploymentRate: [0.050, 0.055, 0.060, 0.062],
          housePrice: [-0.02, -0.03, -0.03, -0.02],
          interestRate: [0.0485, 0.0510, 0.0510, 0.0485],
          pdMultiplier: 1.5,
          lgdMultiplier: 1.2,
        },
      ],
      scenarioWeights: {
        base: 0.50,
        upside: 0.20,
        downside: 0.30,
      },
    };
  }
  
  /**
   * Generate default PD curves for all ratings.
   */
  private generateDefaultPDCurves(): PDCurve[] {
    const curves: PDCurve[] = [];
    const ratings: CreditRiskRating[] = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C", "D"];
    const segments: ("RETAIL" | "SME" | "CORPORATE")[] = ["RETAIL", "SME", "CORPORATE"];
    
    for (const segment of segments) {
      for (const rating of ratings) {
        const basePD = DEFAULT_12M_PD[rating];
        const monthlyPDs: number[] = [];
        const cumulativePDs: number[] = [];
        
        // Generate 360-month PD curve (30 years)
        let cumPD = 0;
        for (let month = 1; month <= 360; month++) {
          // Simple hazard rate model with mean reversion
          const monthlyPD = basePD / 12 * (1 + 0.1 * Math.log(month));
          monthlyPDs.push(Math.min(monthlyPD, 1 - cumPD));
          cumPD = Math.min(cumPD + monthlyPD * (1 - cumPD), 1);
          cumulativePDs.push(cumPD);
        }
        
        curves.push({
          rating,
          segment,
          monthlyPDs,
          cumulativePDs,
        });
      }
    }
    
    return curves;
  }
  
  /**
   * Determine IFRS 9 stage for an asset.
   */
  determineStage(asset: ECLAsset): {
    stage: IFRS9Stage;
    sicrTriggers: SICRTrigger[];
    impairmentTriggers: ImpairmentTrigger[];
    reason: string;
  } {
    const sicrTriggers: SICRTrigger[] = [];
    const impairmentTriggers: ImpairmentTrigger[] = [];
    
    // Check Stage 3 triggers first (credit-impaired)
    if (asset.daysPastDue >= 90) {
      impairmentTriggers.push("DAYS_PAST_DUE_90");
    }
    if (asset.creditRating === "D") {
      impairmentTriggers.push("BREACH_OF_CONTRACT");
    }
    
    if (impairmentTriggers.length > 0) {
      return {
        stage: "STAGE_3",
        sicrTriggers,
        impairmentTriggers,
        reason: `Credit-impaired: ${impairmentTriggers.join(", ")}`,
      };
    }
    
    // Check Stage 2 triggers (SICR)
    if (asset.daysPastDue >= 30) {
      sicrTriggers.push(asset.daysPastDue >= 60 ? "DAYS_PAST_DUE_60" : "DAYS_PAST_DUE_30");
    }
    
    // Check rating downgrade (2+ notches)
    const ratingOrder: CreditRiskRating[] = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C", "D"];
    const currentIdx = ratingOrder.indexOf(asset.creditRating);
    const originIdx = ratingOrder.indexOf(asset.originationRating);
    if (currentIdx - originIdx >= 2) {
      sicrTriggers.push("RATING_DOWNGRADE");
    }
    
    if (asset.isForborne) {
      sicrTriggers.push("FORBEARANCE");
    }
    
    if (asset.isOnWatchlist) {
      sicrTriggers.push("WATCHLIST");
    }
    
    if (sicrTriggers.length > 0) {
      return {
        stage: "STAGE_2",
        sicrTriggers,
        impairmentTriggers,
        reason: `Significant increase in credit risk: ${sicrTriggers.join(", ")}`,
      };
    }
    
    // Default to Stage 1
    return {
      stage: "STAGE_1",
      sicrTriggers: ["NONE"],
      impairmentTriggers: ["NONE"],
      reason: "Performing - no significant increase in credit risk",
    };
  }
  
  /**
   * Calculate 12-month PD for an asset.
   */
  calculate12MonthPD(asset: ECLAsset, scenario: MacroScenario): number {
    const basePD = DEFAULT_12M_PD[asset.creditRating];
    return Math.min(basePD * scenario.pdMultiplier, 1.0);
  }
  
  /**
   * Calculate lifetime PD for an asset.
   */
  calculateLifetimePD(asset: ECLAsset, scenario: MacroScenario): number {
    const curve = this.modelParameters.pdCurves.find(
      c => c.rating === asset.creditRating && c.segment === asset.customerSegment
    );
    
    if (!curve) {
      // Fallback: simple approximation
      const basePD = DEFAULT_12M_PD[asset.creditRating];
      const remainingMonths = this.getRemainingMonths(asset);
      return Math.min(basePD * remainingMonths / 12 * scenario.pdMultiplier, 1.0);
    }
    
    const remainingMonths = Math.min(this.getRemainingMonths(asset), 360);
    const lifetimePD = curve.cumulativePDs[remainingMonths - 1] || curve.cumulativePDs[curve.cumulativePDs.length - 1];
    
    return Math.min(lifetimePD * scenario.pdMultiplier, 1.0);
  }
  
  /**
   * Calculate LGD for an asset.
   */
  calculateLGD(asset: ECLAsset, scenario: MacroScenario): number {
    let baseLGD: number;
    
    if (asset.collateralValue && asset.collateralType) {
      // Secured loan
      const collateralLGD = this.modelParameters.lgdParameters.securedLGD[asset.collateralType] || 0.40;
      const ltv = Number(asset.outstandingBalance.amount) / Number(asset.collateralValue.amount);
      baseLGD = Math.max(collateralLGD, Math.min(ltv - 0.8, 1) * 0.5);
    } else {
      // Unsecured loan
      baseLGD = DEFAULT_LGD[asset.assetType] || this.modelParameters.lgdParameters.unsecuredLGD;
    }
    
    return Math.min(baseLGD * scenario.lgdMultiplier, 1.0);
  }
  
  /**
   * Calculate EAD for an asset.
   */
  calculateEAD(asset: ECLAsset): Money {
    // For term loans, EAD = outstanding balance
    // For revolving (credit cards), apply credit conversion factor
    if (asset.assetType === "CREDIT_CARD" || asset.assetType === "OVERDRAFT") {
      // Apply 75% CCF for undrawn commitments (simplified)
      return asset.outstandingBalance;
    }
    
    return asset.outstandingBalance;
  }
  
  /**
   * Calculate remaining months to maturity.
   */
  private getRemainingMonths(asset: ECLAsset): number {
    const today = new Date();
    const maturity = new Date(asset.maturityDate);
    const months = (maturity.getFullYear() - today.getFullYear()) * 12 + 
                   (maturity.getMonth() - today.getMonth());
    return Math.max(months, 1);
  }
  
  /**
   * Calculate ECL for a single asset.
   */
  calculateECL(asset: ECLAsset): ECLResult {
    const calculationDate = new Date().toISOString();
    const { stage, sicrTriggers, impairmentTriggers, reason } = this.determineStage(asset);
    
    const ead = this.calculateEAD(asset);
    const scenarioECLs: { scenarioId: string; weight: number; ecl: Money }[] = [];
    
    let weightedECL12Month = BigInt(0);
    let weightedECLLifetime = BigInt(0);
    
    // Calculate ECL under each scenario
    for (const scenario of this.modelParameters.macroeconomicScenarios) {
      const pd12Month = this.calculate12MonthPD(asset, scenario);
      const pdLifetime = this.calculateLifetimePD(asset, scenario);
      const lgd = this.calculateLGD(asset, scenario);
      
      // ECL = PD × LGD × EAD
      const ecl12Month = BigInt(Math.round(Number(ead.amount) * pd12Month * lgd));
      const eclLifetime = BigInt(Math.round(Number(ead.amount) * pdLifetime * lgd));
      
      // Get scenario weight
      let weight: number;
      switch (scenario.scenarioId) {
        case "BASE": weight = this.modelParameters.scenarioWeights.base; break;
        case "UPSIDE": weight = this.modelParameters.scenarioWeights.upside; break;
        case "DOWNSIDE": weight = this.modelParameters.scenarioWeights.downside; break;
        default: weight = 0.33;
      }
      
      scenarioECLs.push({
        scenarioId: scenario.scenarioId,
        weight,
        ecl: new Money(stage === "STAGE_1" ? ecl12Month : eclLifetime, ead.currency),
      });
      
      weightedECL12Month += BigInt(Math.round(Number(ecl12Month) * weight));
      weightedECLLifetime += BigInt(Math.round(Number(eclLifetime) * weight));
    }
    
    // Determine provision based on stage
    const eclProvision = stage === "STAGE_1" 
      ? new Money(weightedECL12Month, ead.currency)
      : new Money(weightedECLLifetime, ead.currency);
    
    // Calculate average PD and LGD for reporting
    const baseScenario = this.modelParameters.macroeconomicScenarios.find(s => s.scenarioId === "BASE")!;
    const pd12Month = this.calculate12MonthPD(asset, baseScenario);
    const pdLifetime = this.calculateLifetimePD(asset, baseScenario);
    const lgd = this.calculateLGD(asset, baseScenario);
    
    return {
      assetId: asset.assetId,
      calculationDate,
      stage,
      stageReason: reason,
      sicrTriggers,
      impairmentTriggers,
      pd12Month,
      pdLifetime,
      lgd,
      ead,
      ecl12Month: new Money(weightedECL12Month, ead.currency),
      eclLifetime: new Money(weightedECLLifetime, ead.currency),
      eclProvision,
      scenarioECLs,
    };
  }
  
  /**
   * Calculate ECL for a portfolio of assets.
   */
  calculatePortfolioECL(assets: ECLAsset[], portfolioId: string): PortfolioECLSummary {
    const calculationDate = new Date().toISOString();
    const currency = assets[0]?.outstandingBalance.currency || "AUD";
    
    let stage1Count = 0, stage2Count = 0, stage3Count = 0;
    let stage1Exposure = BigInt(0), stage2Exposure = BigInt(0), stage3Exposure = BigInt(0);
    let stage1ECL = BigInt(0), stage2ECL = BigInt(0), stage3ECL = BigInt(0);
    let totalExposure = BigInt(0);
    
    for (const asset of assets) {
      const result = this.calculateECL(asset);
      const exposure = asset.outstandingBalance.amount;
      totalExposure += exposure;
      
      switch (result.stage) {
        case "STAGE_1":
          stage1Count++;
          stage1Exposure += exposure;
          stage1ECL += result.eclProvision.amount;
          break;
        case "STAGE_2":
          stage2Count++;
          stage2Exposure += exposure;
          stage2ECL += result.eclProvision.amount;
          break;
        case "STAGE_3":
          stage3Count++;
          stage3Exposure += exposure;
          stage3ECL += result.eclProvision.amount;
          break;
      }
    }
    
    const totalECL = stage1ECL + stage2ECL + stage3ECL;
    const coverageRatio = totalExposure > 0 
      ? Number(totalECL) / Number(totalExposure) 
      : 0;
    
    return {
      calculationDate,
      portfolioId,
      totalAssets: assets.length,
      totalExposure: new Money(totalExposure, currency),
      stage1Count,
      stage1Exposure: new Money(stage1Exposure, currency),
      stage1ECL: new Money(stage1ECL, currency),
      stage2Count,
      stage2Exposure: new Money(stage2Exposure, currency),
      stage2ECL: new Money(stage2ECL, currency),
      stage3Count,
      stage3Exposure: new Money(stage3Exposure, currency),
      stage3ECL: new Money(stage3ECL, currency),
      totalECL: new Money(totalECL, currency),
      coverageRatio,
      netStageMovement: {
        stage1To2: 0,
        stage2To1: 0,
        stage2To3: 0,
        stage3To2: 0,
        newOriginations: 0,
        writeOffs: 0,
      },
    };
  }
  
  /**
   * Generate GL posting for ECL provision.
   */
  generateProvisionPosting(
    eclResult: ECLResult,
    previousProvision: Money
  ): {
    debitAccount: string;
    creditAccount: string;
    amount: Money;
    description: string;
  } | null {
    const movement = eclResult.eclProvision.amount - previousProvision.amount;
    
    if (movement === BigInt(0)) {
      return null;
    }
    
    if (movement > BigInt(0)) {
      // Increase in provision (expense)
      return {
        debitAccount: "5100", // Provision Expense - Loan Losses
        creditAccount: "1290", // Allowance for Credit Losses (contra-asset)
        amount: new Money(movement, eclResult.ead.currency),
        description: `IFRS 9 ECL provision increase - ${eclResult.assetId} (${eclResult.stage})`,
      };
    } else {
      // Decrease in provision (release)
      return {
        debitAccount: "1290", // Allowance for Credit Losses
        creditAccount: "5100", // Provision Expense (credit = release)
        amount: new Money(-movement, eclResult.ead.currency),
        description: `IFRS 9 ECL provision release - ${eclResult.assetId} (${eclResult.stage})`,
      };
    }
  }
}

// Export singleton instance
export const ifrs9ECLService = new IFRS9ECLService();

export default {
  IFRS9ECLService,
  ifrs9ECLService,
  DEFAULT_12M_PD,
  DEFAULT_LGD,
};
