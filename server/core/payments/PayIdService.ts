/**
 * PayID Service
 * 
 * Resolves PayIDs to bank account details for instant recipient verification.
 * 
 * PayID Types:
 * - EMAIL: email@example.com
 * - PHONE: +61412345678
 * - ABN: 12345678901
 * - ORG_ID: Organization identifier
 */

import { nanoid } from "nanoid";

// ============================================
// TYPES
// ============================================

export type PayIdType = "EMAIL" | "PHONE" | "ABN" | "ORG_ID";

export interface PayIdResolution {
  payIdType: PayIdType;
  payIdValue: string;
  resolved: boolean;
  
  // Resolved details
  name?: string;
  bsb?: string;
  accountNumber?: string;
  
  // Verification
  verifiedAt?: string;
  expiresAt?: string;
  
  // Error
  error?: string;
  errorCode?: string;
}

export interface PayIdLookupResult {
  success: boolean;
  resolution?: PayIdResolution;
  error?: string;
  latencyMs: number;
}

export interface PayIdValidation {
  valid: boolean;
  type?: PayIdType;
  normalizedValue?: string;
  error?: string;
}

// ============================================
// PAYID VALIDATION
// ============================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+61[0-9]{9}$/;
const ABN_REGEX = /^[0-9]{11}$/;

function validatePayId(value: string): PayIdValidation {
  const trimmed = value.trim();
  
  // Check email
  if (EMAIL_REGEX.test(trimmed)) {
    return {
      valid: true,
      type: "EMAIL",
      normalizedValue: trimmed.toLowerCase(),
    };
  }
  
  // Check phone (normalize to +61 format)
  let phone = trimmed.replace(/[\s\-()]/g, "");
  if (phone.startsWith("0")) {
    phone = "+61" + phone.substring(1);
  }
  if (PHONE_REGEX.test(phone)) {
    return {
      valid: true,
      type: "PHONE",
      normalizedValue: phone,
    };
  }
  
  // Check ABN
  const abn = trimmed.replace(/[\s\-]/g, "");
  if (ABN_REGEX.test(abn)) {
    return {
      valid: true,
      type: "ABN",
      normalizedValue: abn,
    };
  }
  
  // Check ORG_ID (alphanumeric, 6-20 chars)
  if (/^[A-Za-z0-9]{6,20}$/.test(trimmed)) {
    return {
      valid: true,
      type: "ORG_ID",
      normalizedValue: trimmed.toUpperCase(),
    };
  }
  
  return {
    valid: false,
    error: "Invalid PayID format. Use email, phone (+61), ABN, or organization ID.",
  };
}

// ============================================
// SIMULATED PAYID DIRECTORY
// ============================================

const SIMULATED_PAYIDS: Record<string, { name: string; bsb: string; accountNumber: string }> = {
  // Email PayIDs
  "john.smith@example.com": { name: "JOHN SMITH", bsb: "062-000", accountNumber: "12345678" },
  "jane.doe@company.com.au": { name: "JANE DOE", bsb: "063-001", accountNumber: "87654321" },
  "accounts@supplier.com.au": { name: "SUPPLIER PTY LTD", bsb: "064-002", accountNumber: "11223344" },
  "payroll@business.com.au": { name: "BUSINESS SERVICES", bsb: "065-003", accountNumber: "55667788" },
  
  // Phone PayIDs
  "+61412345678": { name: "MOBILE USER", bsb: "062-000", accountNumber: "99887766" },
  "+61298765432": { name: "LANDLINE USER", bsb: "063-001", accountNumber: "44332211" },
  
  // ABN PayIDs
  "12345678901": { name: "ACME CORPORATION PTY LTD", bsb: "064-002", accountNumber: "12121212" },
  "98765432109": { name: "WIDGETS AUSTRALIA", bsb: "065-003", accountNumber: "34343434" },
  
  // ORG_ID PayIDs
  "TURINGDYN": { name: "TURINGDYNAMICS PTY LTD", bsb: "062-000", accountNumber: "56565656" },
  "GOVTAX2024": { name: "AUSTRALIAN TAXATION OFFICE", bsb: "092-009", accountNumber: "78787878" },
};

// ============================================
// PAYID SERVICE
// ============================================

class PayIdService {
  private cache: Map<string, { resolution: PayIdResolution; cachedAt: number }> = new Map();
  private cacheTtlMs = 5 * 60 * 1000; // 5 minutes

  /**
   * Lookup PayID and resolve to account details.
   */
  async lookup(payIdValue: string): Promise<PayIdLookupResult> {
    const start = Date.now();
    
    // Validate PayID format
    const validation = validatePayId(payIdValue);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        latencyMs: Date.now() - start,
      };
    }
    
    const normalizedValue = validation.normalizedValue!;
    const payIdType = validation.type!;
    
    // Check cache
    const cached = this.cache.get(normalizedValue);
    if (cached && Date.now() - cached.cachedAt < this.cacheTtlMs) {
      return {
        success: cached.resolution.resolved,
        resolution: cached.resolution,
        latencyMs: Date.now() - start,
      };
    }
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 100));
    
    // Lookup in simulated directory
    const account = SIMULATED_PAYIDS[normalizedValue];
    
    const resolution: PayIdResolution = {
      payIdType,
      payIdValue: normalizedValue,
      resolved: !!account,
      name: account?.name,
      bsb: account?.bsb,
      accountNumber: account?.accountNumber,
      verifiedAt: account ? new Date().toISOString() : undefined,
      expiresAt: account ? new Date(Date.now() + this.cacheTtlMs).toISOString() : undefined,
      error: account ? undefined : "PayID not found",
      errorCode: account ? undefined : "PAYID_NOT_FOUND",
    };
    
    // Cache result
    this.cache.set(normalizedValue, { resolution, cachedAt: Date.now() });
    
    return {
      success: resolution.resolved,
      resolution,
      latencyMs: Date.now() - start,
    };
  }

  /**
   * Validate PayID format without lookup.
   */
  validate(payIdValue: string): PayIdValidation {
    return validatePayId(payIdValue);
  }

  /**
   * Get all registered PayIDs (for testing/demo).
   */
  getRegisteredPayIds(): string[] {
    return Object.keys(SIMULATED_PAYIDS);
  }

  /**
   * Register a new PayID (for testing/demo).
   */
  registerPayId(
    payIdValue: string,
    name: string,
    bsb: string,
    accountNumber: string
  ): { success: boolean; error?: string } {
    const validation = validatePayId(payIdValue);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    const normalizedValue = validation.normalizedValue!;
    
    if (SIMULATED_PAYIDS[normalizedValue]) {
      return { success: false, error: "PayID already registered" };
    }
    
    SIMULATED_PAYIDS[normalizedValue] = { name, bsb, accountNumber };
    return { success: true };
  }

  /**
   * Clear cache.
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export const payIdService = new PayIdService();
export default payIdService;
