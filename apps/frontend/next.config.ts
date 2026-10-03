import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // `next dev` and `next build` both write `.next` by default, so running a
  // build while the dev server is up deletes the vendor chunks the server is
  // serving from and every route starts returning 500. Dev gets its own
  // directory so the two can be run in either order.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // packages/shared is consumed as raw TypeScript source (its package.json
  // "main" points at src/index.ts) so the editor and typecheck stay in sync
  // without a build step.
  transpilePackages: ["@helpmycv/shared"],
  // This machine also has a lockfile at ~/package-lock.json, and Next picks
  // the outermost one as the tracing root, which pulls the wrong tree into the
  // standalone output. Pinning it to the monorepo root removes the ambiguity.
  outputFileTracingRoot: path.join(import.meta.dirname, "..", ".."),
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8788";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
