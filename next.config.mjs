/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel ignores `output: 'standalone'` and, on Next 16.3+, a hardcoded
  // standalone value crashes the Vercel build (ENOENT next-server.js.nft.json).
  // Keep standalone only for non-Vercel (Docker) deploys.
  output: process.env.VERCEL ? undefined : 'standalone',
  images: {
    // Allow the explicit quality={70} used in a couple of images instead of
    // being coerced to the Next 16 default of 75.
    qualities: [70, 75],
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:4000/api/v1/:path*',
      },
    ];
  },
};

export default nextConfig;
