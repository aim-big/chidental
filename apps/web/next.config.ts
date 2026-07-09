import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @chidental/shared is consumed as TypeScript source (no build step), so Next
  // must transpile it like app code.
  transpilePackages: ['@chidental/shared'],
}

export default nextConfig
