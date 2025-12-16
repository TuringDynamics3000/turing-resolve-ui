"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

export default function TwinPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["twin"],
    queryFn: api.twinScenarios,
  })

  if (isLoading) return <div>Loading…</div>

  if (!data) return <div>No data available</div>

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Digital Twin Scenarios</h2>
      
      <div className="space-y-3">
        {(data as any[]).map((s: any) => (
          <div key={s.scenario} className="bg-neutral-800 p-6 rounded">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{s.scenario}</h3>
              <span className={`px-3 py-1 rounded text-sm ${
                s.state === 'running' ? 'bg-blue-900 text-blue-300' :
                s.state === 'completed' ? 'bg-green-900 text-green-300' :
                'bg-neutral-700 text-neutral-300'
              }`}>
                {s.state?.toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-neutral-400">Duration</div>
                <div className="text-lg font-semibold">{s.duration || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-neutral-400">Events Generated</div>
                <div className="text-lg font-semibold">{s.events_generated || 0}</div>
              </div>
              <div>
                <div className="text-sm text-neutral-400">Start Time</div>
                <div className="text-sm">{s.start_time || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-neutral-400">End Time</div>
                <div className="text-sm">{s.end_time || 'N/A'}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
