/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  staticPageGenerationTimeout: 300,
  poweredByHeader: false,
  reactStrictMode: true,
  swcMinify: true,
  images: {
    unoptimized: true
  },
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  // Enable detailed logging in development mode
  webpack: (config, { dev, isServer }) => {
    if (dev || process.env.DEBUG === 'true') {
      config.devtool = 'source-map';
      config.optimization.minimize = false;
    }
    return config;
  }
};

module.exports = nextConfig;