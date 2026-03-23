import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    unoptimized: false,
    remotePatterns: [],
  },
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/contact", destination: "/", permanent: false },
      { source: "/projects", destination: "/", permanent: false },
    ]
  },
}

export default nextConfig
