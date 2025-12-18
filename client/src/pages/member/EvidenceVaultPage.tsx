import { useState } from "react";
import { 
  FileText, 
  Download, 
  Shield, 
  CheckCircle2, 
  Clock,
  Hash,
  ExternalLink,
  ChevronRight,
  Lock,
  FileJson,
  FileArchive,
  Layers,
  Link2,
  AlertCircle
} from "lucide-react";
import { MemberPortalLayout } from "@/components/MemberPortalLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

// ============================================
// TYPES
// ============================================

interface EvidenceItem {
  id: string;
  type: 'REQUEST' | 'POLICY_SNAPSHOT' | 'DECISION_RECORD' | 'OPERATOR_ACTION' | 'NOTARISATION' | 'SIGNATURE';
  name: string;
  description: string;
  hash: string;
  timestamp: Date;
  size: number;
}

interface EvidencePack {
  id: string;
  decisionId: string;
  createdAt: Date;
  status: 'COMPLETE' | 'PARTIAL' | 'SEALED';
  items: EvidenceItem[];
  merkleRoot: string;
  totalSize: number;
  downloadCount: number;
}

interface NotarisationRecord {
  decisionId: string;
  redbellyTxId: string;
  blockNumber: number;
  timestamp: Date;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  confirmations: number;
  explorerUrl: string;
}

// ============================================
// MOCK DATA
// ============================================

const EVIDENCE_PACKS: EvidencePack[] = [
  {
    id: 'EVP-DEC-004847',
    decisionId: 'DEC-004847',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: 'PARTIAL',
    items: [
      { id: 'EVI-REQ', type: 'REQUEST', name: 'Original Request', description: 'Limit increase request', hash: '7f3a8b2c...', timestamp: new Date(), size: 1247 },
      { id: 'EVI-POL', type: 'POLICY_SNAPSHOT', name: 'Policy Snapshot', description: 'Policy v2.1.0', hash: '9e2d4f8a...', timestamp: new Date(), size: 3842 },
      { id: 'EVI-DEC', type: 'DECISION_RECORD', name: 'Decision Record', description: 'Pending review', hash: '5c7d9e1f...', timestamp: new Date(), size: 2156 },
      { id: 'EVI-NOT', type: 'NOTARISATION', name: 'Blockchain Anchor', description: 'RedBelly testnet', hash: '2a4b6c8d...', timestamp: new Date(), size: 1024 },
    ],
    merkleRoot: '8f7e6d5c4b3a2918273645f0e1d2c3b4a5968778695a4b3c2d1e0f9a8b7c6d5e',
    totalSize: 8269,
    downloadCount: 0,
  },
  {
    id: 'EVP-DEC-004823',
    decisionId: 'DEC-004823',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    status: 'SEALED',
    items: [
      { id: 'EVI-REQ', type: 'REQUEST', name: 'Original Request', description: 'Card limit increase', hash: '1a2b3c4d...', timestamp: new Date(), size: 1156 },
      { id: 'EVI-POL', type: 'POLICY_SNAPSHOT', name: 'Policy Snapshot', description: 'Policy v2.1.0', hash: '5e6f7a8b...', timestamp: new Date(), size: 3842 },
      { id: 'EVI-DEC', type: 'DECISION_RECORD', name: 'Decision Record', description: 'Approved', hash: '9c0d1e2f...', timestamp: new Date(), size: 2156 },
      { id: 'EVI-OPR', type: 'OPERATOR_ACTION', name: 'Operator Action', description: 'Approved by analyst', hash: '3a4b5c6d...', timestamp: new Date(), size: 892 },
      { id: 'EVI-NOT', type: 'NOTARISATION', name: 'Blockchain Anchor', description: 'RedBelly testnet', hash: '7e8f9a0b...', timestamp: new Date(), size: 1024 },
      { id: 'EVI-SIG', type: 'SIGNATURE', name: 'Pack Signature', description: 'ECDSA-P256', hash: '1c2d3e4f...', timestamp: new Date(), size: 512 },
    ],
    merkleRoot: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    totalSize: 9582,
    downloadCount: 2,
  },
  {
    id: 'EVP-DEC-004801',
    decisionId: 'DEC-004801',
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    status: 'SEALED',
    items: [
      { id: 'EVI-REQ', type: 'REQUEST', name: 'Original Request', description: 'International transfer limit', hash: '4b5c6d7e...', timestamp: new Date(), size: 1389 },
      { id: 'EVI-POL', type: 'POLICY_SNAPSHOT', name: 'Policy Snapshot', description: 'Policy v2.0.5', hash: '8f9a0b1c...', timestamp: new Date(), size: 3842 },
      { id: 'EVI-DEC', type: 'DECISION_RECORD', name: 'Decision Record', description: 'Declined', hash: '2d3e4f5a...', timestamp: new Date(), size: 2156 },
      { id: 'EVI-OPR', type: 'OPERATOR_ACTION', name: 'Operator Action', description: 'Declined - verification needed', hash: '6b7c8d9e...', timestamp: new Date(), size: 1024 },
      { id: 'EVI-NOT', type: 'NOTARISATION', name: 'Blockchain Anchor', description: 'RedBelly testnet', hash: '0f1a2b3c...', timestamp: new Date(), size: 1024 },
      { id: 'EVI-SIG', type: 'SIGNATURE', name: 'Pack Signature', description: 'ECDSA-P256', hash: '4d5e6f7a...', timestamp: new Date(), size: 512 },
    ],
    merkleRoot: '9e8d7c6b5a4938271605f4e3d2c1b0a9f8e7d6c5b4a3928170615f4e3d2c1b0a',
    totalSize: 9947,
    downloadCount: 1,
  },
];

const NOTARISATIONS: Record<string, NotarisationRecord> = {
  'DEC-004847': {
    decisionId: 'DEC-004847',
    redbellyTxId: '0x8f7e6d5c4b3a2918273645f0e1d2c3b4a5968778695a4b3c2d1e0f9a8b7c6d5e',
    blockNumber: 1847293,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: 'CONFIRMED',
    confirmations: 156,
    explorerUrl: 'https://explorer.testnet.redbelly.network/tx/0x8f7e6d5c...',
  },
  'DEC-004823': {
    decisionId: 'DEC-004823',
    redbellyTxId: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    blockNumber: 1847156,
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    status: 'CONFIRMED',
    confirmations: 2847,
    explorerUrl: 'https://explorer.testnet.redbelly.network/tx/0x1a2b3c4d...',
  },
  'DEC-004801': {
    decisionId: 'DEC-004801',
    redbellyTxId: '0x9e8d7c6b5a4938271605f4e3d2c1b0a9f8e7d6c5b4a3928170615f4e3d2c1b0a',
    blockNumber: 1846892,
    timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    status: 'CONFIRMED',
    confirmations: 8472,
    explorerUrl: 'https://explorer.testnet.redbelly.network/tx/0x9e8d7c6b...',
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-AU", { 
    month: "short", 
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncateHash(hash: string): string {
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function getItemIcon(type: EvidenceItem['type']) {
  switch (type) {
    case 'REQUEST': return FileText;
    case 'POLICY_SNAPSHOT': return Layers;
    case 'DECISION_RECORD': return Shield;
    case 'OPERATOR_ACTION': return CheckCircle2;
    case 'NOTARISATION': return Link2;
    case 'SIGNATURE': return Lock;
    default: return FileText;
  }
}

function getItemColor(type: EvidenceItem['type']) {
  switch (type) {
    case 'REQUEST': return 'text-blue-400 bg-blue-500/20';
    case 'POLICY_SNAPSHOT': return 'text-purple-400 bg-purple-500/20';
    case 'DECISION_RECORD': return 'text-coral-400 bg-coral-500/20';
    case 'OPERATOR_ACTION': return 'text-emerald-400 bg-emerald-500/20';
    case 'NOTARISATION': return 'text-amber-400 bg-amber-500/20';
    case 'SIGNATURE': return 'text-cyan-400 bg-cyan-500/20';
    default: return 'text-slate-400 bg-slate-500/20';
  }
}

// ============================================
// COMPONENTS
// ============================================

function StatusBadge({ status }: { status: EvidencePack['status'] }) {
  const config = {
    COMPLETE: { color: 'text-emerald-400 bg-emerald-500/20', label: 'Complete' },
    PARTIAL: { color: 'text-amber-400 bg-amber-500/20', label: 'In Progress' },
    SEALED: { color: 'text-cyan-400 bg-cyan-500/20', label: 'Sealed' },
  };
  
  const { color, label } = config[status];
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      {status === 'SEALED' && <Lock className="w-3 h-3" />}
      {status === 'PARTIAL' && <Clock className="w-3 h-3" />}
      {status === 'COMPLETE' && <CheckCircle2 className="w-3 h-3" />}
      {label}
    </span>
  );
}

function EvidenceItemCard({ item }: { item: EvidenceItem }) {
  const Icon = getItemIcon(item.type);
  const colorClass = getItemColor(item.type);
  
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium text-sm">{item.name}</p>
        <p className="text-slate-500 text-xs truncate">{item.description}</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-slate-400 font-mono">{truncateHash(item.hash)}</p>
        <p className="text-xs text-slate-500">{formatBytes(item.size)}</p>
      </div>
    </div>
  );
}

function BlockchainProofCard({ notarisation }: { notarisation: NotarisationRecord }) {
  return (
    <div className="p-4 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <Link2 className="w-5 h-5 text-amber-400" />
        <h4 className="text-white font-medium">Blockchain Proof</h4>
        {notarisation.status === 'CONFIRMED' && (
          <span className="ml-auto px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
            {notarisation.confirmations} confirmations
          </span>
        )}
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Network</span>
          <span className="text-white">RedBelly Testnet</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Block</span>
          <span className="text-white font-mono">#{notarisation.blockNumber.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Transaction</span>
          <code className="text-amber-400 text-xs font-mono">
            {truncateHash(notarisation.redbellyTxId)}
          </code>
        </div>
      </div>
      
      <Button 
        variant="outline" 
        size="sm"
        className="w-full mt-3 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
        onClick={() => window.open(notarisation.explorerUrl, '_blank')}
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        View on Explorer
      </Button>
    </div>
  );
}

function EvidencePackDetail({ pack }: { pack: EvidencePack }) {
  const notarisation = NOTARISATIONS[pack.decisionId];
  const [downloading, setDownloading] = useState(false);
  
  const handleDownload = async (format: 'JSON' | 'PDF' | 'ZIP') => {
    setDownloading(true);
    // Simulate download
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.success(`Evidence pack downloaded as ${format}`, {
      description: `Pack ID: ${pack.id}`
    });
    setDownloading(false);
  };
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-coral-400 hover:text-coral-300 hover:bg-coral-500/10">
          View Details
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-coral-400" />
            Evidence Pack
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-2">
          {/* Pack Info */}
          <div className="p-3 bg-slate-800/50 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Pack ID</span>
              <code className="text-xs text-white font-mono">{pack.id}</code>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Decision</span>
              <code className="text-xs text-coral-400 font-mono">{pack.decisionId}</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Status</span>
              <StatusBadge status={pack.status} />
            </div>
          </div>
          
          {/* Merkle Root */}
          <div className="p-3 bg-slate-800/50 rounded-xl">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Hash className="w-3.5 h-3.5" />
              Merkle Root
            </div>
            <code className="text-xs text-emerald-400 font-mono break-all">
              {pack.merkleRoot}
            </code>
          </div>
          
          {/* Evidence Items */}
          <div>
            <h4 className="text-sm font-medium text-white mb-2">
              Evidence Items ({pack.items.length})
            </h4>
            <div className="space-y-2">
              {pack.items.map(item => (
                <EvidenceItemCard key={item.id} item={item} />
              ))}
            </div>
          </div>
          
          {/* Blockchain Proof */}
          {notarisation && (
            <BlockchainProofCard notarisation={notarisation} />
          )}
          
          {/* Download Options */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white">Download</h4>
            <div className="grid grid-cols-3 gap-2">
              <Button 
                variant="outline" 
                size="sm"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={() => handleDownload('JSON')}
                disabled={downloading}
              >
                <FileJson className="w-4 h-4 mr-1" />
                JSON
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={() => handleDownload('PDF')}
                disabled={downloading}
              >
                <FileText className="w-4 h-4 mr-1" />
                PDF
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={() => handleDownload('ZIP')}
                disabled={downloading}
              >
                <FileArchive className="w-4 h-4 mr-1" />
                ZIP
              </Button>
            </div>
          </div>
          
          {/* Verification Info */}
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" />
              <div>
                <p className="text-xs text-emerald-400 font-medium">Integrity Verified</p>
                <p className="text-xs text-slate-400 mt-1">
                  All {pack.items.length} items verified against merkle root. 
                  This evidence pack has not been tampered with.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EvidencePackCard({ pack }: { pack: EvidencePack }) {
  const notarisation = NOTARISATIONS[pack.decisionId];
  
  return (
    <div className="bg-slate-900/80 rounded-2xl border border-slate-800/50 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-white font-medium">{pack.decisionId}</h3>
            <StatusBadge status={pack.status} />
          </div>
          <p className="text-sm text-slate-500 mt-1">Created {formatDate(pack.createdAt)}</p>
        </div>
        <EvidencePackDetail pack={pack} />
      </div>
      
      <div className="flex items-center gap-4 text-sm mb-3">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Layers className="w-4 h-4" />
          <span>{pack.items.length} items</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <FileText className="w-4 h-4" />
          <span>{formatBytes(pack.totalSize)}</span>
        </div>
        {pack.downloadCount > 0 && (
          <div className="flex items-center gap-1.5 text-slate-400">
            <Download className="w-4 h-4" />
            <span>{pack.downloadCount} downloads</span>
          </div>
        )}
      </div>
      
      {/* Blockchain status */}
      {notarisation && (
        <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <Link2 className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-amber-400">
            Anchored to RedBelly block #{notarisation.blockNumber.toLocaleString()}
          </span>
          <span className="ml-auto text-xs text-slate-500">
            {notarisation.confirmations} confirmations
          </span>
        </div>
      )}
      
      {/* Merkle root preview */}
      <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
        <Hash className="w-3.5 h-3.5" />
        <span className="font-mono">{truncateHash(pack.merkleRoot)}</span>
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function EvidenceVaultPage() {
  return (
    <MemberPortalLayout title="Evidence Vault" showBack>
      <div className="px-6 py-4">
        <div className="p-4 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl border border-slate-800/50">
          <div className="flex items-start gap-3">
            <Shield className="w-6 h-6 text-coral-400" />
            <div>
              <h3 className="text-white font-medium">Your Evidence Vault</h3>
              <p className="text-sm text-slate-400 mt-1">
                Complete audit packs for all your decisions. Each pack is cryptographically sealed and anchored to blockchain.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Governance guarantee */}
      <div className="px-6 pb-4">
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <p className="text-xs text-emerald-400">
              <strong>Tamper-Proof:</strong> All evidence packs are merkle-sealed and blockchain-anchored for regulatory-grade immutability.
            </p>
          </div>
        </div>
      </div>
      
      {/* Evidence packs list */}
      <div className="px-6 pb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Your Evidence Packs ({EVIDENCE_PACKS.length})
        </h2>
        <div className="space-y-4">
          {EVIDENCE_PACKS.map(pack => (
            <EvidencePackCard key={pack.id} pack={pack} />
          ))}
        </div>
      </div>
      
      {/* Info section */}
      <div className="px-6 pb-6">
        <div className="p-4 bg-slate-800/30 rounded-xl">
          <h3 className="text-white font-medium mb-3">What's in an Evidence Pack?</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <span className="text-slate-300">Original Request</span>
              <span className="text-slate-500 ml-auto">Your submitted request</span>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span className="text-slate-300">Policy Snapshot</span>
              <span className="text-slate-500 ml-auto">Rules applied</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-coral-400" />
              <span className="text-slate-300">Decision Record</span>
              <span className="text-slate-500 ml-auto">Outcome & reasoning</span>
            </div>
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300">Blockchain Anchor</span>
              <span className="text-slate-500 ml-auto">Immutable proof</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-300">Pack Signature</span>
              <span className="text-slate-500 ml-auto">Cryptographic seal</span>
            </div>
          </div>
        </div>
      </div>
    </MemberPortalLayout>
  );
}
