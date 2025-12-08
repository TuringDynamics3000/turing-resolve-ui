import type { Metadata } from "next"
import "./globals.css"
import { AppShell } from "@/components/layout/AppShell"
import { QueryProvider } from "@/components/QueryProvider"

export const metadata: Metadata = {
  title: "Risk Brain Governance Console",
  description: "National Risk Brain governance and monitoring console",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <AppShell>{children}</AppShell>
        </QueryProvider>
      </body>
    </html>
  );
}
