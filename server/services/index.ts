/**
 * Services Index
 * 
 * Central export point for all service modules.
 */

export {
  GovernedEventService,
  getGovernedEventService,
  writePaymentEvent,
  writeDepositEvent,
  writeLoanEvent,
  computePayloadHash,
  computeMetaHash,
  computeEventDigest,
  computeLeafHash,
  canonicalJson,
  type EventInput,
  type GovernedEvent,
  type EventWriteResult,
} from './GovernedEventService';

export {
  initializeMerkleSealer,
  stopMerkleSealer,
  getSealerStatus,
  forceSeal,
} from './MerkleSealerInit';

export {
  EvidencePackGenerator,
  getEvidencePackGenerator,
  generateEvidencePack,
  verifyEvidencePack,
  type EvidencePack,
  type EvidencePackRequest,
  type PolicyInfo,
  type ModelInfo,
  type DecisionTrace,
  type EventProof,
} from './EvidencePackAPI';
