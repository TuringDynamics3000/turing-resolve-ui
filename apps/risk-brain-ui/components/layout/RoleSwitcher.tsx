"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export function RoleSwitcher() {
  const router = useRouter()
  const [currentRole, setCurrentRole] = useState<string>("operator")
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
    if (typeof window !== "undefined") {
      setCurrentRole(localStorage.getItem("demo_role") || "operator")
    }
  }, [])
  
  function switchRole(role: string) {
    if (typeof window !== "undefined") {
      localStorage.setItem("demo_role", role)
      setCurrentRole(role)
      // Use Next.js router refresh instead of full page reload
      router.refresh()
    }
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="flex gap-2 items-center">
        <span className="text-sm text-neutral-400">Switch Role:</span>
        {["operator", "board", "regulator", "developer"].map((r) => (
          <button
            key={r}
            disabled
            className="px-3 py-1 rounded text-xs bg-neutral-800 opacity-50"
          >
            {r}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-2 items-center">
      <span className="text-sm text-neutral-400">Switch Role:</span>
      {["operator", "board", "regulator", "developer"].map((r) => (
        <button
          key={r}
          onClick={() => switchRole(r)}
          className={`px-3 py-1 rounded text-xs transition ${
            currentRole === r
              ? "bg-blue-600 text-white"
              : "bg-neutral-800 hover:bg-neutral-700"
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  )
}
