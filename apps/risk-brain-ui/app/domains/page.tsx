"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

export default function DomainsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["domains"],
    queryFn: api.domains,
  })

  if (isLoading) return <div>Loading…</div>

  if (!data) return <div>No data available</div>

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Domain Status</h2>
      
      <div className="space-y-3">
        {Object.entries(data as any).map(([name, d]: any) => (
          <div key={name} className="bg-neutral-800 p-6 rounded">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{name.toUpperCase()}</h3>
              <span className={`px-3 py-1 rounded text-sm ${d.enabled ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                {d.enabled ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-neutral-400">Events (24h)</div>
                <div className="text-xl font-semibold">{d.events_24h || 0}</div>
              </div>
              <div>
                <div className="text-sm text-neutral-400">Advisories (24h)</div>
                <div className="text-xl font-semibold">{d.advisories_24h || 0}</div>
              </div>
              <div>
                <div className="text-sm text-neutral-400">Coverage</div>
                <div className="text-xl font-semibold">{d.coverage || '0%'}</div>
              </div>
              <div>
                <div className="text-sm text-neutral-400">Avg Confidence</div>
                <div className="text-xl font-semibold">{d.avg_confidence || '0%'}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
