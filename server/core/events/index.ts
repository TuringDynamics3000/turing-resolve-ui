/**
 * Event Store Module
 * 
 * Exports all event-related utilities for the TuringCore event store.
 */

export {
  // Canonical JSON
  canonicalJson,
  
  // Hash functions
  sha256,
  sha256Hex,
  
  // Event hashing
  computeEventHashes,
  prepareEventForInsert,
  verifyEventHashes,
  
  // Batch operations
  computeBatchLeafHashes,
  verifyBatchHashes,
  
  // Types
  type EventMetadata,
  type EventHashResult,
  type HashedEvent,
} from './EventHasher';
