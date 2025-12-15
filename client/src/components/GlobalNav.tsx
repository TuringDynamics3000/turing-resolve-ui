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
import { LayoutDashboard, Shield, Gavel, FileText, Settings, User, Lock, TrendingUp } from "lucide-react";

export function GlobalNav() {
  const { role, setRole, environment, setEnvironment, isLedgerFrozen } = useRole();
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ['BOARD_VIEWER', 'OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER'] },
    { href: "/decisions", label: "Decisions", icon: Gavel, roles: ['OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER'] },
    { href: "/policies", label: "Policies", icon: Shield, roles: ['POLICY_AUTHOR', 'COMPLIANCE_VIEWER', 'SYSTEM_ADMIN'] },
    { href: "/evidence", label: "Evidence", icon: FileText, roles: ['COMPLIANCE_VIEWER', 'OPS_SUPERVISOR'] },
    { href: "/exposure", label: "Exposure", icon: TrendingUp, roles: ['OPS_ANALYST', 'OPS_SUPERVISOR', 'COMPLIANCE_VIEWER', 'BOARD_VIEWER'] },
    { href: "/settings", label: "Settings", icon: Settings, roles: ['SYSTEM_ADMIN'] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(role));

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Shield className="h-6 w-6" />
            <span className="hidden font-bold sm:inline-block">
              Turing Resolve
            </span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {filteredNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "transition-colors hover:text-foreground/80",
                  location === item.href ? "text-foreground" : "text-foreground/60"
                )}
              >
                <span className="flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            {/* Search could go here */}
          </div>
          <div className="flex items-center gap-2">
            {isLedgerFrozen && (
              <Badge variant="outline" className="gap-1 border-blue-500 text-blue-500">
                <Lock className="h-3 w-3" />
                Ledger Frozen
              </Badge>
            )}
            
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
