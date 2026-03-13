/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mongoose'],
  },

  // ── Performance ──────────────────────────────────────────────────────────
  compress: true,

  // Optimise images (even though we have few)
  images: {
    formats: ['image/webp', 'image/avif'],
  },

  // Cache API responses that don't change often
  async headers() {
    return [
      {
        source: '/api/schools',
        headers: [{ key: 'Cache-Control', value: 's-maxage=60, stale-while-revalidate=300' }],
      },
      {
        source: '/api/dashboard/stats',
        headers: [{ key: 'Cache-Control', value: 's-maxage=30, stale-while-revalidate=60' }],
      },
    ]
  },
}

export default nextConfig
