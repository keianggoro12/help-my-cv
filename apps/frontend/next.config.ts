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
    // `NEXT_PUBLIC_API_BASE_URL` has to be set for a production build: it is the
    // rewrite destination baked into the server bundle, and the deployed Worker
    // resolves `/api/*` through the `BACKEND` service binding by hostname.
    //
    // The localhost fallback below is for `next dev` only. It is actively
    // dangerous in a deploy, because an empty string is falsy and
    // `"" || "http://localhost:8788"` silently yields localhost — the Worker
    // then tries to fetch a loopback address it cannot route and Cloudflare
    // answers every `/api/*` request with error 1003, "Direct IP access not
    // allowed". A build that looks fine and only fails in production. So refuse
    // to build for production with the variable missing.
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    if (!apiUrl && process.env.NODE_ENV === "production") {
      throw new Error(
        "NEXT_PUBLIC_API_BASE_URL must be set when building for production " +
          `(got ${JSON.stringify(apiUrl)}). It is the rewrite destination for /api/*.`,
      );
    }

    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl || "http://localhost:8788"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
