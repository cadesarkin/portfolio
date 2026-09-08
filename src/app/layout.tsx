import type { Metadata } from "next"
import { IBM_Plex_Mono } from "next/font/google"
import { IDENTITY, SUMMARY } from "@/lib/resume"
import "./globals.css"

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
})

export const metadata: Metadata = {
  metadataBase: new URL("https://cadesarkin.com"),
  title: "Cade Sarkin — Software Engineer",
  description: SUMMARY,
  openGraph: {
    title: "Cade Sarkin — Software Engineer",
    description: SUMMARY,
    url: "https://cadesarkin.com",
    siteName: "Cade Sarkin",
    type: "profile",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cade Sarkin — Software Engineer",
    description: SUMMARY,
  },
}

const personLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: IDENTITY.name,
  jobTitle: IDENTITY.role,
  email: `mailto:${IDENTITY.email}`,
  url: "https://cadesarkin.com",
  address: { "@type": "PostalAddress", addressLocality: "Brooklyn", addressRegion: "NY" },
  sameAs: [IDENTITY.github, IDENTITY.linkedin],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={ibmPlexMono.className}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }}
        />
        {children}
      </body>
    </html>
  )
}
