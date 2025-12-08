"use client"

import { useState } from "react"
import { PdfViewer } from "./PdfViewer"

export function DocumentTable({ docs }: { docs: any[] }) {
  const [activeDoc, setActiveDoc] = useState<string | null>(null)

  return (
    <div>
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
            {docs.map((doc) => (
              <tr key={doc.url} className="border-b border-neutral-800 hover:bg-neutral-800">
                <td className="py-3 px-4">{doc.week || doc.period}</td>
                <td className="py-3 px-4">{doc.tenant}</td>
                <td className="py-3 px-4">{doc.generated_at}</td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => setActiveDoc(doc.url)}
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    View PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeDoc && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-neutral-900 p-4 rounded w-[90vw] h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Document Viewer</h3>
              <button
                onClick={() => setActiveDoc(null)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <PdfViewer url={activeDoc} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
