/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  staticPageGenerationTimeout: 180,
  experimental: {
    serverComponentsExternalPackages: ['mongoose'],
    cpus: 4
  },
  poweredByHeader: false,
  reactStrictMode: true,
  swcMinify: true
};

module.exports = nextConfig;