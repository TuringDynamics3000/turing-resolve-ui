import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowRight, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  RotateCcw,
  Shield,
  Database,
  FileText,
  ExternalLink,
  Zap,
  Lock,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Info,
} from "lucide-react";

const STATE_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  INITIATED: { bg: "bg-slate-100", text: "text-slate-700", icon: <Clock className="h-3 w-3" /> },
  HELD: { bg: "bg-amber-100", text: "text-amber-700", icon: <Lock className="h-3 w-3" /> },
  SENT: { bg: "bg-blue-100", text: "text-blue-700", icon: <ArrowRight className="h-3 w-3" /> },
  SETTLED: { bg: "bg-emerald-100", text: "text-emerald-700", icon: <CheckCircle2 className="h-3 w-3" /> },
  FAILED: { bg: "bg-red-100", text: "text-red-700", icon: <XCircle className="h-3 w-3" /> },
  REVERSED: { bg: "bg-purple-100", text: "text-purple-700", icon: <RotateCcw className="h-3 w-3" /> },
};

const FACT_TYPE_LABELS: Record<string, string> = {
  PAYMENT_INITIATED: "Payment Initiated",
  PAYMENT_HOLD_PLACED: "Hold Placed",
  PAYMENT_HOLD_RELEASED: "Hold Released",
  PAYMENT_SENT: "Payment Sent",
  PAYMENT_SETTLED: "Payment Settled",
  PAYMENT_FAILED: "Payment Failed",
  PAYMENT_REVERSED: "Payment Reversed",
};

function StateBadge({ state }: { state: string }) {
  const config = STATE_COLORS[state] || STATE_COLORS.INITIATED;
  return (
    <Badge className={`${config.bg} ${config.text} gap-1 font-mono text-xs`}>
      {config.icon}
      {state}
    </Badge>
  );
}

function formatCurrency(amount: string, currency: string): string {
  const num = parseFloat(amount);
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currency || "AUD",
  }).format(num);
}

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function OverviewTab({ 
  payments, 
  isLoading, 
  onSelectPayment 
}: { 
  payments: any[]; 
  isLoading: boolean;
  onSelectPayment: (paymentId: string) => void;
}) {
  const stats = useMemo(() => {
    if (!payments) return { total: 0, byState: {}, totalAmount: 0 };
    const byState: Record<string, number> = {};
    let totalAmount = 0;
    for (const p of payments) {
      byState[p.state] = (byState[p.state] || 0) + 1;
      totalAmount += parseFloat(p.amount);
    }
    return { total: payments.length, byState, totalAmount };
  }, [payments]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (<Skeleton key={i} className="h-24" />))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{stats.total}</div><div className="text-sm text-muted-foreground">Total Payments</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-emerald-600">{stats.byState.SETTLED || 0}</div><div className="text-sm text-muted-foreground">Settled</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-amber-600">{(stats.byState.INITIATED || 0) + (stats.byState.HELD || 0) + (stats.byState.SENT || 0)}</div><div className="text-sm text-muted-foreground">In Progress</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-red-600">{(stats.byState.FAILED || 0) + (stats.byState.REVERSED || 0)}</div><div className="text-sm text-muted-foreground">Failed/Reversed</div></CardContent></Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Database className="h-5 w-5" />Payments (Rebuilt from Facts)</CardTitle>
          <CardDescription>State derived server-side from immutable payment facts. Click a row to view details.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment ID</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Scheme</TableHead>
                <TableHead>From → To</TableHead>
                <TableHead>Facts</TableHead>
                <TableHead>Last Event</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No payments found.</TableCell></TableRow>
              ) : (
                payments.map((p) => (
                  <TableRow key={p.paymentId} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectPayment(p.paymentId)}>
                    <TableCell className="font-mono text-xs">{p.paymentId}</TableCell>
                    <TableCell><StateBadge state={p.state} /></TableCell>
                    <TableCell className="font-medium">{formatCurrency(p.amount, p.currency)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{p.scheme}</Badge></TableCell>
                    <TableCell className="text-xs">
                      <span className="font-mono">{p.fromAccount.slice(0, 8)}...</span>
                      <ArrowRight className="h-3 w-3 inline mx-1" />
                      {p.toAccount ? <span className="font-mono">{p.toAccount.slice(0, 8)}...</span> : <span className="text-muted-foreground">External</span>}
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{p.factCount} facts</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.lastEvent && (
                        <Tooltip><TooltipTrigger><span>{FACT_TYPE_LABELS[p.lastEvent] || p.lastEvent}</span></TooltipTrigger><TooltipContent>{formatDate(p.lastEventAt)}</TooltipContent></Tooltip>
                      )}
                    </TableCell>
                    <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentDetailTab({ paymentId }: { paymentId: string }) {
  const { data, isLoading } = trpc.payments.rebuildFromFacts.useQuery({ paymentId });
  if (isLoading) return <Skeleton className="h-96" />;
  if (!data?.success || !data.payment) return <Card><CardContent className="pt-6 text-center text-muted-foreground">Payment not found.</CardContent></Card>;
  const { payment } = data;
  const states = ["INITIATED", "HELD", "SENT", "SETTLED"];
  const currentIndex = states.indexOf(payment.currentState);
  const isTerminal = ["FAILED", "REVERSED"].includes(payment.currentState);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Zap className="h-5 w-5" />Deterministic State Machine</CardTitle><CardDescription>Current state derived from replaying {payment.stateTransitions.length + 1} facts</CardDescription></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-4">
            {states.map((state, i) => {
              const isActive = i <= currentIndex && !isTerminal;
              const isCurrent = state === payment.currentState;
              return (
                <div key={state} className="flex items-center">
                  <div className={`flex flex-col items-center ${isActive ? "opacity-100" : "opacity-40"}`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isCurrent ? "ring-2 ring-offset-2 ring-blue-500" : ""} ${isActive ? STATE_COLORS[state].bg : "bg-gray-100"}`}>{STATE_COLORS[state].icon}</div>
                    <span className="text-xs mt-2 font-medium">{state}</span>
                  </div>
                  {i < states.length - 1 && <div className={`w-16 h-0.5 mx-2 ${i < currentIndex && !isTerminal ? "bg-blue-500" : "bg-gray-200"}`} />}
                </div>
              );
            })}
          </div>
          {isTerminal && <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200"><div className="flex items-center gap-2 text-red-700">{payment.currentState === "FAILED" ? <XCircle className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}<span className="font-medium">Terminal State: {payment.currentState}</span></div></div>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-lg">Payment Intent</CardTitle><CardDescription>Original payment instruction (immutable after creation)</CardDescription></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div><div className="text-sm text-muted-foreground">Amount</div><div className="font-medium">{formatCurrency(payment.intent.amount, payment.intent.currency)}</div></div>
            <div><div className="text-sm text-muted-foreground">Scheme</div><div className="font-medium">{payment.intent.scheme}</div></div>
            <div><div className="text-sm text-muted-foreground">From Account</div><div className="font-mono text-sm">{payment.intent.fromAccount}</div></div>
            <div><div className="text-sm text-muted-foreground">To Account</div><div className="font-mono text-sm">{String(payment.intent.toAccount || payment.intent.toExternal || "External")}</div></div>
            <div className="col-span-2"><div className="text-sm text-muted-foreground">Idempotency Key</div><div className="font-mono text-xs bg-muted p-2 rounded">{payment.intent.idempotencyKey}</div></div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-lg">State Transitions</CardTitle><CardDescription>Each transition triggered by a fact event</CardDescription></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {payment.stateTransitions.length === 0 ? <div className="text-muted-foreground text-sm">No state transitions yet (still in INITIATED state)</div> : payment.stateTransitions.map((t: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <StateBadge state={t.from} /><ArrowRight className="h-4 w-4 text-muted-foreground" /><StateBadge state={t.to} />
                <div className="flex-1 text-right"><Badge variant="outline" className="text-xs">{FACT_TYPE_LABELS[t.factType] || t.factType}</Badge><div className="text-xs text-muted-foreground mt-1">{formatDate(t.occurredAt)}</div></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FactTimelineTab({ paymentId }: { paymentId: string }) {
  const { data: facts, isLoading } = trpc.payments.getFacts.useQuery({ paymentId });
  if (isLoading) return <Skeleton className="h-96" />;
  if (!facts || facts.length === 0) return <Card><CardContent className="pt-6 text-center text-muted-foreground">No facts recorded.</CardContent></Card>;

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5" />Immutable Fact Timeline</CardTitle><CardDescription>Exact sequence of truth events. Strict chronological order.</CardDescription></CardHeader>
      <CardContent>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
          <div className="space-y-4">
            {facts.map((fact) => (
              <div key={fact.id} className="relative pl-10">
                <div className={`absolute left-2 w-4 h-4 rounded-full border-2 border-background ${fact.depositFactId ? "bg-emerald-500" : "bg-blue-500"}`} />
                <Card className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div><div className="flex items-center gap-2"><Badge className="text-xs">Seq #{fact.sequence}</Badge><span className="font-medium">{FACT_TYPE_LABELS[fact.factType] || fact.factType}</span></div><div className="text-xs text-muted-foreground mt-1">{formatDate(fact.occurredAt)}</div></div>
                      <div className="text-right"><Badge variant="outline" className="text-xs">{fact.source}</Badge>{fact.externalRef && <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><ExternalLink className="h-3 w-3" />{fact.externalRef}</div>}</div>
                    </div>
                    <div className="mt-3 p-2 bg-muted rounded text-xs font-mono overflow-x-auto"><pre>{JSON.stringify(fact.factData ?? {}, null, 2)}</pre></div>
                    {fact.depositFactId && <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded"><div className="flex items-center gap-2 text-emerald-700 text-sm"><Database className="h-4 w-4" /><span>Linked to Deposit Fact #{fact.depositFactId}</span><Badge variant="outline" className="text-xs">{fact.depositPostingType}</Badge></div></div>}
                    <div className="mt-2 text-xs text-muted-foreground"><span className="font-medium">Idempotency:</span> <code className="bg-muted px-1 rounded">{fact.idempotencyKey}</code></div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LinkedDepositsTab({ paymentId }: { paymentId: string }) {
  const { data, isLoading } = trpc.payments.getLinkedDeposits.useQuery({ paymentId });
  if (isLoading) return <Skeleton className="h-96" />;
  if (!data) return <Card><CardContent className="pt-6 text-center text-muted-foreground">Unable to load linked deposits.</CardContent></Card>;

  return (
    <div className="space-y-6">
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-emerald-600 mt-0.5" />
            <div><div className="font-medium text-emerald-800">Payments Cannot Corrupt Balances</div><div className="text-sm text-emerald-700 mt-1">Every balance change goes through Deposits Core. Payments emit intent, Deposits emit truth.</div></div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-lg">Linked Accounts</CardTitle><CardDescription>Deposit accounts involved in this payment</CardDescription></CardHeader>
        <CardContent>
          {data.linkedAccounts.length === 0 ? <div className="text-muted-foreground text-sm">No linked accounts found.</div> : (
            <div className="grid grid-cols-2 gap-4">
              {data.linkedAccounts.map((acc: any) => (
                <div key={acc.accountId} className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2"><Badge variant={acc.role === "SOURCE" ? "destructive" : "default"}>{acc.role}</Badge></div>
                  <div className="mt-2 font-mono text-sm">{acc.accountId}</div>
                  <div className="text-xs text-muted-foreground">Customer: {acc.customerId}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-lg">Deposit Facts Created</CardTitle><CardDescription>Immutable balance changes recorded in Deposits Core</CardDescription></CardHeader>
        <CardContent>
          {data.depositFacts.length === 0 ? <div className="text-muted-foreground text-sm">No deposit facts linked yet.</div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Fact ID</TableHead><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Occurred At</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.depositFacts.map((fact: any) => (
                  <TableRow key={fact.factId}>
                    <TableCell className="font-mono text-xs">{fact.factId}</TableCell>
                    <TableCell className="font-mono text-xs">{fact.accountId.slice(0, 12)}...</TableCell>
                    <TableCell><Badge variant={fact.postingType === "DEBIT" ? "destructive" : "default"}>{fact.postingType}</Badge></TableCell>
                    <TableCell>{fact.amount ? formatCurrency((parseInt(fact.amount.amount) / 100).toString(), fact.amount.currency) : "—"}</TableCell>
                    <TableCell className="text-xs">{formatDate(fact.occurredAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SafeguardsTab() {
  const { data, isLoading } = trpc.payments.getSafeguards.useQuery();
  if (isLoading) return <Skeleton className="h-96" />;
  if (!data) return <Card><CardContent className="pt-6 text-center text-muted-foreground">Unable to load safeguards.</CardContent></Card>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><AlertCircle className="h-5 w-5" />Kill Switch Status</CardTitle><CardDescription>Emergency stop controls for payment schemes</CardDescription></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(data.killSwitch).map(([scheme, status]: [string, any]) => (
              <div key={scheme} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3"><Badge variant="outline">{scheme.toUpperCase()}</Badge><span className="font-medium">Kill Switch</span></div>
                <div className="flex items-center gap-2">{status.state === "ENABLED" ? <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-3 w-3 mr-1" />ENABLED</Badge> : <Badge className="bg-red-100 text-red-700"><AlertTriangle className="h-3 w-3 mr-1" />DISABLED</Badge>}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Zap className="h-5 w-5" />Circuit Breaker Status</CardTitle><CardDescription>Automatic protection against cascading failures</CardDescription></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(data.circuitBreaker).map(([scheme, status]: [string, any]) => (
              <div key={scheme} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3"><Badge variant="outline">{scheme.toUpperCase()}</Badge><span className="font-medium">Circuit Breaker</span></div>
                <div className="flex items-center gap-2">{status.state === "CLOSED" ? <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-3 w-3 mr-1" />CLOSED (Healthy)</Badge> : status.state === "OPEN" ? <Badge className="bg-red-100 text-red-700"><AlertTriangle className="h-3 w-3 mr-1" />OPEN (Blocking)</Badge> : <Badge className="bg-amber-100 text-amber-700"><RefreshCw className="h-3 w-3 mr-1" />HALF-OPEN</Badge>}{status.failureCount > 0 && <span className="text-xs text-muted-foreground">{status.failureCount} failures</span>}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-lg">Recent Failures</CardTitle><CardDescription>Last 10 failures across all adapters</CardDescription></CardHeader>
        <CardContent>
          {data.failureHistory.length === 0 ? <div className="text-center text-muted-foreground py-4"><CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" /><div>No recent failures</div></div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Adapter</TableHead><TableHead>Details</TableHead><TableHead>Timestamp</TableHead></TableRow></TableHeader>
              <TableBody>{data.failureHistory.map((f: any, i: number) => (<TableRow key={i}><TableCell><Badge variant="destructive">{f.type}</Badge></TableCell><TableCell>{f.adapter}</TableCell><TableCell className="text-sm">{f.details}</TableCell><TableCell className="text-xs">{formatDate(f.timestamp)}</TableCell></TableRow>))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentsCorePage() {
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const { data: payments, isLoading, refetch } = trpc.payments.listCoreV1.useQuery();

  const handleSelectPayment = (paymentId: string) => {
    setSelectedPaymentId(paymentId);
    setActiveTab("detail");
  };

  return (
    <div className="space-y-6">
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div><div className="font-medium text-blue-800">Payments Core v1 — Deterministic State Machine</div><div className="text-sm text-blue-700 mt-1">All state shown here is <strong>derived server-side</strong> by replaying immutable facts. The UI never computes balances or state transitions. Payments emit intent → Deposits emit truth.</div></div>
          </div>
        </CardContent>
      </Card>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="detail" disabled={!selectedPaymentId}>Payment Detail</TabsTrigger>
            <TabsTrigger value="timeline" disabled={!selectedPaymentId}>Fact Timeline</TabsTrigger>
            <TabsTrigger value="deposits" disabled={!selectedPaymentId}>Linked Deposits</TabsTrigger>
            <TabsTrigger value="safeguards">Safeguards</TabsTrigger>
          </TabsList>
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
        </div>
        <TabsContent value="overview" className="mt-4"><OverviewTab payments={payments || []} isLoading={isLoading} onSelectPayment={handleSelectPayment} /></TabsContent>
        <TabsContent value="detail" className="mt-4">{selectedPaymentId && <PaymentDetailTab paymentId={selectedPaymentId} />}</TabsContent>
        <TabsContent value="timeline" className="mt-4">{selectedPaymentId && <FactTimelineTab paymentId={selectedPaymentId} />}</TabsContent>
        <TabsContent value="deposits" className="mt-4">{selectedPaymentId && <LinkedDepositsTab paymentId={selectedPaymentId} />}</TabsContent>
        <TabsContent value="safeguards" className="mt-4"><SafeguardsTab /></TabsContent>
      </Tabs>
      {selectedPaymentId && (
        <div className="fixed bottom-4 right-4 bg-background border rounded-lg shadow-lg p-3">
          <div className="flex items-center gap-3">
            <div className="text-sm"><span className="text-muted-foreground">Selected:</span> <span className="font-mono">{selectedPaymentId.slice(0, 16)}...</span></div>
            <Button variant="ghost" size="sm" onClick={() => { setSelectedPaymentId(null); setActiveTab("overview"); }}>Clear</Button>
          </div>
        </div>
      )}
    </div>
  );
}
