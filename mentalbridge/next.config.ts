import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  devIndicators: false,
  agentRules: false,
  distDir: process.env.NEXT_DEV_DIST_DIR ?? '.next',
  output: 'standalone',
  typescript: {
    tsconfigPath: process.env.NEXT_DEV_TSCONFIG ?? 'tsconfig.json',
  },
  turbopack: {
    root: process.cwd(),
  },
}

export default nextConfig
