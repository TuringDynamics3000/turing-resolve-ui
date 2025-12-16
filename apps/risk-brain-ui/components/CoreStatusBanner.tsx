"use client"

import { useQuery } from "@tanstack/react-query"

interface CoreStatus {
  turingCoreCommit: string
  depositsCoreHash: string
  paymentsCoreHash: string
  shadowParity: "PASS" | "FAIL" | "UNKNOWN"
}

async function fetchCoreStatus(): Promise<CoreStatus> {
  const res = await fetch("http://localhost:8080/api/v1/ui/system/core-status")
  if (!res.ok) throw new Error("Failed to fetch core status")
  return res.json()
}

export function CoreStatusBanner() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["core-status"],
    queryFn: fetchCoreStatus,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  if (isLoading) {
    return (
      <div className="border rounded p-3 bg-slate-50 animate-pulse">
        <strong>Core Equivalence</strong>
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="border rounded p-3 bg-red-50 border-red-200">
        <strong className="text-red-700">Core Equivalence</strong>
        <p className="text-sm text-red-600">Unable to verify core status</p>
      </div>
    )
  }

  return (
    <div className="border rounded p-3 bg-slate-50">
      <strong>Core Equivalence</strong>
      <ul className="text-sm mt-2 space-y-1">
        <li>
          <span className="text-slate-500">TuringCore:</span>{" "}
          <code className="bg-slate-200 px-1 rounded">{data.turingCoreCommit}</code>
        </li>
        <li>
          <span className="text-slate-500">Deposits Core:</span>{" "}
          <code className="bg-slate-200 px-1 rounded">{data.depositsCoreHash}</code>
        </li>
        <li>
          <span className="text-slate-500">Payments Core:</span>{" "}
          <code className="bg-slate-200 px-1 rounded">{data.paymentsCoreHash}</code>
        </li>
        <li>
          <span className="text-slate-500">Shadow Parity:</span>{" "}
          <span
            className={
              data.shadowParity === "PASS"
                ? "text-green-600 font-semibold"
                : data.shadowParity === "FAIL"
                ? "text-red-600 font-semibold"
                : "text-amber-600 font-semibold"
            }
          >
            {data.shadowParity}
          </span>
        </li>
      </ul>
    </div>
  )
}
