const BASE = process.env.NEXT_PUBLIC_UI_GATEWAY || "http://localhost:8080/api/v1/ui"

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}

export const api = {
  systemHealth: () => get("/system/health"),
  domains: () => get("/domains"),
  twinScenarios: () => get("/twin/scenarios"),
  boardPacks: () => get("/documents/board-packs"),
  regulatorAnnexes: () => get("/documents/regulator-annexes"),
}
