import { ReactNode } from "react";
import { GlobalNav } from "./GlobalNav";
import { RoleProvider } from "@/contexts/RoleContext";

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <RoleProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <GlobalNav />
        <main className="flex-1 container py-6">
          {children}
        </main>
      </div>
    </RoleProvider>
  );
}
