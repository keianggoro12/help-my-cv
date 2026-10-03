const proxyExternalRequest = () =>
  import("./overrides/proxy-external-request").then((m) => m.default);

const config: any = {
  default: {
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
      // Strips the incoming `Host` header before proxying an external rewrite,
      // otherwise Cloudflare 404s the proxied request instead of routing it to
      // the backend worker. See overrides/proxy-external-request.ts.
      proxyExternalRequest,
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "dummy",
    },
  },
  edgeExternals: ["node:crypto"],
  middleware: {
    external: true,
    override: {
      wrapper: "cloudflare-edge",
      converter: "edge",
      // The external rewrite is resolved in the middleware handler, so it needs
      // the same Host-stripping proxy as the server function above.
      proxyExternalRequest,
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "dummy",
    },
  },
  cloudflare: {
    // `ensureCloudflareConfig` only accepts the literal string "fetch" for
    // `proxyExternalRequest`, but the proxy used here is a lazy-loaded
    // function override that strips `Host`. Skip the shape check.
    dangerousDisableConfigValidation: true,
  },
};

export default config;
