/**
 * PayID Registration Service
 * 
 * Allows customers to register, manage, and deactivate PayIDs
 * linked to their bank accounts.
 */

import { nanoid } from "nanoid";

// ============================================
// TYPES
// ============================================

export type PayIdType = "EMAIL" | "PHONE" | "ABN" | "ORG_ID";
export type PayIdStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";

export interface RegisteredPayId {
  payIdId: string;
  customerId: string;
  payIdType: PayIdType;
  payIdValue: string;
  normalizedValue: string;
  
  // Linked account
  accountId: string;
  accountName: string;
  bsb: string;
  accountNumber: string;
  
  // Status
  status: PayIdStatus;
  isPrimary: boolean;
  
  // Verification
  verifiedAt?: string;
  verificationMethod?: "EMAIL_OTP" | "SMS_OTP" | "DOCUMENT";
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  deactivatedAt?: string;
}

export interface PayIdRegistrationRequest {
  customerId: string;
  payIdType: PayIdType;
  payIdValue: string;
  accountId: string;
  accountName: string;
  bsb: string;
  accountNumber: string;
  isPrimary?: boolean;
}

export interface PayIdRegistrationResult {
  success: boolean;
  payId?: RegisteredPayId;
  verificationRequired?: boolean;
  verificationMethod?: "EMAIL_OTP" | "SMS_OTP";
  error?: string;
  errorCode?: string;
}

export interface PayIdVerificationResult {
  success: boolean;
  payId?: RegisteredPayId;
  error?: string;
}

// ============================================
// VALIDATION
// ============================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+61[0-9]{9}$/;
const ABN_REGEX = /^[0-9]{11}$/;

function normalizePayId(type: PayIdType, value: string): string | null {
  const trimmed = value.trim();
  
  switch (type) {
    case "EMAIL":
      if (EMAIL_REGEX.test(trimmed)) {
        return trimmed.toLowerCase();
      }
      return null;
      
    case "PHONE":
      let phone = trimmed.replace(/[\s\-()]/g, "");
      if (phone.startsWith("0")) {
        phone = "+61" + phone.substring(1);
      }
      if (PHONE_REGEX.test(phone)) {
        return phone;
      }
      return null;
      
    case "ABN":
      const abn = trimmed.replace(/[\s\-]/g, "");
      if (ABN_REGEX.test(abn)) {
        return abn;
      }
      return null;
      
    case "ORG_ID":
      if (/^[A-Za-z0-9]{6,20}$/.test(trimmed)) {
        return trimmed.toUpperCase();
      }
      return null;
      
    default:
      return null;
  }
}

// ============================================
// PAYID REGISTRATION SERVICE
// ============================================

class PayIdRegistrationService {
  private registrations: Map<string, RegisteredPayId> = new Map();
  private byCustomer: Map<string, Set<string>> = new Map();
  private byNormalizedValue: Map<string, string> = new Map();
  private pendingVerifications: Map<string, { code: string; expiresAt: number }> = new Map();

  /**
   * Register a new PayID for a customer.
   */
  async register(request: PayIdRegistrationRequest): Promise<PayIdRegistrationResult> {
    // Normalize PayID value
    const normalizedValue = normalizePayId(request.payIdType, request.payIdValue);
    if (!normalizedValue) {
      return {
        success: false,
        error: `Invalid ${request.payIdType} format`,
        errorCode: "INVALID_FORMAT",
      };
    }
    
    // Check if PayID is already registered
    if (this.byNormalizedValue.has(normalizedValue)) {
      return {
        success: false,
        error: "This PayID is already registered",
        errorCode: "ALREADY_REGISTERED",
      };
    }
    
    // Create registration
    const payId: RegisteredPayId = {
      payIdId: nanoid(),
      customerId: request.customerId,
      payIdType: request.payIdType,
      payIdValue: request.payIdValue,
      normalizedValue,
      accountId: request.accountId,
      accountName: request.accountName,
      bsb: request.bsb,
      accountNumber: request.accountNumber,
      status: "PENDING",
      isPrimary: request.isPrimary ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Store registration
    this.registrations.set(payId.payIdId, payId);
    this.byNormalizedValue.set(normalizedValue, payId.payIdId);
    
    if (!this.byCustomer.has(request.customerId)) {
      this.byCustomer.set(request.customerId, new Set());
    }
    this.byCustomer.get(request.customerId)!.add(payId.payIdId);
    
    // Generate verification code
    const verificationCode = Math.random().toString().slice(2, 8);
    this.pendingVerifications.set(payId.payIdId, {
      code: verificationCode,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });
    
    // Determine verification method
    const verificationMethod = request.payIdType === "EMAIL" ? "EMAIL_OTP" : "SMS_OTP";
    
    // In production, send verification code via email/SMS
    console.log(`[PayID Registration] Verification code for ${normalizedValue}: ${verificationCode}`);
    
    return {
      success: true,
      payId,
      verificationRequired: true,
      verificationMethod,
    };
  }

  /**
   * Verify a pending PayID registration.
   */
  async verify(payIdId: string, code: string): Promise<PayIdVerificationResult> {
    const payId = this.registrations.get(payIdId);
    if (!payId) {
      return { success: false, error: "PayID not found" };
    }
    
    if (payId.status !== "PENDING") {
      return { success: false, error: "PayID is not pending verification" };
    }
    
    const verification = this.pendingVerifications.get(payIdId);
    if (!verification) {
      return { success: false, error: "No verification pending" };
    }
    
    if (Date.now() > verification.expiresAt) {
      this.pendingVerifications.delete(payIdId);
      return { success: false, error: "Verification code expired" };
    }
    
    if (verification.code !== code) {
      return { success: false, error: "Invalid verification code" };
    }
    
    // Activate PayID
    payId.status = "ACTIVE";
    payId.verifiedAt = new Date().toISOString();
    payId.verificationMethod = payId.payIdType === "EMAIL" ? "EMAIL_OTP" : "SMS_OTP";
    payId.updatedAt = new Date().toISOString();
    
    this.pendingVerifications.delete(payIdId);
    
    return { success: true, payId };
  }

  /**
   * Resend verification code.
   */
  async resendVerification(payIdId: string): Promise<{ success: boolean; error?: string }> {
    const payId = this.registrations.get(payIdId);
    if (!payId) {
      return { success: false, error: "PayID not found" };
    }
    
    if (payId.status !== "PENDING") {
      return { success: false, error: "PayID is not pending verification" };
    }
    
    // Generate new code
    const verificationCode = Math.random().toString().slice(2, 8);
    this.pendingVerifications.set(payIdId, {
      code: verificationCode,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    
    console.log(`[PayID Registration] New verification code for ${payId.normalizedValue}: ${verificationCode}`);
    
    return { success: true };
  }

  /**
   * Get all PayIDs for a customer.
   */
  getCustomerPayIds(customerId: string): RegisteredPayId[] {
    const payIdIds = this.byCustomer.get(customerId);
    if (!payIdIds) return [];
    
    return Array.from(payIdIds)
      .map(id => this.registrations.get(id)!)
      .filter(p => p.status !== "DEACTIVATED");
  }

  /**
   * Get a specific PayID.
   */
  getPayId(payIdId: string): RegisteredPayId | undefined {
    return this.registrations.get(payIdId);
  }

  /**
   * Update linked account for a PayID.
   */
  updateLinkedAccount(
    payIdId: string,
    accountId: string,
    accountName: string,
    bsb: string,
    accountNumber: string
  ): { success: boolean; error?: string } {
    const payId = this.registrations.get(payIdId);
    if (!payId) {
      return { success: false, error: "PayID not found" };
    }
    
    if (payId.status !== "ACTIVE") {
      return { success: false, error: "PayID is not active" };
    }
    
    payId.accountId = accountId;
    payId.accountName = accountName;
    payId.bsb = bsb;
    payId.accountNumber = accountNumber;
    payId.updatedAt = new Date().toISOString();
    
    return { success: true };
  }

  /**
   * Set a PayID as primary.
   */
  setPrimary(customerId: string, payIdId: string): { success: boolean; error?: string } {
    const payId = this.registrations.get(payIdId);
    if (!payId || payId.customerId !== customerId) {
      return { success: false, error: "PayID not found" };
    }
    
    // Unset other primaries
    const customerPayIds = this.byCustomer.get(customerId);
    if (customerPayIds) {
      for (const id of customerPayIds) {
        const p = this.registrations.get(id);
        if (p) p.isPrimary = false;
      }
    }
    
    payId.isPrimary = true;
    payId.updatedAt = new Date().toISOString();
    
    return { success: true };
  }

  /**
   * Suspend a PayID.
   */
  suspend(payIdId: string, reason: string): { success: boolean; error?: string } {
    const payId = this.registrations.get(payIdId);
    if (!payId) {
      return { success: false, error: "PayID not found" };
    }
    
    payId.status = "SUSPENDED";
    payId.updatedAt = new Date().toISOString();
    
    return { success: true };
  }

  /**
   * Reactivate a suspended PayID.
   */
  reactivate(payIdId: string): { success: boolean; error?: string } {
    const payId = this.registrations.get(payIdId);
    if (!payId) {
      return { success: false, error: "PayID not found" };
    }
    
    if (payId.status !== "SUSPENDED") {
      return { success: false, error: "PayID is not suspended" };
    }
    
    payId.status = "ACTIVE";
    payId.updatedAt = new Date().toISOString();
    
    return { success: true };
  }

  /**
   * Deactivate (delete) a PayID.
   */
  deactivate(payIdId: string): { success: boolean; error?: string } {
    const payId = this.registrations.get(payIdId);
    if (!payId) {
      return { success: false, error: "PayID not found" };
    }
    
    payId.status = "DEACTIVATED";
    payId.deactivatedAt = new Date().toISOString();
    payId.updatedAt = new Date().toISOString();
    
    // Remove from lookup
    this.byNormalizedValue.delete(payId.normalizedValue);
    
    return { success: true };
  }

  /**
   * Check if a PayID value is available.
   */
  isAvailable(type: PayIdType, value: string): boolean {
    const normalized = normalizePayId(type, value);
    if (!normalized) return false;
    return !this.byNormalizedValue.has(normalized);
  }

  /**
   * Get registration statistics.
   */
  getStatistics(): {
    total: number;
    byStatus: Record<PayIdStatus, number>;
    byType: Record<PayIdType, number>;
  } {
    const stats = {
      total: 0,
      byStatus: { PENDING: 0, ACTIVE: 0, SUSPENDED: 0, DEACTIVATED: 0 } as Record<PayIdStatus, number>,
      byType: { EMAIL: 0, PHONE: 0, ABN: 0, ORG_ID: 0 } as Record<PayIdType, number>,
    };
    
    for (const payId of this.registrations.values()) {
      stats.total++;
      stats.byStatus[payId.status]++;
      stats.byType[payId.payIdType]++;
    }
    
    return stats;
  }
}

export const payIdRegistrationService = new PayIdRegistrationService();
export default payIdRegistrationService;
