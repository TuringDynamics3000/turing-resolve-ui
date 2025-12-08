import { SideNav } from "./SideNav"
import { TopBar } from "./TopBar"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100">
      <SideNav />
      <div className="flex flex-col flex-1">
        <TopBar />
        <main className="p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
