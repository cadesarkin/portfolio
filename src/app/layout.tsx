import type { Metadata } from "next"
import { IBM_Plex_Mono } from "next/font/google"
import "./globals.css"

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300"],
})

export const metadata: Metadata = {
  title: "Cade Sarkin",
  description: "Portfolio website for Cade Sarkin",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={ibmPlexMono.className}>
        {children}
      </body>
    </html>
  )
}
