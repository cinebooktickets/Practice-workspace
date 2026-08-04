/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Known vulnerabilities in next@14 — acceptable for dev, upgrade to Next.js 15 before production
  async headers() {
    return [
      {
        source: '/widget.js',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: 'http://localhost:3001',
          },
        ],
      },
    ]
  },
}
module.exports = nextConfig