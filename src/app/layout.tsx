import type { Metadata } from "next"
import { IBM_Plex_Mono } from "next/font/google"
import "./globals.css"

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
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
    <html lang="en" style={{ scrollBehavior: "smooth" }}>
      <body
        className={ibmPlexMono.className}
        style={{ backgroundColor: "#eaeff5", color: "#0d0d0d", minHeight: "100vh" }}
      >
        {children}
      </body>
    </html>
  )
}
