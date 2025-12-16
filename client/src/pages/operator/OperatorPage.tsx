import { OperatorShell } from "./layout/OperatorShell";
import { Route, Switch } from "wouter";
import { PaymentsOverview } from "./payments/PaymentsOverview";
import { PaymentDetail } from "./payments/PaymentDetail";
import { KillSwitchPanel } from "./safeguards/KillSwitchPanel";
import { CircuitBreakerPanel } from "./safeguards/CircuitBreakerPanel";
import { 
  Shield, 
  CreditCard, 
  Wallet,
  AlertTriangle,
  Activity,
  FileText
} from "lucide-react";
import { AuditLogPage } from "./audit/AuditLogPage";
import FactReplayPage from "./fact-replay/FactReplayPage";
import { Link } from "wouter";

function OperatorOverview() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Operator Dashboard</h2>
      
      <div className="grid grid-cols-2 gap-6">
        <Link href="/operator/payments">
          <a className="block p-6 bg-slate-800/30 border border-slate-700 rounded-lg hover:border-blue-500/50 transition-colors">
            <CreditCard className="w-8 h-8 text-blue-400 mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1">Payments</h3>
            <p className="text-sm text-slate-400">View and manage payment operations</p>
          </a>
        </Link>
        
        <Link href="/operator/deposits">
          <a className="block p-6 bg-slate-800/30 border border-slate-700 rounded-lg hover:border-green-500/50 transition-colors">
            <Wallet className="w-8 h-8 text-green-400 mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1">Deposits</h3>
            <p className="text-sm text-slate-400">View deposit accounts and facts</p>
          </a>
        </Link>
        
        <Link href="/operator/safeguards">
          <a className="block p-6 bg-slate-800/30 border border-slate-700 rounded-lg hover:border-amber-500/50 transition-colors">
            <Shield className="w-8 h-8 text-amber-400 mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1">Safeguards</h3>
            <p className="text-sm text-slate-400">Kill switches and circuit breakers</p>
          </a>
        </Link>
        
        <Link href="/operator/incidents">
          <a className="block p-6 bg-slate-800/30 border border-slate-700 rounded-lg hover:border-red-500/50 transition-colors">
            <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1">Incidents</h3>
            <p className="text-sm text-slate-400">View incident timeline</p>
          </a>
        </Link>
        
        <Link href="/operator/audit">
          <a className="block p-6 bg-slate-800/30 border border-slate-700 rounded-lg hover:border-cyan-500/50 transition-colors">
            <FileText className="w-8 h-8 text-cyan-400 mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1">Audit Log</h3>
            <p className="text-sm text-slate-400">Immutable record of operator actions</p>
          </a>
        </Link>
      </div>

      {/* Quick Status */}
      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-400" />
          System Status
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">ACTIVE</div>
            <div className="text-sm text-slate-400">NPP Adapter</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">CLOSED</div>
            <div className="text-sm text-slate-400">Circuit Breaker</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">OFF</div>
            <div className="text-sm text-slate-400">Kill Switch</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SafeguardsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white flex items-center gap-3">
        <Shield className="w-7 h-7 text-amber-400" />
        Safeguards
      </h2>
      <div className="grid grid-cols-2 gap-6">
        <KillSwitchPanel />
        <CircuitBreakerPanel />
      </div>
    </div>
  );
}

function DepositsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white flex items-center gap-3">
        <Wallet className="w-7 h-7 text-green-400" />
        Deposits — Operator View
      </h2>
      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center">
        <p className="text-slate-400">Deposits overview coming soon</p>
        <p className="text-sm text-slate-500 mt-2">View account facts and balances</p>
      </div>
    </div>
  );
}

function IncidentsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white flex items-center gap-3">
        <AlertTriangle className="w-7 h-7 text-red-400" />
        Incidents
      </h2>
      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center">
        <p className="text-slate-400">Incident timeline coming soon</p>
        <p className="text-sm text-slate-500 mt-2">Track system incidents and resolutions</p>
      </div>
    </div>
  );
}

export function OperatorPage() {
  return (
    <OperatorShell>
      <Switch>
        <Route path="/operator/payments/:paymentId" component={PaymentDetail} />
        <Route path="/operator/payments" component={PaymentsOverview} />
        <Route path="/operator/deposits" component={DepositsPage} />
        <Route path="/operator/safeguards" component={SafeguardsPage} />
        <Route path="/operator/incidents" component={IncidentsPage} />
        <Route path="/operator/audit" component={AuditLogPage} />
        <Route path="/operator/fact-replay" component={FactReplayPage} />
        <Route path="/operator" component={OperatorOverview} />
        <Route component={OperatorOverview} />
      </Switch>
    </OperatorShell>
  );
}
