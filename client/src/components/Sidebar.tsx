import { CommandPalette } from "./CommandPalette";
import { useRole, UserRole, Environment } from "@/contexts/RoleContext";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { 
  LayoutDashboard, 
  Shield, 
  Gavel, 
  FileText, 
  User, 
  Lock, 
  TrendingUp,
  CreditCard,
  Wallet,
  Building2,
  Database,
  FileCheck,
  Brain,
  Wrench,
  GitCompare,
  FlaskConical,
  Scale,
  BookOpen,
  AlertTriangle,
  Calculator,
  Globe,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface SidebarProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed = false, onCollapsedChange }: SidebarProps) {
  const { role, setRole, environment, setEnvironment } = useRole();
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Overview", icon: LayoutDashboard, roles: ['BOARD_VIEWER', 'OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER', 'POLICY_AUTHOR', 'SYSTEM_ADMIN'] },
    { href: "/resolve", label: "Resolve", icon: Shield, roles: ['OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER', 'POLICY_AUTHOR'] },
    { href: "/cases", label: "Cases", icon: Gavel, roles: ['OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER'] },
    { href: "/lending", label: "Lending", icon: CreditCard, roles: ['OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER'] },
    { href: "/payments", label: "Payments", icon: Wallet, roles: ['OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER'] },
    { href: "/deposits", label: "Deposits", icon: Building2, roles: ['OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER'] },
    { href: "/wallets", label: "Wallets", icon: Globe, roles: ['OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER'] },
    { href: "/exposure", label: "Exposure", icon: TrendingUp, roles: ['OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER', 'BOARD_VIEWER'] },
    { href: "/reporting", label: "Reporting", icon: FileText, roles: ['OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER', 'BOARD_VIEWER'] },
    { href: "/ml-models", label: "ML Models", icon: Brain, roles: ['OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER', 'SYSTEM_ADMIN'] },
    { href: "/evidence", label: "Evidence", icon: FileCheck, roles: ['COMPLIANCE_VIEWER', 'OPS_SUPERVISOR', 'BOARD_VIEWER'] },
    { href: "/sentinel", label: "TuringSentinel", icon: Shield, roles: ['COMPLIANCE_VIEWER', 'BOARD_VIEWER', 'SYSTEM_ADMIN'] },
    { href: "/gl", label: "GL Ledger", icon: BookOpen, roles: ['OPS_SUPERVISOR', 'COMPLIANCE_VIEWER', 'SYSTEM_ADMIN'] },
    { href: "/ecl", label: "ECL", icon: AlertTriangle, roles: ['OPS_SUPERVISOR', 'COMPLIANCE_VIEWER', 'SYSTEM_ADMIN'] },
    { href: "/operations", label: "Operations", icon: Calculator, roles: ['OPS_SUPERVISOR', 'SYSTEM_ADMIN'] },
    { href: "/apra", label: "APRA", icon: Building2, roles: ['COMPLIANCE_VIEWER', 'SYSTEM_ADMIN'] },
  ];

  const toolItems = [
    { href: "/compare", label: "Compare Decisions", icon: GitCompare },
    { href: "/simulator", label: "What-If Simulator", icon: FlaskConical },
    { href: "/compliance", label: "Compliance Reports", icon: Scale },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(role));

  const NavItem = ({ item, isActive }: { item: typeof navItems[0]; isActive: boolean }) => {
    const content = (
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group",
          isActive 
            ? "bg-blue-500/20 text-blue-400 border-l-2 border-blue-400" 
            : "text-foreground/60 hover:text-foreground hover:bg-secondary/50"
        )}
      >
        <item.icon className={cn("h-5 w-5 flex-shrink-0", isActive && "text-blue-400")} />
        {!collapsed && (
          <span className="text-sm font-medium truncate">{item.label}</span>
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-slate-800 text-white border-slate-700">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-background border-r border-blue-500/20 flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo Header */}
      <div className={cn(
        "h-16 flex items-center border-b border-blue-500/20 px-4",
        collapsed ? "justify-center" : "justify-between"
      )}>
        <Link href="/" className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex-shrink-0">
            <Database className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent whitespace-nowrap">
              TuringDynamics
            </span>
          )}
        </Link>
        {!collapsed && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-slate-400 hover:text-white"
            onClick={() => onCollapsedChange?.(true)}
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Collapse button when collapsed */}
      {collapsed && (
        <div className="px-2 py-2 border-b border-blue-500/20">
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-full h-8 text-slate-400 hover:text-white"
            onClick={() => onCollapsedChange?.(false)}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Search */}
      <div className={cn("px-2 py-3 border-b border-blue-500/20", collapsed && "px-1")}>
        {!collapsed ? (
          <CommandPalette />
        ) : (
          <CommandPalette />
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {!collapsed && (
          <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Main
          </div>
        )}
        {filteredNavItems.map((item) => {
          const isActive = location === item.href || 
            (item.href !== "/" && location.startsWith(item.href));
          return <NavItem key={item.href} item={item} isActive={isActive} />;
        })}

        {/* Tools Section */}
        <div className={cn("pt-4", !collapsed && "mt-4 border-t border-slate-800")}>
          {!collapsed && (
            <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tools
            </div>
          )}
          {toolItems.map((item) => {
            const isActive = location === item.href;
            return (
              <NavItem 
                key={item.href} 
                item={{ ...item, roles: [] }} 
                isActive={isActive} 
              />
            );
          })}
        </div>
      </nav>

      {/* Footer Section */}
      <div className={cn(
        "border-t border-blue-500/20 p-3 space-y-2",
        collapsed && "px-2"
      )}>
        {/* Version Badge */}
        {!collapsed ? (
          <Badge variant="outline" className="w-full justify-center gap-1 border-blue-500/30 text-blue-400 bg-blue-500/10 py-1.5">
            <Lock className="h-3 w-3" />
            v1.0-replacement-ready
          </Badge>
        ) : (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="flex justify-center">
                <Badge variant="outline" className="px-2 py-1.5 border-blue-500/30 text-blue-400 bg-blue-500/10">
                  <Lock className="h-3 w-3" />
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-slate-800 text-white border-slate-700">
              v1.0-replacement-ready
            </TooltipContent>
          </Tooltip>
        )}

        {/* Environment Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className={cn(
                "w-full gap-2",
                environment === 'PROD' ? "border-red-500 text-red-500" : 
                environment === 'STAGING' ? "border-yellow-500 text-yellow-500" : 
                "border-green-500 text-green-500"
              )}
            >
              {collapsed ? environment.charAt(0) : environment}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="right">
            <DropdownMenuLabel>Environment</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(['DEV', 'STAGING', 'PROD'] as Environment[]).map((env) => (
              <DropdownMenuItem key={env} onClick={() => setEnvironment(env)}>
                {env}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className={cn("w-full gap-2", collapsed && "px-0")}>
              <User className="h-4 w-4" />
              {!collapsed && <span className="truncate text-xs">{role.replace(/_/g, ' ')}</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="right">
            <DropdownMenuLabel>Current Role: {role.replace(/_/g, ' ')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(['BOARD_VIEWER', 'OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER', 'POLICY_AUTHOR', 'SYSTEM_ADMIN'] as UserRole[]).map((r) => (
              <DropdownMenuItem key={r} onClick={() => setRole(r)}>
                Switch to {r.replace(/_/g, ' ')}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
