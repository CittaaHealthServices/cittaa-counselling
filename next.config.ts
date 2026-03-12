import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mongoose'],
  },
  images: {
    domains: ['storage.googleapis.com'],
  },
}

export default nextConfig
