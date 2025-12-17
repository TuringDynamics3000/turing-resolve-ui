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
  Settings, 
  User, 
  Lock, 
  TrendingUp,
  CreditCard,
  Wallet,
  Building2,
  Database,
  FileCheck,
  Brain,
} from "lucide-react";

export function GlobalNav() {
  const { role, setRole, environment, setEnvironment, isLedgerFrozen } = useRole();
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Overview", icon: LayoutDashboard, roles: ['BOARD_VIEWER', 'OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER', 'POLICY_AUTHOR', 'SYSTEM_ADMIN'] },
    { href: "/resolve", label: "Resolve", icon: Shield, roles: ['OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER', 'POLICY_AUTHOR'] },
    { href: "/lending", label: "Lending", icon: CreditCard, roles: ['OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER'] },
    { href: "/payments", label: "Payments", icon: Wallet, roles: ['OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER'] },
    { href: "/deposits", label: "Deposits", icon: Building2, roles: ['OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER'] },
    { href: "/exposure", label: "Exposure", icon: TrendingUp, roles: ['OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER', 'BOARD_VIEWER'] },
    { href: "/reporting", label: "Reporting", icon: FileText, roles: ['OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER', 'BOARD_VIEWER'] },
    { href: "/ml-models", label: "ML Models", icon: Brain, roles: ['OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER', 'SYSTEM_ADMIN'] },
    { href: "/evidence", label: "Evidence", icon: FileCheck, roles: ['COMPLIANCE_VIEWER', 'OPS_SUPERVISOR', 'BOARD_VIEWER'] },
    { href: "/governance", label: "Governance", icon: Lock, roles: ['COMPLIANCE_VIEWER', 'BOARD_VIEWER', 'SYSTEM_ADMIN'] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(role));

  return (
    <header className="sticky top-0 z-50 w-full border-b border-blue-500/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
              <Database className="h-5 w-5 text-white" />
            </div>
            <span className="hidden font-bold sm:inline-block bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              TuringDynamics Core
            </span>
          </Link>
          <nav className="flex items-center space-x-1 text-sm font-medium">
            {filteredNavItems.map((item) => {
              const isActive = location === item.href || 
                (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all",
                    isActive 
                      ? "bg-blue-500/20 text-blue-400" 
                      : "text-foreground/60 hover:text-foreground hover:bg-secondary/50"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            {/* Search could go here */}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 border-blue-500/30 text-blue-400 bg-blue-500/10">
              <Lock className="h-3 w-3" />
              v1.0-replacement-ready
            </Badge>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={cn(
                  "gap-2",
                  environment === 'PROD' ? "border-red-500 text-red-500" : 
                  environment === 'STAGING' ? "border-yellow-500 text-yellow-500" : 
                  "border-green-500 text-green-500"
                )}>
                  {environment}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Environment</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(['DEV', 'STAGING', 'PROD'] as Environment[]).map((env) => (
                  <DropdownMenuItem key={env} onClick={() => setEnvironment(env)}>
                    {env}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Current Role: {role.replace('_', ' ')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(['BOARD_VIEWER', 'OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER', 'POLICY_AUTHOR', 'SYSTEM_ADMIN'] as UserRole[]).map((r) => (
                  <DropdownMenuItem key={r} onClick={() => setRole(r)}>
                    Switch to {r.replace('_', ' ')}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
