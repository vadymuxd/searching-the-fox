/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
  },
  // Ensure proper SSR with Mantine
  transpilePackages: ['@mantine/core', '@mantine/hooks', '@mantine/form', '@mantine/notifications'],
  // Exclude the Python service directory to avoid symlink issues
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/jobspy-service/**', '**/docs/**', '**/.git/**'],
    }
    return config
  },
}

module.exports = nextConfig
