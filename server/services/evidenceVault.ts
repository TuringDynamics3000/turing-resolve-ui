/**
 * Evidence Vault Service
 * 
 * Manages audit packs for decisions - complete evidence packages that can be
 * downloaded and independently verified by members and regulators.
 */

import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface EvidenceItem {
  id: string;
  type: 'REQUEST' | 'POLICY_SNAPSHOT' | 'DECISION_RECORD' | 'OPERATOR_ACTION' | 'NOTARISATION' | 'SIGNATURE';
  name: string;
  description: string;
  hash: string;
  timestamp: Date;
  data: Record<string, unknown>;
  size: number; // bytes
}

export interface EvidencePack {
  id: string;
  decisionId: string;
  createdAt: Date;
  expiresAt: Date | null;
  status: 'COMPLETE' | 'PARTIAL' | 'SEALED';
  items: EvidenceItem[];
  merkleRoot: string;
  totalSize: number;
  downloadCount: number;
  lastDownloadedAt: Date | null;
}

export interface EvidenceDownload {
  packId: string;
  format: 'JSON' | 'PDF' | 'ZIP';
  url: string;
  expiresAt: Date;
}

// ============================================================================
// Mock Data
// ============================================================================

function generateEvidencePack(decisionId: string, type: string): EvidencePack {
  const now = new Date();
  const items: EvidenceItem[] = [
    {
      id: `EVI-${decisionId}-REQ`,
      type: 'REQUEST',
      name: 'Original Request',
      description: 'The original limit increase request submitted by the member',
      hash: crypto.randomBytes(32).toString('hex'),
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      data: {
        requestType: 'LIMIT_INCREASE',
        limitId: 'LIM-001',
        currentValue: 5000,
        requestedValue: 10000,
        justification: 'Need to pay for car repairs',
        memberId: 'MEM-001',
        channel: 'MOBILE_APP',
      },
      size: 1247,
    },
    {
      id: `EVI-${decisionId}-POL`,
      type: 'POLICY_SNAPSHOT',
      name: 'Policy Snapshot',
      description: 'The exact policy version evaluated at decision time',
      hash: crypto.randomBytes(32).toString('hex'),
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000 + 100),
      data: {
        policyId: 'POL-LIMIT-001',
        version: 'v2.1.0',
        effectiveFrom: '2024-01-01T00:00:00Z',
        rules: [
          { name: 'max_increase_ratio', value: 3.0 },
          { name: 'min_account_age_days', value: 90 },
          { name: 'min_good_standing_months', value: 6 },
        ],
      },
      size: 3842,
    },
    {
      id: `EVI-${decisionId}-DEC`,
      type: 'DECISION_RECORD',
      name: 'Decision Record',
      description: 'The immutable decision record with hash chain link',
      hash: crypto.randomBytes(32).toString('hex'),
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000 + 200),
      data: {
        decisionId,
        outcome: type === 'PENDING' ? 'REVIEW' : type,
        sequenceNumber: 4847,
        previousHash: '9e2d4f8a1b3c5d7e9f0a2b4c6d8e0f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e',
        evaluationMs: 45,
        riskScore: 23,
      },
      size: 2156,
    },
  ];

  // Add operator action if not pending
  if (type !== 'PENDING') {
    items.push({
      id: `EVI-${decisionId}-OPR`,
      type: 'OPERATOR_ACTION',
      name: 'Operator Action',
      description: 'The human review and decision action',
      hash: crypto.randomBytes(32).toString('hex'),
      timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      data: {
        operatorId: 'OPS-ANALYST-001',
        action: type === 'APPROVED' ? 'APPROVE' : 'DECLINE',
        reason: type === 'APPROVED' ? 'Request within policy guidelines' : 'Additional verification required',
        reviewDurationMs: 45000,
      },
      size: 892,
    });
  }

  // Add notarisation record
  items.push({
    id: `EVI-${decisionId}-NOT`,
    type: 'NOTARISATION',
    name: 'Blockchain Notarisation',
    description: 'RedBelly blockchain anchor for regulatory-grade immutability',
    hash: crypto.randomBytes(32).toString('hex'),
    timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000 + 500),
    data: {
      network: 'redbelly-testnet',
      txId: '0x' + crypto.randomBytes(32).toString('hex'),
      blockNumber: 1847293,
      confirmations: 156,
    },
    size: 1024,
  });

  // Add signature
  items.push({
    id: `EVI-${decisionId}-SIG`,
    type: 'SIGNATURE',
    name: 'Pack Signature',
    description: 'Cryptographic signature sealing the evidence pack',
    hash: crypto.randomBytes(32).toString('hex'),
    timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000 + 600),
    data: {
      algorithm: 'ECDSA-P256',
      signerId: 'MERKLE-SEALER-001',
      signature: crypto.randomBytes(64).toString('base64'),
    },
    size: 512,
  });

  const totalSize = items.reduce((sum, item) => sum + item.size, 0);
  const merkleRoot = crypto.randomBytes(32).toString('hex');

  return {
    id: `EVP-${decisionId}`,
    decisionId,
    createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    expiresAt: null, // Never expires
    status: type === 'PENDING' ? 'PARTIAL' : 'SEALED',
    items,
    merkleRoot,
    totalSize,
    downloadCount: Math.floor(Math.random() * 5),
    lastDownloadedAt: Math.random() > 0.5 ? new Date(now.getTime() - 24 * 60 * 60 * 1000) : null,
  };
}

// Pre-generate evidence packs
const evidencePacks: Map<string, EvidencePack> = new Map([
  ['DEC-004847', generateEvidencePack('DEC-004847', 'PENDING')],
  ['DEC-004823', generateEvidencePack('DEC-004823', 'APPROVED')],
  ['DEC-004801', generateEvidencePack('DEC-004801', 'DECLINED')],
]);

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Get evidence pack for a decision
 */
export function getEvidencePack(decisionId: string): EvidencePack | null {
  return evidencePacks.get(decisionId) || null;
}

/**
 * Get evidence pack by pack ID
 */
export function getEvidencePackById(packId: string): EvidencePack | null {
  for (const pack of evidencePacks.values()) {
    if (pack.id === packId) {
      return pack;
    }
  }
  return null;
}

/**
 * Get specific evidence item
 */
export function getEvidenceItem(packId: string, itemId: string): EvidenceItem | null {
  const pack = getEvidencePackById(packId);
  if (!pack) return null;
  return pack.items.find(item => item.id === itemId) || null;
}

/**
 * Generate download URL for evidence pack
 */
export function generateDownloadUrl(packId: string, format: 'JSON' | 'PDF' | 'ZIP' = 'JSON'): EvidenceDownload | null {
  const pack = getEvidencePackById(packId);
  if (!pack) return null;

  // Increment download count
  pack.downloadCount++;
  pack.lastDownloadedAt = new Date();

  return {
    packId,
    format,
    url: `/api/evidence/${packId}/download?format=${format.toLowerCase()}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
  };
}

/**
 * Verify evidence pack integrity
 */
export function verifyEvidencePack(packId: string): {
  valid: boolean;
  errors: string[];
  itemsVerified: number;
} {
  const pack = getEvidencePackById(packId);
  if (!pack) {
    return { valid: false, errors: ['Pack not found'], itemsVerified: 0 };
  }

  const errors: string[] = [];
  let itemsVerified = 0;

  // Verify each item hash (mock verification)
  for (const item of pack.items) {
    // In production, would recompute hash from item.data
    if (item.hash && item.hash.length === 64) {
      itemsVerified++;
    } else {
      errors.push(`Invalid hash for item ${item.id}`);
    }
  }

  // Verify merkle root (mock verification)
  if (!pack.merkleRoot || pack.merkleRoot.length !== 64) {
    errors.push('Invalid merkle root');
  }

  return {
    valid: errors.length === 0,
    errors,
    itemsVerified,
  };
}

/**
 * Get all evidence packs for a member
 */
export function getMemberEvidencePacks(memberId: string): EvidencePack[] {
  // In production, would filter by member ID
  return Array.from(evidencePacks.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Create evidence pack for a new decision
 */
export function createEvidencePack(decisionId: string, initialItems: Partial<EvidenceItem>[]): EvidencePack {
  const pack = generateEvidencePack(decisionId, 'PENDING');
  evidencePacks.set(decisionId, pack);
  return pack;
}
