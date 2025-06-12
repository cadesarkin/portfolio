/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: false,
    remotePatterns: [],
  },
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig 