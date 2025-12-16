"use client"

import { Document, Page, pdfjs } from "react-pdf"
import { useState } from "react"
import "react-pdf/dist/esm/Page/AnnotationLayer.css"
import "react-pdf/dist/esm/Page/TextLayer.css"

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

export function PdfViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = useState<number>()
  const [pageNumber, setPageNumber] = useState(1)

  return (
    <div className="bg-neutral-950 p-4 overflow-y-auto max-h-[80vh]">
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-neutral-400">
          Page {pageNumber} of {numPages || "?"}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
            disabled={pageNumber <= 1}
            className="px-3 py-1 bg-neutral-800 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setPageNumber(Math.min(numPages || 1, pageNumber + 1))}
            disabled={pageNumber >= (numPages || 1)}
            className="px-3 py-1 bg-neutral-800 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
      <Document 
        file={url} 
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        className="flex justify-center"
      >
        <Page 
          pageNumber={pageNumber} 
          renderTextLayer={true}
          renderAnnotationLayer={true}
          className="border border-neutral-700"
        />
      </Document>
    </div>
  )
}
