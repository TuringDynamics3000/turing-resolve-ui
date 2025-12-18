import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';

// Recent payment decisions
const recentPayments = [
  {
    id: 'PAY-001',
    type: 'OUTBOUND',
    amount: 1500,
    currency: 'AUD',
    recipient: 'Electric Company',
    decision: 'ALLOW',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 min ago
  },
  {
    id: 'PAY-002',
    type: 'OUTBOUND',
    amount: 5000,
    currency: 'AUD',
    recipient: 'Landlord Pty Ltd',
    decision: 'ALLOW',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 min ago
  },
  {
    id: 'PAY-003',
    type: 'OUTBOUND',
    amount: 25000,
    currency: 'AUD',
    recipient: 'Investment Fund',
    decision: 'DECLINE',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
  },
  {
    id: 'PAY-004',
    type: 'INBOUND',
    amount: 3500,
    currency: 'AUD',
    recipient: 'Salary Deposit',
    decision: 'ALLOW',
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
  },
];

// Payment metrics
const paymentMetrics = {
  todayVolume: 125000,
  todayCount: 47,
  allowRate: 94.2,
  avgLatency: 45, // ms
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

export function RecentPaymentsWidget() {
  return (
    <Card className="glass-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Payment Decisions
            </CardTitle>
            <CardDescription>Recent payment processing activity</CardDescription>
          </div>
          <Link href="/payments">
            <Button variant="ghost" size="sm" className="gap-1">
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics Row */}
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Today's Volume</p>
            <p className="text-lg font-semibold">{formatCurrency(paymentMetrics.todayVolume)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Transactions</p>
            <p className="text-lg font-semibold">{paymentMetrics.todayCount}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Allow Rate</p>
            <p className="text-lg font-semibold text-green-500">{paymentMetrics.allowRate}%</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Avg Latency</p>
            <p className="text-lg font-semibold">{paymentMetrics.avgLatency}ms</p>
          </div>
        </div>

        {/* Recent Payments List */}
        <div className="space-y-2">
          {recentPayments.map((payment) => (
            <div
              key={payment.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  payment.type === 'OUTBOUND' 
                    ? 'bg-amber-500/20 text-amber-500' 
                    : 'bg-green-500/20 text-green-500'
                }`}>
                  {payment.type === 'OUTBOUND' ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownLeft className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{payment.recipient}</p>
                  <p className="text-xs text-muted-foreground">
                    {payment.id} • {formatTime(payment.timestamp)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm">
                  {formatCurrency(payment.amount)}
                </span>
                <Badge
                  variant={payment.decision === 'ALLOW' ? 'default' : 'destructive'}
                  className={payment.decision === 'ALLOW' ? 'bg-green-500/20 text-green-500 border-green-500/30' : ''}
                >
                  {payment.decision === 'ALLOW' ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  {payment.decision}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
