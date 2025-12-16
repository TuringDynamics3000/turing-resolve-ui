"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

export default function SystemPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["system"],
    queryFn: api.systemHealth,
  })

  if (isLoading) return <div>Loading…</div>

  if (!data) return <div>No data available</div>

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">System Health</h2>
      
      <div className="grid grid-cols-4 gap-4">
        {Object.entries((data as any).domains || {}).map(([k, v]) => (
          <div key={k} className="bg-neutral-800 p-4 rounded">
            <div className="text-sm text-neutral-400 mb-1">{k.toUpperCase()}</div>
            <div className="text-lg font-semibold">
              {v ? <span className="text-green-500">ON</span> : <span className="text-red-500">OFF</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-neutral-900 p-6 rounded">
        <h3 className="text-lg font-semibold mb-4">Enforcement Status</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-neutral-400">AI Origin Violations</div>
            <div className="text-2xl font-bold text-green-500">
              {(data as any).enforcement?.ai_origin_violations || 0}
            </div>
          </div>
          <div>
            <div className="text-sm text-neutral-400">Schema Violations</div>
            <div className="text-2xl font-bold text-green-500">
              {(data as any).enforcement?.schema_violations || 0}
            </div>
          </div>
          <div>
            <div className="text-sm text-neutral-400">Policy Violations</div>
            <div className="text-2xl font-bold text-green-500">
              {(data as any).enforcement?.policy_violations || 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
