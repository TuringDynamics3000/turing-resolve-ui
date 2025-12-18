import { useLocation, Link } from "wouter";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href: string;
}

const routeLabels: Record<string, string> = {
  "": "Overview",
  "resolve": "Resolve",
  "cases": "Cases",
  "lending": "Lending",
  "payments": "Payments",
  "deposits": "Deposits",
  "wallets": "Wallets",
  "exposure": "Exposure",
  "reporting": "Reporting",
  "ml-models": "ML Models",
  "evidence": "Evidence",
  "sentinel": "TuringSentinel",
  "gl": "GL Ledger",
  "ecl": "ECL",
  "operations": "Operations",
  "apra": "APRA",
  "compare": "Compare Decisions",
  "simulator": "What-If Simulator",
  "compliance": "Compliance Reports",
  "member": "Member Portal",
  "activity": "Activity",
  "savers": "Savers",
  "transfer": "Transfer",
  "limits": "Limits",
  "profile": "Profile",
  "ops": "Ops Console",
  "health": "System Health",
};

export function Breadcrumb() {
  const [location] = useLocation();
  
  // Don't show breadcrumb on home page
  if (location === "/") return null;
  
  const segments = location.split("/").filter(Boolean);
  
  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Home", href: "/" }
  ];
  
  let currentPath = "";
  segments.forEach((segment) => {
    currentPath += `/${segment}`;
    const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
    breadcrumbs.push({ label, href: currentPath });
  });

  return (
    <nav 
      aria-label="Breadcrumb" 
      className="flex items-center gap-1 text-sm text-slate-400 mb-4"
    >
      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1;
        const isFirst = index === 0;
        
        return (
          <div key={item.href} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
            )}
            {isLast ? (
              <span className="text-slate-200 font-medium">
                {isFirst && <Home className="h-3.5 w-3.5 inline mr-1" />}
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className={cn(
                  "hover:text-slate-200 transition-colors",
                  isFirst && "flex items-center gap-1"
                )}
              >
                {isFirst && <Home className="h-3.5 w-3.5" />}
                {!isFirst && item.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
