/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    // Pre-existing lint warnings don't block production builds
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
