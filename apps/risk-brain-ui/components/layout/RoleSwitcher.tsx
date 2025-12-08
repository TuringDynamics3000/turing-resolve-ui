"use client"

export function RoleSwitcher() {
  function setRole(role: string) {
    if (typeof window !== "undefined") {
      localStorage.setItem("demo_role", role)
      window.location.reload()
    }
  }

  const currentRole = typeof window !== "undefined" 
    ? localStorage.getItem("demo_role") || "operator"
    : "operator"

  return (
    <div className="flex gap-2 items-center">
      <span className="text-sm text-neutral-400">Switch Role:</span>
      {["operator", "board", "regulator", "developer"].map((r) => (
        <button
          key={r}
          onClick={() => setRole(r)}
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
