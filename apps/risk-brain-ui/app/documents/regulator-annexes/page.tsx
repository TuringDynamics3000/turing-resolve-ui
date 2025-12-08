"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

export default function RegulatorAnnexesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["regulator-annexes"],
    queryFn: api.regulatorAnnexes,
  })

  if (isLoading) return <div>Loading…</div>

  if (!data) return <div>No data available</div>

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Regulator Annexes</h2>
      
      <div className="bg-neutral-900 p-6 rounded">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-800">
              <th className="text-left py-3 px-4">Period</th>
              <th className="text-left py-3 px-4">Tenant</th>
              <th className="text-left py-3 px-4">Generated</th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data as any[]).map((doc: any) => (
              <tr key={doc.url} className="border-b border-neutral-800 hover:bg-neutral-800">
                <td className="py-3 px-4">{doc.period}</td>
                <td className="py-3 px-4">{doc.tenant}</td>
                <td className="py-3 px-4">{doc.generated_at}</td>
                <td className="py-3 px-4">
                  <a 
                    href={doc.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    View PDF
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
