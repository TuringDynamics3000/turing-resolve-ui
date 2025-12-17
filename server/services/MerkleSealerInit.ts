/**
 * Merkle Sealer Initialization
 * 
 * Initializes the Merkle sealing worker on server startup.
 * This module should be imported and called from the main server entry point.
 */

import { getGovernedEventService } from './GovernedEventService';

// ============================================================
// CONFIGURATION
// ============================================================

interface SealerConfig {
  enabled: boolean;
  intervalMs: number;
  minBatchSize: number;
  maxBatchSize: number;
  tenantId: string;
  environmentId: string;
}

function loadConfig(): SealerConfig {
  return {
    enabled: process.env.MERKLE_SEALER_ENABLED !== 'false',
    intervalMs: parseInt(process.env.MERKLE_SEAL_INTERVAL_MS || '60000', 10),
    minBatchSize: parseInt(process.env.MERKLE_MIN_BATCH_SIZE || '10', 10),
    maxBatchSize: parseInt(process.env.MERKLE_MAX_BATCH_SIZE || '10000', 10),
    tenantId: process.env.TENANT_ID || 'default',
    environmentId: process.env.ENVIRONMENT_ID || 'development',
  };
}

// ============================================================
// SEALER STATE
// ============================================================

let sealerInterval: NodeJS.Timeout | null = null;
let isSealing = false;
let sealCount = 0;
let lastSealTime: Date | null = null;

// ============================================================
// SEALING LOGIC
// ============================================================

async function sealBatch(config: SealerConfig): Promise<void> {
  if (isSealing) {
    console.log('[MerkleSealer] Skipping - previous seal still in progress');
    return;
  }
  
  isSealing = true;
  
  try {
    const service = getGovernedEventService();
    const events = await service.getUnsealedEvents(config.maxBatchSize);
    
    if (events.length < config.minBatchSize) {
      // Not enough events to seal
      return;
    }
    
    console.log(`[MerkleSealer] Sealing batch of ${events.length} events...`);
    
    // In production, this would:
    // 1. Build Merkle tree from events
    // 2. Sign root with KMS
    // 3. Write batch record to DB
    // 4. Index events in merkle_event_index
    // 5. Anchor root to S3 Object Lock
    
    // For now, just log the seal
    const batchId = `batch_${Date.now()}`;
    const leafHashes = events.map(e => e.leafHash);
    
    // Compute mock root (in production, use proper Merkle tree)
    const { createHash } = await import('crypto');
    const rootHash = createHash('sha256')
      .update(leafHashes.join(''))
      .digest('hex');
    
    sealCount++;
    lastSealTime = new Date();
    
    console.log(`[MerkleSealer] Batch ${batchId} sealed:`, {
      eventCount: events.length,
      rootHash: rootHash.slice(0, 16) + '...',
      sealCount,
      lastSealTime: lastSealTime.toISOString(),
    });
    
  } catch (error) {
    console.error('[MerkleSealer] Seal failed:', error);
  } finally {
    isSealing = false;
  }
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Initialize and start the Merkle sealer.
 * Call this from server startup.
 */
export function initializeMerkleSealer(): void {
  const config = loadConfig();
  
  if (!config.enabled) {
    console.log('[MerkleSealer] Disabled by configuration');
    return;
  }
  
  console.log('[MerkleSealer] Initializing...', {
    intervalMs: config.intervalMs,
    minBatchSize: config.minBatchSize,
    maxBatchSize: config.maxBatchSize,
    tenantId: config.tenantId,
    environmentId: config.environmentId,
  });
  
  // Start periodic sealing
  sealerInterval = setInterval(() => {
    sealBatch(config).catch(console.error);
  }, config.intervalMs);
  
  // Run initial seal after short delay
  setTimeout(() => {
    sealBatch(config).catch(console.error);
  }, 5000);
  
  console.log(`[MerkleSealer] Started with ${config.intervalMs}ms interval`);
}

/**
 * Stop the Merkle sealer.
 * Call this on server shutdown.
 */
export function stopMerkleSealer(): void {
  if (sealerInterval) {
    clearInterval(sealerInterval);
    sealerInterval = null;
    console.log('[MerkleSealer] Stopped');
  }
}

/**
 * Get sealer status.
 */
export function getSealerStatus(): {
  enabled: boolean;
  running: boolean;
  isSealing: boolean;
  sealCount: number;
  lastSealTime: Date | null;
} {
  return {
    enabled: sealerInterval !== null,
    running: sealerInterval !== null,
    isSealing,
    sealCount,
    lastSealTime,
  };
}

/**
 * Force an immediate seal (for testing/debugging).
 */
export async function forceSeal(): Promise<void> {
  const config = loadConfig();
  await sealBatch(config);
}
