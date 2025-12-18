/**
 * Tests for Advanced Governance Features
 * - RedBelly Blockchain Notarisation
 * - Evidence Vault Service
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as redbellyService from '../services/redbellyNotarisation';
import * as evidenceService from '../services/evidenceVault';

describe('RedBelly Notarisation Service', () => {
  describe('getNotarisationByDecisionId', () => {
    it('should return notarisation record for known decision', () => {
      const result = redbellyService.getNotarisationByDecisionId('DEC-004847');
      
      expect(result).not.toBeNull();
      expect(result?.decisionId).toBe('DEC-004847');
      expect(result?.status).toBe('CONFIRMED');
      expect(result?.networkId).toBe('testnet');
      expect(result?.redbellyTxId).toMatch(/^0x[a-f0-9]+$/);
      expect(result?.blockNumber).toBeGreaterThan(0);
      expect(result?.confirmations).toBeGreaterThan(0);
    });

    it('should return null for unknown decision', () => {
      const result = redbellyService.getNotarisationByDecisionId('DEC-UNKNOWN');
      expect(result).toBeNull();
    });
  });

  describe('notariseDecision', () => {
    it('should create notarisation record for new decision', async () => {
      const result = await redbellyService.notariseDecision({
        decisionId: 'DEC-TEST-001',
        decisionHash: 'abc123def456',
      });

      expect(result.success).toBe(true);
      expect(result.txId).toMatch(/^0x[a-f0-9]+$/);
      expect(result.blockNumber).toBeGreaterThan(0);
    });

    it('should store notarisation record after creation', async () => {
      const decisionId = 'DEC-TEST-002';
      await redbellyService.notariseDecision({
        decisionId,
        decisionHash: 'xyz789abc123',
      });

      const stored = redbellyService.getNotarisationByDecisionId(decisionId);
      expect(stored).not.toBeNull();
      expect(stored?.decisionId).toBe(decisionId);
      expect(stored?.status).toBe('PENDING'); // Initially pending
    });
  });

  describe('verifyNotarisation', () => {
    it('should verify matching hash', async () => {
      const result = await redbellyService.verifyNotarisation(
        'DEC-004847',
        '7f3a8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a'
      );

      expect(result.verified).toBe(true);
      expect(result.record).not.toBeNull();
    });

    it('should fail verification for mismatched hash', async () => {
      const result = await redbellyService.verifyNotarisation(
        'DEC-004847',
        'wrong_hash_value'
      );

      expect(result.verified).toBe(false);
      expect(result.error).toContain('mismatch');
    });

    it('should fail verification for unknown decision', async () => {
      const result = await redbellyService.verifyNotarisation(
        'DEC-UNKNOWN',
        'any_hash'
      );

      expect(result.verified).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getNetworkStatus', () => {
    it('should return network status', () => {
      const status = redbellyService.getNetworkStatus();

      expect(status.network).toBe('testnet');
      expect(status.status).toBe('ONLINE');
      expect(status.latestBlock).toBeGreaterThan(0);
      expect(status.avgBlockTime).toBeGreaterThan(0);
    });
  });

  describe('getAllNotarisations', () => {
    it('should return array of notarisation records', () => {
      const records = redbellyService.getAllNotarisations();

      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBeGreaterThan(0);
      
      // Should be sorted by timestamp descending
      for (let i = 1; i < records.length; i++) {
        expect(records[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
          records[i].timestamp.getTime()
        );
      }
    });
  });
});

describe('Evidence Vault Service', () => {
  describe('getEvidencePack', () => {
    it('should return evidence pack for known decision', () => {
      const pack = evidenceService.getEvidencePack('DEC-004847');

      expect(pack).not.toBeNull();
      expect(pack?.decisionId).toBe('DEC-004847');
      expect(pack?.items.length).toBeGreaterThan(0);
      expect(pack?.merkleRoot).toMatch(/^[a-f0-9]+$/);
      expect(pack?.totalSize).toBeGreaterThan(0);
    });

    it('should return null for unknown decision', () => {
      const pack = evidenceService.getEvidencePack('DEC-UNKNOWN');
      expect(pack).toBeNull();
    });

    it('should have correct evidence item types', () => {
      const pack = evidenceService.getEvidencePack('DEC-004823');

      expect(pack).not.toBeNull();
      
      const itemTypes = pack!.items.map(i => i.type);
      expect(itemTypes).toContain('REQUEST');
      expect(itemTypes).toContain('POLICY_SNAPSHOT');
      expect(itemTypes).toContain('DECISION_RECORD');
      expect(itemTypes).toContain('NOTARISATION');
    });
  });

  describe('getEvidencePackById', () => {
    it('should return pack by pack ID', () => {
      const pack = evidenceService.getEvidencePackById('EVP-DEC-004847');

      expect(pack).not.toBeNull();
      expect(pack?.id).toBe('EVP-DEC-004847');
    });

    it('should return null for unknown pack ID', () => {
      const pack = evidenceService.getEvidencePackById('EVP-UNKNOWN');
      expect(pack).toBeNull();
    });
  });

  describe('getEvidenceItem', () => {
    it('should return specific evidence item', () => {
      const pack = evidenceService.getEvidencePack('DEC-004847');
      const firstItem = pack?.items[0];
      
      if (firstItem) {
        const item = evidenceService.getEvidenceItem(pack!.id, firstItem.id);
        expect(item).not.toBeNull();
        expect(item?.id).toBe(firstItem.id);
      }
    });

    it('should return null for unknown item', () => {
      const item = evidenceService.getEvidenceItem('EVP-DEC-004847', 'UNKNOWN-ITEM');
      expect(item).toBeNull();
    });
  });

  describe('generateDownloadUrl', () => {
    it('should generate download URL for JSON format', () => {
      const download = evidenceService.generateDownloadUrl('EVP-DEC-004847', 'JSON');

      expect(download).not.toBeNull();
      expect(download?.format).toBe('JSON');
      expect(download?.url).toContain('/api/evidence/');
      expect(download?.url).toContain('format=json');
      expect(download?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should generate download URL for PDF format', () => {
      const download = evidenceService.generateDownloadUrl('EVP-DEC-004847', 'PDF');

      expect(download).not.toBeNull();
      expect(download?.format).toBe('PDF');
      expect(download?.url).toContain('format=pdf');
    });

    it('should increment download count', () => {
      const packBefore = evidenceService.getEvidencePackById('EVP-DEC-004823');
      const countBefore = packBefore?.downloadCount || 0;

      evidenceService.generateDownloadUrl('EVP-DEC-004823', 'ZIP');

      const packAfter = evidenceService.getEvidencePackById('EVP-DEC-004823');
      expect(packAfter?.downloadCount).toBe(countBefore + 1);
    });

    it('should return null for unknown pack', () => {
      const download = evidenceService.generateDownloadUrl('EVP-UNKNOWN', 'JSON');
      expect(download).toBeNull();
    });
  });

  describe('verifyEvidencePack', () => {
    it('should verify valid evidence pack', () => {
      const result = evidenceService.verifyEvidencePack('EVP-DEC-004847');

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.itemsVerified).toBeGreaterThan(0);
    });

    it('should fail verification for unknown pack', () => {
      const result = evidenceService.verifyEvidencePack('EVP-UNKNOWN');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Pack not found');
    });
  });

  describe('getMemberEvidencePacks', () => {
    it('should return array of evidence packs', () => {
      const packs = evidenceService.getMemberEvidencePacks('MEM-001');

      expect(Array.isArray(packs)).toBe(true);
      expect(packs.length).toBeGreaterThan(0);
      
      // Should be sorted by createdAt descending
      for (let i = 1; i < packs.length; i++) {
        expect(packs[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
          packs[i].createdAt.getTime()
        );
      }
    });
  });

  describe('Evidence Pack Structure', () => {
    it('should have valid merkle root format', () => {
      const pack = evidenceService.getEvidencePack('DEC-004847');
      
      expect(pack?.merkleRoot).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should have valid item hashes', () => {
      const pack = evidenceService.getEvidencePack('DEC-004847');
      
      pack?.items.forEach(item => {
        expect(item.hash).toMatch(/^[a-f0-9]+$/);
        expect(item.hash.length).toBeGreaterThanOrEqual(8);
      });
    });

    it('should calculate total size correctly', () => {
      const pack = evidenceService.getEvidencePack('DEC-004847');
      
      const calculatedSize = pack?.items.reduce((sum, item) => sum + item.size, 0);
      expect(pack?.totalSize).toBe(calculatedSize);
    });
  });
});
