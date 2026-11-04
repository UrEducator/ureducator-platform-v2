import type { NextConfig } from 'next';

const backend = process.env.NEXT_PUBLIC_BACKEND ?? 'firebase';
const config: NextConfig = {
  output: 'export',                 // static export: served by Firebase Hosting, no Node server to run or pay for
  trailingSlash: false,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  // Separate output folders so a local test build (mock backend) can never be mistaken for a deployable build.
  distDir: backend === 'mock' ? 'out-mock' : 'out',
  typedRoutes: false,
  transpilePackages: ['@ureducator/shared'],
  // Always defined, so process.env.NEXT_PUBLIC_BACKEND is replaced by a literal at build time and test-only branches are removed.
  env: { NEXT_PUBLIC_BACKEND: backend },
};
export default config;
