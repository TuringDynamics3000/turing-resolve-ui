/**
 * Lending Products - Product Definitions
 * 
 * Defines loan products with product-specific terms, rates, and approval workflows.
 * Integrated with CreditPolicy and Resolve.
 */

export type LoanProductType = "PERSONAL" | "HOME" | "AUTO" | "BUSINESS";

export interface LoanProduct {
  type: LoanProductType;
  name: string;
  description: string;
  
  // Term limits
  minTermMonths: number;
  maxTermMonths: number;
  
  // Principal limits
  minPrincipal: bigint;
  maxPrincipal: bigint;
  
  // Interest rate range
  minApr: number; // Annual percentage rate
  maxApr: number;
  baseApr: number; // Base rate before risk adjustment
  
  // Security
  secured: boolean;
  collateralRequired: boolean;
  
  // Approval workflow
  requiresManualReview: boolean;
  requiresResolveApproval: boolean;
  maxAutoApprovalPrincipal: bigint; // Auto-approve below this amount
  
  // Risk scoring
  baseRiskScore: number; // 0-100, higher = riskier
  riskScoreMultiplier: number; // Multiplier for credit policy risk score
}

/**
 * Loan Product Catalog
 */
export const LOAN_PRODUCTS: Record<LoanProductType, LoanProduct> = {
  PERSONAL: {
    type: "PERSONAL",
    name: "Personal Loan",
    description: "Unsecured personal loan for general purposes (debt consolidation, home improvement, etc.)",
    
    minTermMonths: 12,
    maxTermMonths: 60, // 1-5 years
    
    minPrincipal: BigInt(1000_00), // $1,000
    maxPrincipal: BigInt(50000_00), // $50,000
    
    minApr: 0.08, // 8%
    maxApr: 0.15, // 15%
    baseApr: 0.10, // 10%
    
    secured: false,
    collateralRequired: false,
    
    requiresManualReview: false,
    requiresResolveApproval: true,
    maxAutoApprovalPrincipal: BigInt(10000_00), // $10,000
    
    baseRiskScore: 50, // Medium risk
    riskScoreMultiplier: 1.2, // Higher risk than secured loans
  },
  
  HOME: {
    type: "HOME",
    name: "Home Loan",
    description: "Secured home loan for property purchase or refinancing",
    
    minTermMonths: 180, // 15 years
    maxTermMonths: 360, // 30 years
    
    minPrincipal: BigInt(100000_00), // $100,000
    maxPrincipal: BigInt(2000000_00), // $2,000,000
    
    minApr: 0.03, // 3%
    maxApr: 0.06, // 6%
    baseApr: 0.045, // 4.5%
    
    secured: true,
    collateralRequired: true,
    
    requiresManualReview: true,
    requiresResolveApproval: true,
    maxAutoApprovalPrincipal: BigInt(0), // Always requires manual review
    
    baseRiskScore: 20, // Low risk (secured by property)
    riskScoreMultiplier: 0.8, // Lower risk multiplier
  },
  
  AUTO: {
    type: "AUTO",
    name: "Auto Loan",
    description: "Secured auto loan for vehicle purchase",
    
    minTermMonths: 36, // 3 years
    maxTermMonths: 84, // 7 years
    
    minPrincipal: BigInt(5000_00), // $5,000
    maxPrincipal: BigInt(100000_00), // $100,000
    
    minApr: 0.05, // 5%
    maxApr: 0.10, // 10%
    baseApr: 0.07, // 7%
    
    secured: true,
    collateralRequired: true,
    
    requiresManualReview: false,
    requiresResolveApproval: true,
    maxAutoApprovalPrincipal: BigInt(50000_00), // $50,000
    
    baseRiskScore: 30, // Low-medium risk (secured by vehicle)
    riskScoreMultiplier: 1.0, // Standard risk multiplier
  },
  
  BUSINESS: {
    type: "BUSINESS",
    name: "Business Loan",
    description: "Business loan for working capital, equipment, or expansion",
    
    minTermMonths: 12,
    maxTermMonths: 120, // 1-10 years
    
    minPrincipal: BigInt(10000_00), // $10,000
    maxPrincipal: BigInt(500000_00), // $500,000
    
    minApr: 0.06, // 6%
    maxApr: 0.12, // 12%
    baseApr: 0.08, // 8%
    
    secured: false, // Can be secured or unsecured
    collateralRequired: false,
    
    requiresManualReview: true,
    requiresResolveApproval: true,
    maxAutoApprovalPrincipal: BigInt(25000_00), // $25,000
    
    baseRiskScore: 40, // Medium risk
    riskScoreMultiplier: 1.1, // Slightly higher risk
  },
};

/**
 * Get loan product by type
 */
export function getLoanProduct(type: LoanProductType): LoanProduct {
  return LOAN_PRODUCTS[type];
}

/**
 * Validate loan application against product limits
 */
export function validateLoanApplication(
  productType: LoanProductType,
  principal: bigint,
  termMonths: number
): {
  valid: boolean;
  errors: string[];
} {
  const product = getLoanProduct(productType);
  const errors: string[] = [];
  
  if (principal < product.minPrincipal) {
    errors.push(`Principal below minimum (${formatCurrency(product.minPrincipal)})`);
  }
  
  if (principal > product.maxPrincipal) {
    errors.push(`Principal above maximum (${formatCurrency(product.maxPrincipal)})`);
  }
  
  if (termMonths < product.minTermMonths) {
    errors.push(`Term below minimum (${product.minTermMonths} months)`);
  }
  
  if (termMonths > product.maxTermMonths) {
    errors.push(`Term above maximum (${product.maxTermMonths} months)`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate interest rate for loan product based on risk score
 */
export function calculateProductRate(
  productType: LoanProductType,
  riskScore: number // 0-100
): number {
  const product = getLoanProduct(productType);
  
  // Adjust base rate by risk score
  const riskPremium = (riskScore / 100) * (product.maxApr - product.baseApr) * product.riskScoreMultiplier;
  const rate = product.baseApr + riskPremium;
  
  // Clamp to product limits
  return Math.max(product.minApr, Math.min(product.maxApr, rate));
}

/**
 * Determine if loan requires manual review
 */
export function requiresManualReview(
  productType: LoanProductType,
  principal: bigint
): boolean {
  const product = getLoanProduct(productType);
  
  if (product.requiresManualReview) {
    return true;
  }
  
  if (principal > product.maxAutoApprovalPrincipal) {
    return true;
  }
  
  return false;
}

/**
 * Format currency for display
 */
function formatCurrency(amount: bigint): string {
  return `$${(Number(amount) / 100).toLocaleString()}`;
}
