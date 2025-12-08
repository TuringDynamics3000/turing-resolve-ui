"use client"

import { getDemoRole } from "@/lib/auth"
import { RoleSwitcher } from "./RoleSwitcher"

export function TopBar() {
  const role = getDemoRole()
  
  return (
    <header className="bg-neutral-900 border-b border-neutral-800 px-6 py-4 flex justify-between items-center">
      <h1 className="text-lg font-semibold">Risk Brain Governance Console</h1>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-400">Current Role:</span>
          <span className="px-3 py-1 bg-neutral-800 rounded text-sm font-medium">
            {role}
          </span>
        </div>
        <RoleSwitcher />
      </div>
    </header>
  )
}
