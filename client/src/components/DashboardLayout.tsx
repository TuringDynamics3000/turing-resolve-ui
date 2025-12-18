import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { RoleProvider } from "@/contexts/RoleContext";
import { cn } from "@/lib/utils";

export function DashboardLayout({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <RoleProvider>
      <div className="min-h-screen bg-background">
        <Sidebar 
          collapsed={sidebarCollapsed} 
          onCollapsedChange={setSidebarCollapsed} 
        />
        <main 
          className={cn(
            "min-h-screen transition-all duration-300",
            sidebarCollapsed ? "ml-16" : "ml-64"
          )}
        >
          <div className="container py-6 px-6">
            {children}
          </div>
        </main>
      </div>
    </RoleProvider>
  );
}
