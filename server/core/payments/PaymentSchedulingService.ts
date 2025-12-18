/**
 * Payment Scheduling Service
 * 
 * Enables future-dated and recurring payment scheduling.
 */

import { nanoid } from "nanoid";

// ============================================
// TYPES
// ============================================

export type ScheduleType = "ONE_TIME" | "RECURRING";
export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | "QUARTERLY" | "ANNUALLY";
export type ScheduleStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED" | "FAILED";

export interface ScheduledPayment {
  scheduleId: string;
  customerId: string;
  
  // Schedule type
  scheduleType: ScheduleType;
  
  // Payment details
  scheme: "NPP" | "BECS" | "INTERNAL";
  amount: number;
  currency: string;
  
  // Debtor
  debtorAccountId: string;
  debtorName: string;
  debtorBsb: string;
  debtorAccountNumber: string;
  
  // Creditor
  creditorName: string;
  creditorBsb: string;
  creditorAccountNumber: string;
  creditorPayId?: string;
  
  // Reference
  reference: string;
  description?: string;
  
  // Scheduling
  startDate: string; // YYYY-MM-DD
  endDate?: string; // For recurring
  nextExecutionDate: string;
  
  // Recurrence (for RECURRING type)
  frequency?: RecurrenceFrequency;
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  
  // Execution tracking
  executionCount: number;
  maxExecutions?: number;
  lastExecutedAt?: string;
  lastExecutionStatus?: "SUCCESS" | "FAILED";
  lastPaymentId?: string;
  
  // Status
  status: ScheduleStatus;
  failureCount: number;
  maxFailures: number;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface SchedulePaymentRequest {
  customerId: string;
  scheduleType: ScheduleType;
  scheme: "NPP" | "BECS" | "INTERNAL";
  amount: number;
  
  debtorAccountId: string;
  debtorName: string;
  debtorBsb: string;
  debtorAccountNumber: string;
  
  creditorName: string;
  creditorBsb: string;
  creditorAccountNumber: string;
  creditorPayId?: string;
  
  reference: string;
  description?: string;
  
  startDate: string;
  endDate?: string;
  
  frequency?: RecurrenceFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  maxExecutions?: number;
}

export interface ScheduleResult {
  success: boolean;
  schedule?: ScheduledPayment;
  error?: string;
}

export interface ExecutionResult {
  success: boolean;
  paymentId?: string;
  error?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateNextExecutionDate(
  currentDate: string,
  frequency: RecurrenceFrequency,
  dayOfWeek?: number,
  dayOfMonth?: number
): string {
  const date = new Date(currentDate);
  
  switch (frequency) {
    case "DAILY":
      date.setDate(date.getDate() + 1);
      break;
      
    case "WEEKLY":
      date.setDate(date.getDate() + 7);
      if (dayOfWeek !== undefined) {
        const currentDay = date.getDay();
        const diff = dayOfWeek - currentDay;
        date.setDate(date.getDate() + (diff <= 0 ? diff + 7 : diff));
      }
      break;
      
    case "FORTNIGHTLY":
      date.setDate(date.getDate() + 14);
      break;
      
    case "MONTHLY":
      date.setMonth(date.getMonth() + 1);
      if (dayOfMonth !== undefined) {
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        date.setDate(Math.min(dayOfMonth, lastDay));
      }
      break;
      
    case "QUARTERLY":
      date.setMonth(date.getMonth() + 3);
      if (dayOfMonth !== undefined) {
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        date.setDate(Math.min(dayOfMonth, lastDay));
      }
      break;
      
    case "ANNUALLY":
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  
  return date.toISOString().split("T")[0];
}

// ============================================
// PAYMENT SCHEDULING SERVICE
// ============================================

class PaymentSchedulingService {
  private schedules: Map<string, ScheduledPayment> = new Map();
  private byCustomer: Map<string, Set<string>> = new Map();
  private executionHistory: Map<string, { date: string; status: string; paymentId?: string }[]> = new Map();

  /**
   * Create a new scheduled payment.
   */
  async createSchedule(request: SchedulePaymentRequest): Promise<ScheduleResult> {
    // Validate start date
    const startDate = new Date(request.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (startDate < today) {
      return { success: false, error: "Start date cannot be in the past" };
    }
    
    // Validate recurring schedule
    if (request.scheduleType === "RECURRING") {
      if (!request.frequency) {
        return { success: false, error: "Frequency is required for recurring payments" };
      }
      
      if (request.endDate && new Date(request.endDate) <= startDate) {
        return { success: false, error: "End date must be after start date" };
      }
    }
    
    // Create schedule
    const schedule: ScheduledPayment = {
      scheduleId: nanoid(),
      customerId: request.customerId,
      scheduleType: request.scheduleType,
      scheme: request.scheme,
      amount: request.amount,
      currency: "AUD",
      
      debtorAccountId: request.debtorAccountId,
      debtorName: request.debtorName,
      debtorBsb: request.debtorBsb,
      debtorAccountNumber: request.debtorAccountNumber,
      
      creditorName: request.creditorName,
      creditorBsb: request.creditorBsb,
      creditorAccountNumber: request.creditorAccountNumber,
      creditorPayId: request.creditorPayId,
      
      reference: request.reference,
      description: request.description,
      
      startDate: request.startDate,
      endDate: request.endDate,
      nextExecutionDate: request.startDate,
      
      frequency: request.frequency,
      dayOfWeek: request.dayOfWeek,
      dayOfMonth: request.dayOfMonth,
      
      executionCount: 0,
      maxExecutions: request.maxExecutions,
      
      status: "ACTIVE",
      failureCount: 0,
      maxFailures: 3,
      
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Store schedule
    this.schedules.set(schedule.scheduleId, schedule);
    
    if (!this.byCustomer.has(request.customerId)) {
      this.byCustomer.set(request.customerId, new Set());
    }
    this.byCustomer.get(request.customerId)!.add(schedule.scheduleId);
    
    this.executionHistory.set(schedule.scheduleId, []);
    
    return { success: true, schedule };
  }

  /**
   * Execute a scheduled payment.
   */
  async executeSchedule(scheduleId: string): Promise<ExecutionResult> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return { success: false, error: "Schedule not found" };
    }
    
    if (schedule.status !== "ACTIVE") {
      return { success: false, error: "Schedule is not active" };
    }
    
    // Simulate payment execution
    const paymentId = `PAY-SCHED-${nanoid(8)}`;
    const success = Math.random() > 0.1; // 90% success rate for simulation
    
    // Update schedule
    schedule.executionCount++;
    schedule.lastExecutedAt = new Date().toISOString();
    schedule.lastExecutionStatus = success ? "SUCCESS" : "FAILED";
    schedule.lastPaymentId = success ? paymentId : undefined;
    schedule.updatedAt = new Date().toISOString();
    
    // Record execution
    this.executionHistory.get(scheduleId)!.push({
      date: new Date().toISOString(),
      status: success ? "SUCCESS" : "FAILED",
      paymentId: success ? paymentId : undefined,
    });
    
    if (!success) {
      schedule.failureCount++;
      if (schedule.failureCount >= schedule.maxFailures) {
        schedule.status = "FAILED";
      }
    } else {
      schedule.failureCount = 0;
    }
    
    // Calculate next execution for recurring
    if (schedule.scheduleType === "RECURRING" && success) {
      if (schedule.maxExecutions && schedule.executionCount >= schedule.maxExecutions) {
        schedule.status = "COMPLETED";
      } else if (schedule.endDate && schedule.nextExecutionDate >= schedule.endDate) {
        schedule.status = "COMPLETED";
      } else {
        schedule.nextExecutionDate = calculateNextExecutionDate(
          schedule.nextExecutionDate,
          schedule.frequency!,
          schedule.dayOfWeek,
          schedule.dayOfMonth
        );
      }
    } else if (schedule.scheduleType === "ONE_TIME" && success) {
      schedule.status = "COMPLETED";
    }
    
    return {
      success,
      paymentId: success ? paymentId : undefined,
      error: success ? undefined : "Payment execution failed",
    };
  }

  /**
   * Get schedules due for execution.
   */
  getDueSchedules(): ScheduledPayment[] {
    const today = new Date().toISOString().split("T")[0];
    
    return Array.from(this.schedules.values()).filter(
      s => s.status === "ACTIVE" && s.nextExecutionDate <= today
    );
  }

  /**
   * Get all schedules for a customer.
   */
  getCustomerSchedules(customerId: string): ScheduledPayment[] {
    const scheduleIds = this.byCustomer.get(customerId);
    if (!scheduleIds) return [];
    
    return Array.from(scheduleIds)
      .map(id => this.schedules.get(id)!)
      .filter(s => s.status !== "CANCELLED");
  }

  /**
   * Get a specific schedule.
   */
  getSchedule(scheduleId: string): ScheduledPayment | undefined {
    return this.schedules.get(scheduleId);
  }

  /**
   * Get execution history for a schedule.
   */
  getExecutionHistory(scheduleId: string): { date: string; status: string; paymentId?: string }[] {
    return this.executionHistory.get(scheduleId) || [];
  }

  /**
   * Pause a schedule.
   */
  pause(scheduleId: string): { success: boolean; error?: string } {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return { success: false, error: "Schedule not found" };
    }
    
    if (schedule.status !== "ACTIVE") {
      return { success: false, error: "Schedule is not active" };
    }
    
    schedule.status = "PAUSED";
    schedule.updatedAt = new Date().toISOString();
    
    return { success: true };
  }

  /**
   * Resume a paused schedule.
   */
  resume(scheduleId: string): { success: boolean; error?: string } {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return { success: false, error: "Schedule not found" };
    }
    
    if (schedule.status !== "PAUSED") {
      return { success: false, error: "Schedule is not paused" };
    }
    
    schedule.status = "ACTIVE";
    schedule.updatedAt = new Date().toISOString();
    
    return { success: true };
  }

  /**
   * Cancel a schedule.
   */
  cancel(scheduleId: string): { success: boolean; error?: string } {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return { success: false, error: "Schedule not found" };
    }
    
    schedule.status = "CANCELLED";
    schedule.updatedAt = new Date().toISOString();
    
    return { success: true };
  }

  /**
   * Update schedule amount.
   */
  updateAmount(scheduleId: string, amount: number): { success: boolean; error?: string } {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return { success: false, error: "Schedule not found" };
    }
    
    if (amount <= 0) {
      return { success: false, error: "Amount must be positive" };
    }
    
    schedule.amount = amount;
    schedule.updatedAt = new Date().toISOString();
    
    return { success: true };
  }

  /**
   * Get scheduling statistics.
   */
  getStatistics(): {
    total: number;
    byStatus: Record<ScheduleStatus, number>;
    byType: Record<ScheduleType, number>;
    byFrequency: Record<RecurrenceFrequency, number>;
    totalScheduledAmount: number;
  } {
    const stats = {
      total: 0,
      byStatus: { ACTIVE: 0, PAUSED: 0, COMPLETED: 0, CANCELLED: 0, FAILED: 0 } as Record<ScheduleStatus, number>,
      byType: { ONE_TIME: 0, RECURRING: 0 } as Record<ScheduleType, number>,
      byFrequency: { DAILY: 0, WEEKLY: 0, FORTNIGHTLY: 0, MONTHLY: 0, QUARTERLY: 0, ANNUALLY: 0 } as Record<RecurrenceFrequency, number>,
      totalScheduledAmount: 0,
    };
    
    for (const schedule of this.schedules.values()) {
      stats.total++;
      stats.byStatus[schedule.status]++;
      stats.byType[schedule.scheduleType]++;
      
      if (schedule.frequency) {
        stats.byFrequency[schedule.frequency]++;
      }
      
      if (schedule.status === "ACTIVE") {
        stats.totalScheduledAmount += schedule.amount;
      }
    }
    
    return stats;
  }
}

export const paymentSchedulingService = new PaymentSchedulingService();
export default paymentSchedulingService;
