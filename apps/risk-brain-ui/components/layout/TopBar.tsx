"use client"

import { useEffect, useState } from "react"
import { getDemoRole } from "@/lib/auth"
import { RoleSwitcher } from "./RoleSwitcher"

export function TopBar() {
  const [role, setRole] = useState<string>("operator")
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
    setRole(getDemoRole())
  }, [])
  
  // Prevent hydration mismatch by not rendering role until client-side
  if (!mounted) {
    return (
      <header className="bg-neutral-900 border-b border-neutral-800 px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-semibold">Risk Brain Governance Console</h1>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-400">Current Role:</span>
            <span className="px-3 py-1 bg-neutral-800 rounded text-sm font-medium">
              Loading...
            </span>
          </div>
          <RoleSwitcher />
        </div>
      </header>
    )
  }
  
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
