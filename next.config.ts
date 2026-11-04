import type { NextConfig } from 'next';

/**
 * Static export: the whole site is rendered to files at build time and served
 * by GitHub Pages. There is no server, so there is nothing to pay for and
 * nothing to keep running — the price data is committed JSON under
 * `public/data/`, produced by the scheduled refresh job.
 *
 * A project site lives at /<repo>, so every link and asset needs that prefix.
 * Set NEXT_PUBLIC_BASE_PATH in CI; leave it empty for local development.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  // Pages serves /path/ as /path/index.html.
  trailingSlash: true,
  images: {
    // No image optimiser without a server.
    unoptimized: true,
  },
};

export default nextConfig;
