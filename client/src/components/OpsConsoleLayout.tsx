import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  Inbox, 
  Clock, 
  CheckSquare, 
  Wallet, 
  Gauge, 
  Shield, 
  FileText, 
  Activity, 
  Settings,
  ChevronRight,
  User,
  Bell,
  Search,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AuthorityBadge, useAuthority } from "@/contexts/AuthorityContext";

// ============================================
// TYPES
// ============================================

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: number;
  restricted?: boolean;
}

// ============================================
// NAVIGATION CONFIG
// ============================================

const NAV_ITEMS: NavItem[] = [
  { id: "inbox", label: "Decision Inbox", icon: Inbox, href: "/ops", badge: 7 },
  { id: "active", label: "Active Decisions", icon: Clock, href: "/ops/active", badge: 3 },
  { id: "completed", label: "Completed Decisions", icon: CheckSquare, href: "/ops/completed" },
  { id: "payments", label: "Payments Ledger", icon: Wallet, href: "/ops/payments" },
  { id: "limits", label: "Limits & Overrides", icon: Gauge, href: "/ops/limits" },
  { id: "risk", label: "Risk & AML", icon: Shield, href: "/ops/risk", badge: 2 },
  { id: "evidence", label: "Evidence & Audit", icon: FileText, href: "/ops/evidence" },
  { id: "health", label: "System Health", icon: Activity, href: "/ops/health" },
  { id: "config", label: "Configuration", icon: Settings, href: "/ops/config", restricted: true },
];

// ============================================
// COMPONENTS
// ============================================

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const { hasPermission } = useAuthority();
  const canAccess = !item.restricted || hasPermission("view", "configuration");
  
  if (!canAccess) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 text-slate-600 cursor-not-allowed">
        <item.icon className="w-5 h-5" />
        <span className="text-sm">{item.label}</span>
        <div className="ml-auto">
          <Settings className="w-4 h-4" />
        </div>
      </div>
    );
  }
  
  return (
    <Link href={item.href}>
      <a
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
          isActive 
            ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30" 
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
        }`}
      >
        <item.icon className="w-5 h-5" />
        <span className="text-sm font-medium">{item.label}</span>
        {item.badge && item.badge > 0 && (
          <Badge className="ml-auto bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-xs">
            {item.badge}
          </Badge>
        )}
        {isActive && <ChevronRight className="w-4 h-4 ml-auto text-cyan-400" />}
      </a>
    </Link>
  );
}

function UserPanel() {
  const { user } = useAuthority();
  
  if (!user) return null;
  
  return (
    <div className="p-4 border-t border-slate-800">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-semibold">
          {user.name.split(" ").map(n => n[0]).join("")}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">{user.name}</p>
          <p className="text-xs text-slate-500 truncate">{user.role}</p>
        </div>
      </div>
      <AuthorityBadge />
    </div>
  );
}

function TopBar() {
  const { user } = useAuthority();
  
  return (
    <div className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm flex items-center justify-between px-6">
      {/* Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search decisions, payments, evidence..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-slate-700 rounded text-xs text-slate-400">
            ⌘K
          </kbd>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative text-slate-400 hover:text-slate-200">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </Button>
        
        <div className="h-8 w-px bg-slate-700" />
        
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-200">{user?.name}</p>
            <p className="text-xs text-slate-500">{user?.authority.level.replace("_", " ")}</p>
          </div>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-200">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN LAYOUT
// ============================================

export function OpsConsoleLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  
  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-slate-800">
          <Link href="/ops">
            <a className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-100">TURING</h1>
                <p className="text-xs text-slate-500 -mt-0.5">OPS CONSOLE</p>
              </div>
            </a>
          </Link>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink 
              key={item.id} 
              item={item} 
              isActive={location === item.href || (item.href !== "/ops" && location.startsWith(item.href))}
            />
          ))}
        </nav>
        
        {/* User Panel */}
        <UserPanel />
      </aside>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default OpsConsoleLayout;
