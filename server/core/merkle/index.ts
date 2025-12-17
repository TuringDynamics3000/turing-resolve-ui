/**
 * Merkle Audit Trail Module
 * 
 * Production-ready Merkle tree implementation for tamper-evident event logs.
 * 
 * Components:
 * - MerkleAuditTrail: Core tree operations and proof generation
 * - MerkleSealerWorker: Background worker for batch sealing
 * - S3Anchoring: External trust boundary via S3 Object Lock
 * - ProofAPI: REST/tRPC endpoints for proof retrieval
 * - SealerBootstrap: Configuration and initialization
 */

// Core Merkle operations
export {
  MerkleBatch,
  EventDigest,
  EventMetadata,
  EventPayload,
  computeEventDigest,
  buildMerkleTree,
  generateInclusionProof,
  verifyInclusionProof,
  verifyBatchSignature,
} from './MerkleAuditTrail';

// Sealer worker
export {
  MerkleSealerWorker,
  SealerConfig,
  SealerDatabase,
  UnsealedEvent,
  SealedBatch,
  MerkleEventIndex,
  createSealerScheduler,
  SealerScheduler,
  computeLeafHash,
  sha256,
} from './MerkleSealerWorker';

// S3 anchoring
export {
  S3AnchorService,
  S3AnchorConfig,
  S3ClientInterface,
  AnchorPayload,
  AnchorResult,
  MockS3Client,
  createS3AnchorService,
} from './S3Anchoring';

// Proof API
export {
  ProofAPIService,
  ProofDatabase,
  InclusionProofResponse,
  BatchMetadataResponse,
  VerifyProofRequest,
  VerifyProofResponse,
  createProofRouterExample,
} from './ProofAPI';

// Bootstrap
export {
  SealerEnvironmentConfig,
  loadConfigFromEnv,
  createPostgresSealerDatabase,
  createSigningKeyProvider,
  bootstrapMerkleSealer,
  startMerkleSealer,
  SealerBootstrapResult,
} from './SealerBootstrap';
