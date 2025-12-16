import { Link, useLocation } from "wouter";
import { 
  Wallet, 
  CreditCard, 
  AlertTriangle, 
  Shield,
  MessageSquare,
  Home,
  FileText
} from "lucide-react";

const navItems = [
  { href: "/operator", label: "Overview", icon: Home },
  { href: "/operator/deposits", label: "Deposits", icon: Wallet },
  { href: "/operator/payments", label: "Payments", icon: CreditCard },
  { href: "/operator/safeguards", label: "Safeguards", icon: Shield },
  { href: "/operator/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/operator/advisory", label: "Advisory", icon: MessageSquare },
  { href: "/operator/audit", label: "Audit Log", icon: FileText },
];

export function OperatorNav() {
  const [location] = useLocation();

  return (
    <nav className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-400" />
          Operator Console
        </h1>
        <p className="text-xs text-slate-500 mt-1">Control Plane</p>
      </div>

      <div className="space-y-1 flex-1">
        {navItems.map((item) => {
          const isActive = location === item.href || 
            (item.href !== "/operator" && location.startsWith(item.href));
          const Icon = item.icon;
          
          return (
            <Link key={item.href} href={item.href}>
              <a
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </a>
            </Link>
          );
        })}
      </div>

      <div className="pt-4 border-t border-slate-800">
        <Link href="/">
          <a className="flex items-center gap-3 px-3 py-2 text-slate-500 hover:text-slate-300 transition-colors text-sm">
            ← Back to Dashboard
          </a>
        </Link>
      </div>
    </nav>
  );
}
