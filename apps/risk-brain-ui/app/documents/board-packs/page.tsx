"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { DocumentTable } from "@/components/documents/DocumentTable"

export default function BoardPacksPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["board-packs"],
    queryFn: api.boardPacks,
  })

  if (isLoading) return <div>Loading…</div>

  if (!data) return <div>No data available</div>

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Board Packs</h2>
      <DocumentTable docs={data as any[]} />
    </div>
  )
}
