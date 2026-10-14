/** @type {import('next').NextConfig} */
const nextConfig = {
  // Upload audio limit
  api: {
    bodyParser: { sizeLimit: '30mb' },
  },

  experimental: {
    // Prisma cần server components external
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },

  // Serve local uploads as static files
  // Khi STORAGE_PROVIDER=local, files nằm trong public/uploads/
  // Nginx có thể serve trực tiếp thư mục này khi production
  async headers() {
    return [
      {
        source: '/uploads/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
}

module.exports = nextConfig
