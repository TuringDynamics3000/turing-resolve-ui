import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FileText,
  Hash,
  CheckCircle,
  Clock,
  ArrowRight,
  Download,
  Copy,
  Shield,
  Wallet,
  Database,
  Link as LinkIcon,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

interface PaymentEvent {
  id: string;
  type: string;
  timestamp: string;
  hash: string;
  prevHash: string;
  data: Record<string, any>;
}

interface PaymentEvidencePack {
  packId: string;
  paymentId: string;
  createdAt: string;
  merkleRoot: string;
  events: PaymentEvent[];
  decision: {
    outcome: 'ALLOW' | 'DECLINE' | 'REVIEW';
    policyVersion: string;
    reasonCodes: string[];
  };
  verification: {
    hashValid: boolean;
    chainValid: boolean;
    anchorStatus: 'PENDING' | 'ANCHORED' | 'VERIFIED';
    anchorTimestamp?: string;
  };
}

interface PaymentEvidenceViewerProps {
  evidence: PaymentEvidencePack | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Sample evidence data
const sampleEvidence: PaymentEvidencePack = {
  packId: 'EVD-PAY-001-20241216',
  paymentId: 'PAY-001',
  createdAt: '2024-12-16T10:32:00Z',
  merkleRoot: 'a3f2b8c9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
  events: [
    {
      id: 'EVT-001',
      type: 'PAYMENT_INITIATED',
      timestamp: '2024-12-16T10:30:00Z',
      hash: 'abc123def456...',
      prevHash: '000000000000...',
      data: { amount: 1500, currency: 'AUD', sender: 'CUS-001', recipient: 'Electric Company' }
    },
    {
      id: 'EVT-002',
      type: 'FRAUD_CHECK_PASSED',
      timestamp: '2024-12-16T10:30:05Z',
      hash: 'def456ghi789...',
      prevHash: 'abc123def456...',
      data: { riskScore: 12, threshold: 70 }
    },
    {
      id: 'EVT-003',
      type: 'BALANCE_VERIFIED',
      timestamp: '2024-12-16T10:30:10Z',
      hash: 'ghi789jkl012...',
      prevHash: 'def456ghi789...',
      data: { availableBalance: 5000, requiredAmount: 1500 }
    },
    {
      id: 'EVT-004',
      type: 'PAYMENT_AUTHORISED',
      timestamp: '2024-12-16T10:31:00Z',
      hash: 'jkl012mno345...',
      prevHash: 'ghi789jkl012...',
      data: { authorisationCode: 'AUTH-789456' }
    },
    {
      id: 'EVT-005',
      type: 'PAYMENT_COMPLETED',
      timestamp: '2024-12-16T10:32:00Z',
      hash: 'mno345pqr678...',
      prevHash: 'jkl012mno345...',
      data: { completionRef: 'COMP-123456', settledAmount: 1500 }
    }
  ],
  decision: {
    outcome: 'ALLOW',
    policyVersion: 'payment-fraud-v1.3',
    reasonCodes: ['LOW_RISK', 'SUFFICIENT_BALANCE', 'KNOWN_RECIPIENT']
  },
  verification: {
    hashValid: true,
    chainValid: true,
    anchorStatus: 'VERIFIED',
    anchorTimestamp: '2024-12-16T10:35:00Z'
  }
};

export function PaymentEvidenceViewer({ evidence, open, onOpenChange }: PaymentEvidenceViewerProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const pack = evidence || sampleEvidence;

  const handleCopyHash = async (hash: string) => {
    await navigator.clipboard.writeText(hash);
    toast.success('Hash copied to clipboard');
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pack.packId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Evidence pack exported');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Payment Evidence Pack
          </DialogTitle>
          <DialogDescription>
            Cryptographic proof of payment {pack.paymentId} decision and execution
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="events">Event Chain</TabsTrigger>
            <TabsTrigger value="decision">Decision</TabsTrigger>
            <TabsTrigger value="verification">Verification</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="glass-panel">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Wallet className="w-4 h-4" />
                    <span className="text-xs">Payment ID</span>
                  </div>
                  <p className="font-mono font-semibold">{pack.paymentId}</p>
                </CardContent>
              </Card>
              <Card className="glass-panel">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs">Created</span>
                  </div>
                  <p className="font-medium">
                    {new Date(pack.createdAt).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card className="glass-panel">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Database className="w-4 h-4" />
                    <span className="text-xs">Events</span>
                  </div>
                  <p className="font-semibold">{pack.events.length} events</p>
                </CardContent>
              </Card>
            </div>

            {/* Merkle Root */}
            <Card className="glass-panel">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  Merkle Root
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 rounded bg-muted font-mono text-xs break-all">
                    {pack.merkleRoot}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyHash(pack.merkleRoot)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Verification Status */}
            <Card className="glass-panel">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Verification Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className={`w-5 h-5 ${pack.verification.hashValid ? 'text-green-500' : 'text-red-500'}`} />
                    <span className="text-sm">Hash Valid</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className={`w-5 h-5 ${pack.verification.chainValid ? 'text-green-500' : 'text-red-500'}`} />
                    <span className="text-sm">Chain Valid</span>
                  </div>
                  <Badge
                    variant={pack.verification.anchorStatus === 'VERIFIED' ? 'default' : 'secondary'}
                  >
                    {pack.verification.anchorStatus}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <div className="space-y-3">
              {pack.events.map((event, index) => (
                <Card key={event.id} className="glass-panel">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          event.type.includes('COMPLETED') ? 'bg-green-500/20 text-green-500' :
                          event.type.includes('FAILED') ? 'bg-red-500/20 text-red-500' :
                          'bg-primary/20 text-primary'
                        }`}>
                          {index + 1}
                        </div>
                        {index < pack.events.length - 1 && (
                          <div className="w-0.5 h-8 bg-border mt-2" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">{event.type}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Hash: </span>
                            <code className="font-mono">{event.hash}</code>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Prev: </span>
                            <code className="font-mono">{event.prevHash}</code>
                          </div>
                        </div>
                        {Object.keys(event.data).length > 0 && (
                          <div className="mt-2 p-2 rounded bg-muted/50">
                            <pre className="text-xs font-mono">
                              {JSON.stringify(event.data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="decision" className="space-y-4">
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="text-sm">Decision Outcome</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Badge
                    className={`text-lg px-4 py-2 ${
                      pack.decision.outcome === 'ALLOW' ? 'bg-green-500' :
                      pack.decision.outcome === 'DECLINE' ? 'bg-red-500' :
                      'bg-amber-500'
                    }`}
                  >
                    {pack.decision.outcome}
                  </Badge>
                  <div>
                    <p className="text-sm text-muted-foreground">Policy Version</p>
                    <p className="font-mono">{pack.decision.policyVersion}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Reason Codes</p>
                  <div className="flex flex-wrap gap-2">
                    {pack.decision.reasonCodes.map((code) => (
                      <Badge key={code} variant="secondary">
                        {code}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verification" className="space-y-4">
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="text-sm">Cryptographic Verification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className={`w-5 h-5 ${pack.verification.hashValid ? 'text-green-500' : 'text-red-500'}`} />
                      <span className="font-medium">Hash Integrity</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      All event hashes have been verified against their content
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className={`w-5 h-5 ${pack.verification.chainValid ? 'text-green-500' : 'text-red-500'}`} />
                      <span className="font-medium">Chain Continuity</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Event chain is unbroken with valid prev-hash links
                    </p>
                  </div>
                </div>

                {pack.verification.anchorTimestamp && (
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <LinkIcon className="w-5 h-5 text-green-500" />
                      <span className="font-medium text-green-500">External Anchor</span>
                    </div>
                    <p className="text-sm">
                      Merkle root anchored at {new Date(pack.verification.anchorTimestamp).toLocaleString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleExportJSON}>
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
