import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@famileconomy/ui', '@famileconomy/utils', '@famileconomy/types'],
}

export default nextConfig
