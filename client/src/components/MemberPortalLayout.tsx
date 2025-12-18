import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useDecisionUpdates, DecisionUpdate } from "@/hooks/useDecisionUpdates";
import { toast } from "sonner";
import { 
  Home, 
  ArrowLeftRight, 
  PiggyBank, 
  Clock, 
  User,
  Bell,
  Settings,
  ChevronLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ============================================
// TYPES
// ============================================

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
}

// ============================================
// NAVIGATION CONFIG
// ============================================

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", icon: Home, href: "/member" },
  { id: "activity", label: "Activity", icon: Clock, href: "/member/activity" },
  { id: "savers", label: "Savers", icon: PiggyBank, href: "/member/savers" },
  { id: "transfer", label: "Transfer", icon: ArrowLeftRight, href: "/member/transfer" },
];

// ============================================
// COMPONENTS
// ============================================

function BottomNavItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link href={item.href}>
      <a
        className={`flex flex-col items-center gap-1 py-2 px-4 transition-all ${
          isActive 
            ? "text-coral-400" 
            : "text-slate-500 hover:text-slate-300"
        }`}
      >
        <item.icon className={`w-6 h-6 ${isActive ? "stroke-[2.5]" : ""}`} />
        <span className="text-xs font-medium">{item.label}</span>
      </a>
    </Link>
  );
}

function TopBar({ title, showBack = false, isConnected = false }: { title?: string; showBack?: boolean; isConnected?: boolean }) {
  return (
    <div className="h-14 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50 flex items-center justify-between px-4 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        {showBack && (
          <Link href="/member">
            <a className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </a>
          </Link>
        )}
        {title && (
          <h1 className="text-lg font-semibold text-white">{title}</h1>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {/* Live connection indicator */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-800/50">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
          <span className="text-xs text-slate-400">{isConnected ? 'Live' : 'Offline'}</span>
        </div>
        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800">
          <Bell className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800">
          <Settings className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}

function BottomNav() {
  const [location] = useLocation();
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/50 safe-area-inset-bottom z-50">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {BOTTOM_NAV_ITEMS.map((item) => (
          <BottomNavItem 
            key={item.id} 
            item={item} 
            isActive={location === item.href || (item.href !== "/member" && location.startsWith(item.href))}
          />
        ))}
      </div>
    </nav>
  );
}

// ============================================
// MAIN LAYOUT
// ============================================

interface MemberPortalLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  hideNav?: boolean;
}

export function MemberPortalLayout({ 
  children, 
  title, 
  showBack = false,
  hideNav = false 
}: MemberPortalLayoutProps) {
  // Real-time decision updates
  const { isConnected, lastUpdate } = useDecisionUpdates({
    showToasts: true,
    onUpdate: (update: DecisionUpdate) => {
      console.log('[Member Portal] Decision update received:', update);
    }
  });
  
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <TopBar title={title} showBack={showBack} isConnected={isConnected} />
      
      <main className={`${hideNav ? "" : "pb-20"}`}>
        {children}
      </main>
      
      {!hideNav && <BottomNav />}
    </div>
  );
}

export default MemberPortalLayout;
