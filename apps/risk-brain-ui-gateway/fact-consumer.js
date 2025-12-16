/**
 * Fact Consumer - Consumes facts from TuringCore-v3 via SSE
 * 
 * CRITICAL BOUNDARIES:
 * - Read-only consumption (no writes back to TuringCore-v3)
 * - Facts stored in local projection for Member Portal display
 * - No state computation (facts are truth)
 * - Reconnection with Last-Event-ID for reliability
 */

import EventSource from "eventsource";

class FactConsumer {
  constructor(turingCoreUrl) {
    this.turingCoreUrl = turingCoreUrl;
    this.eventSource = null;
    this.lastEventId = 0;
    this.reconnectDelay = 1000; // Start with 1s
    this.maxReconnectDelay = 30000; // Max 30s
    this.isConnected = false;
    
    // In-memory fact storage (for demo - replace with DB in production)
    this.paymentFacts = [];
    this.depositFacts = [];
    this.safeguardChanges = [];
  }

  /**
   * Start consuming facts from TuringCore-v3
   */
  start() {
    console.log(`[FactConsumer] Connecting to ${this.turingCoreUrl}/api/facts/stream`);
    
    const headers = {};
    if (this.lastEventId > 0) {
      headers["Last-Event-ID"] = this.lastEventId.toString();
    }

    this.eventSource = new EventSource(`${this.turingCoreUrl}/api/facts/stream`, { headers });

    this.eventSource.addEventListener("connected", (event) => {
      const data = JSON.parse(event.data);
      console.log(`[FactConsumer] Connected to TuringCore-v3 (lastEventId: ${data.lastEventId})`);
      this.isConnected = true;
      this.reconnectDelay = 1000; // Reset reconnect delay on successful connection
    });

    this.eventSource.addEventListener("payment_fact", (event) => {
      const fact = JSON.parse(event.data);
      this.lastEventId = parseInt(event.lastEventId, 10);
      console.log(`[FactConsumer] Received payment_fact: ${fact.factType} for ${fact.paymentId}`);
      this.paymentFacts.push(fact);
    });

    this.eventSource.addEventListener("deposit_fact", (event) => {
      const fact = JSON.parse(event.data);
      this.lastEventId = parseInt(event.lastEventId, 10);
      console.log(`[FactConsumer] Received deposit_fact: ${fact.factType} for ${fact.accountId}`);
      this.depositFacts.push(fact);
    });

    this.eventSource.addEventListener("safeguard_change", (event) => {
      const change = JSON.parse(event.data);
      this.lastEventId = parseInt(event.lastEventId, 10);
      console.log(`[FactConsumer] Received safeguard_change: ${change.safeguardType} ${change.newState}`);
      this.safeguardChanges.push(change);
    });

    this.eventSource.onerror = (error) => {
      console.error(`[FactConsumer] Connection error:`, error);
      this.isConnected = false;
      this.eventSource.close();
      
      // Exponential backoff reconnection
      console.log(`[FactConsumer] Reconnecting in ${this.reconnectDelay}ms...`);
      setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        this.start();
      }, this.reconnectDelay);
    };
  }

  /**
   * Stop consuming facts
   */
  stop() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      console.log("[FactConsumer] Stopped");
    }
  }

  /**
   * Get payment facts (for Member Portal)
   */
  getPaymentFacts(paymentId) {
    if (paymentId) {
      return this.paymentFacts.filter(f => f.paymentId === paymentId);
    }
    return this.paymentFacts;
  }

  /**
   * Get deposit facts (for Member Portal)
   */
  getDepositFacts(accountId) {
    if (accountId) {
      return this.depositFacts.filter(f => f.accountId === accountId);
    }
    return this.depositFacts;
  }

  /**
   * Get safeguard changes (for Risk Brain Reporter)
   */
  getSafeguardChanges() {
    return this.safeguardChanges;
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      lastEventId: this.lastEventId,
      paymentFactCount: this.paymentFacts.length,
      depositFactCount: this.depositFacts.length,
      safeguardChangeCount: this.safeguardChanges.length,
    };
  }
}

export { FactConsumer };
