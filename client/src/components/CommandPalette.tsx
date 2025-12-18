import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { 
  LayoutDashboard, 
  Shield, 
  Gavel, 
  FileText, 
  TrendingUp,
  CreditCard,
  Wallet,
  Building2,
  FileCheck,
  Brain,
  GitCompare,
  FlaskConical,
  Scale,
  BookOpen,
  AlertTriangle,
  Calculator,
  Globe,
  Search,
  User,
  Activity,
  PiggyBank,
  ArrowLeftRight,
  Inbox,
  HeartPulse,
  FileArchive,
  Clock,
  X,
} from "lucide-react";
import { useRole } from "@/contexts/RoleContext";
import { toast } from "sonner";

interface CommandItemType {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  action?: () => void;
  shortcut?: string;
  keywords?: string[];
  group: "navigation" | "tools" | "member" | "ops" | "actions" | "settings" | "recent";
}

const RECENT_SEARCHES_KEY = "turing-resolve-recent-searches";
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentSearch(id: string) {
  const recent = getRecentSearches().filter(r => r !== id);
  recent.unshift(id);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

function clearRecentSearches() {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [, setLocation] = useLocation();
  const { setRole } = useRole();

  // Load recent searches when dialog opens
  useEffect(() => {
    if (open) {
      setRecentIds(getRecentSearches());
    }
  }, [open]);

  // Keyboard shortcut listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  const allItems: CommandItemType[] = [
    // Navigation
    { id: "overview", label: "Overview", icon: LayoutDashboard, href: "/", keywords: ["home", "dashboard", "main"], group: "navigation" },
    { id: "resolve", label: "Resolve", icon: Shield, href: "/resolve", keywords: ["decisions", "policy", "rules"], group: "navigation" },
    { id: "cases", label: "Cases", icon: Gavel, href: "/cases", keywords: ["disputes", "investigations"], group: "navigation" },
    { id: "lending", label: "Lending", icon: CreditCard, href: "/lending", keywords: ["loans", "credit"], group: "navigation" },
    { id: "payments", label: "Payments", icon: Wallet, href: "/payments", keywords: ["transactions", "transfers"], group: "navigation" },
    { id: "deposits", label: "Deposits", icon: Building2, href: "/deposits", keywords: ["savings", "accounts"], group: "navigation" },
    { id: "wallets", label: "Wallets", icon: Globe, href: "/wallets", keywords: ["digital", "crypto"], group: "navigation" },
    { id: "exposure", label: "Exposure", icon: TrendingUp, href: "/exposure", keywords: ["risk", "limits"], group: "navigation" },
    { id: "reporting", label: "Reporting", icon: FileText, href: "/reporting", keywords: ["reports", "analytics"], group: "navigation" },
    { id: "ml-models", label: "ML Models", icon: Brain, href: "/ml-models", keywords: ["machine learning", "ai", "models"], group: "navigation" },
    { id: "evidence", label: "Evidence", icon: FileCheck, href: "/evidence", keywords: ["audit", "proof", "compliance"], group: "navigation" },
    { id: "sentinel", label: "TuringSentinel", icon: Shield, href: "/sentinel", keywords: ["monitoring", "alerts"], group: "navigation" },
    { id: "gl", label: "GL Ledger", icon: BookOpen, href: "/gl", keywords: ["general ledger", "accounting"], group: "navigation" },
    { id: "ecl", label: "ECL", icon: AlertTriangle, href: "/ecl", keywords: ["expected credit loss", "provisions"], group: "navigation" },
    { id: "operations", label: "Operations", icon: Calculator, href: "/operations", keywords: ["ops", "admin"], group: "navigation" },
    { id: "apra", label: "APRA", icon: Building2, href: "/apra", keywords: ["regulatory", "compliance", "prudential"], group: "navigation" },
    // Tools
    { id: "compare", label: "Compare Decisions", icon: GitCompare, href: "/compare", shortcut: "⌘D", keywords: ["diff", "compare"], group: "tools" },
    { id: "simulator", label: "What-If Simulator", icon: FlaskConical, href: "/simulator", shortcut: "⌘S", keywords: ["simulate", "test", "scenario"], group: "tools" },
    { id: "compliance", label: "Compliance Reports", icon: Scale, href: "/compliance", keywords: ["audit", "regulatory"], group: "tools" },
    // Member Portal
    { id: "member-dashboard", label: "Member Dashboard", icon: LayoutDashboard, href: "/member", keywords: ["customer", "portal", "home"], group: "member" },
    { id: "member-activity", label: "Activity & Transactions", icon: Activity, href: "/member/activity", keywords: ["history", "transactions"], group: "member" },
    { id: "member-savers", label: "Savers & Goals", icon: PiggyBank, href: "/member/savers", keywords: ["savings", "goals", "targets"], group: "member" },
    { id: "member-transfer", label: "Transfer Money", icon: ArrowLeftRight, href: "/member/transfer", keywords: ["send", "pay", "transfer"], group: "member" },
    { id: "member-limits", label: "My Limits", icon: TrendingUp, href: "/member/limits", keywords: ["limits", "increase", "request"], group: "member" },
    { id: "member-evidence", label: "Evidence Vault", icon: FileArchive, href: "/member/evidence", keywords: ["audit", "proof", "records"], group: "member" },
    // Ops Console
    { id: "ops-inbox", label: "Decision Inbox", icon: Inbox, href: "/ops", keywords: ["queue", "pending", "review"], group: "ops" },
    { id: "ops-limits", label: "Limits & Overrides", icon: TrendingUp, href: "/ops/limits", keywords: ["limits", "override", "approve"], group: "ops" },
    { id: "ops-health", label: "System Health", icon: HeartPulse, href: "/ops/health", keywords: ["status", "monitoring", "sla"], group: "ops" },
    // Actions
    { id: "switch-board", label: "Switch to Board Viewer", icon: User, action: () => { setRole('BOARD_VIEWER'); toast.success("Switched to Board Viewer"); }, keywords: ["role", "board"], group: "actions" },
    { id: "switch-ops", label: "Switch to Ops Analyst", icon: User, action: () => { setRole('OPS_ANALYST'); toast.success("Switched to Ops Analyst"); }, keywords: ["role", "ops"], group: "actions" },
    { id: "switch-supervisor", label: "Switch to Ops Supervisor", icon: User, action: () => { setRole('OPS_SUPERVISOR'); toast.success("Switched to Ops Supervisor"); }, keywords: ["role", "supervisor"], group: "actions" },
    { id: "switch-compliance", label: "Switch to Compliance Viewer", icon: User, action: () => { setRole('COMPLIANCE_VIEWER'); toast.success("Switched to Compliance Viewer"); }, keywords: ["role", "compliance"], group: "actions" },
    { id: "switch-policy", label: "Switch to Policy Author", icon: User, action: () => { setRole('POLICY_AUTHOR'); toast.success("Switched to Policy Author"); }, keywords: ["role", "policy"], group: "actions" },
    { id: "switch-admin", label: "Switch to System Admin", icon: User, action: () => { setRole('SYSTEM_ADMIN'); toast.success("Switched to System Admin"); }, keywords: ["role", "admin"], group: "actions" },
  ];

  const itemsById = Object.fromEntries(allItems.map(item => [item.id, item]));
  
  const recentItems = recentIds
    .map(id => itemsById[id])
    .filter(Boolean);

  const navigationItems = allItems.filter(i => i.group === "navigation");
  const toolItems = allItems.filter(i => i.group === "tools");
  const memberItems = allItems.filter(i => i.group === "member");
  const opsItems = allItems.filter(i => i.group === "ops");
  const actionItems = allItems.filter(i => i.group === "actions");

  const handleSelect = (item: CommandItemType) => {
    addRecentSearch(item.id);
    if (item.href) {
      runCommand(() => setLocation(item.href!));
    } else if (item.action) {
      runCommand(item.action);
    }
  };

  const handleClearRecent = () => {
    clearRecentSearches();
    setRecentIds([]);
    toast.success("Recent searches cleared");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1.5 font-mono text-[10px] font-medium text-slate-400 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
          {recentItems.length > 0 && (
            <>
              <CommandGroup heading={
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    Recent
                  </span>
                  <button 
                    onClick={handleClearRecent}
                    className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
                  >
                    <X className="h-3 w-3" />
                    Clear
                  </button>
                </div>
              }>
                {recentItems.map((item) => (
                  <CommandItem
                    key={`recent-${item.id}`}
                    value={`recent ${item.label}`}
                    onSelect={() => handleSelect(item)}
                  >
                    <item.icon className="mr-2 h-4 w-4 text-slate-500" />
                    <span>{item.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}
          
          <CommandGroup heading="Navigation">
            {navigationItems.map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.label} ${item.keywords?.join(" ") || ""}`}
                onSelect={() => handleSelect(item)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
                {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Tools">
            {toolItems.map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.label} ${item.keywords?.join(" ") || ""}`}
                onSelect={() => handleSelect(item)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
                {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Member Portal">
            {memberItems.map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.label} ${item.keywords?.join(" ") || ""}`}
                onSelect={() => handleSelect(item)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Ops Console">
            {opsItems.map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.label} ${item.keywords?.join(" ") || ""}`}
                onSelect={() => handleSelect(item)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Switch Role">
            {actionItems.map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.label} ${item.keywords?.join(" ") || ""}`}
                onSelect={() => handleSelect(item)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
