/**
 * Payments Module
 * 
 * Initializes the Payments Spine and registers scheme adapters.
 */

import { schemeAdapterRegistry } from "./SchemeAdapterInterface";
import { nppSchemeAdapter } from "./adapters/NppSchemeAdapter";
import { paymentsSpine } from "./PaymentsSpine";

// ============================================
// REGISTER SCHEME ADAPTERS
// ============================================

// Register NPP adapter
schemeAdapterRegistry.register(nppSchemeAdapter);

// Future adapters:
// schemeAdapterRegistry.register(becsSchemeAdapter);
// schemeAdapterRegistry.register(rtgsSchemeAdapter);
// schemeAdapterRegistry.register(cardsSchemeAdapter);

// ============================================
// EXPORTS
// ============================================

export { paymentsSpine } from "./PaymentsSpine";
export { schemeAdapterRegistry } from "./SchemeAdapterInterface";
export { nppSchemeAdapter } from "./adapters/NppSchemeAdapter";

export type {
  Payment,
  PaymentInstruction,
  PaymentParty,
  PaymentScheme,
  PaymentStatus,
  PaymentType,
  PaymentPriority,
  PaymentEvent,
  PaymentEventType,
} from "./PaymentsSpine";

export type {
  SchemeAdapter,
  SchemeSubmissionResult,
  SchemeCallbackResult,
  SchemeHealthCheck,
} from "./SchemeAdapterInterface";

// Log registration
console.log(`[Payments] Registered adapters: ${schemeAdapterRegistry.getRegisteredSchemes().join(", ")}`);
