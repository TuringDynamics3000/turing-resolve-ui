import Link from "next/link"

export function SideNav() {
  return (
    <nav className="w-64 bg-neutral-900 p-4 space-y-3">
      <div className="mb-8 text-xl font-bold text-neutral-100">
        Risk Brain
      </div>
      <Link href="/system" className="block px-4 py-2 rounded hover:bg-neutral-800 transition">
        System
      </Link>
      <Link href="/domains" className="block px-4 py-2 rounded hover:bg-neutral-800 transition">
        Domains
      </Link>
      <Link href="/twin" className="block px-4 py-2 rounded hover:bg-neutral-800 transition">
        Digital Twin
      </Link>
      <Link href="/documents/board-packs" className="block px-4 py-2 rounded hover:bg-neutral-800 transition">
        Board Packs
      </Link>
      <Link href="/documents/regulator-annexes" className="block px-4 py-2 rounded hover:bg-neutral-800 transition">
        Regulator Annexes
      </Link>
    </nav>
  )
}
