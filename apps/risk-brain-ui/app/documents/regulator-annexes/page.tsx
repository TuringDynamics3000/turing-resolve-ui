"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { DocumentTable } from "@/components/documents/DocumentTable"

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
      <DocumentTable docs={data as any[]} />
    </div>
  )
}
