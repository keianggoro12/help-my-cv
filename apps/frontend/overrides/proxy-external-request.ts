/**
 * Proxies an external rewrite to its origin.
 *
 * Two Cloudflare constraints force this override over the stock
 * `@opennextjs/aws` `fetch` proxy:
 *
 * 1. A Worker may not `fetch()` another Worker on `workers.dev`. The rewrite
 *    destination is `https://jastip-backend.<account>.workers.dev/api/*`, so a
 *    plain `fetch` is rejected by Cloudflare and answered with its own "no
 *    route" 404 page. A same-account service binding (`[[services]] BACKEND`
 *    in wrangler.toml) reaches the backend without leaving the account, so
 *    destinations on the bound backend are routed through `env.BACKEND.fetch`.
 *
 * 2. Cloudflare routes an incoming request by its `Host` header. Forwarding the
 *    frontend's `Host` to the backend makes Cloudflare 404 before the request
 *    ever reaches the backend, so `Host` is always stripped.
 *
 * A rewrite destination that is not the bound backend falls back to a plain
 * `fetch` (still with `Host` stripped), matching the stock proxy.
 *
 * `emptyReadableStream` is inlined rather than imported from
 * `@opennextjs/aws/utils/stream.js` because that module pulls in
 * `node:stream/web`, which esbuild cannot resolve for a `platform: "neutral"`
 * build.
 */

/** The hostnames reachable through a service binding, and the binding to use. */
const SERVICE_BINDINGS: Record<string, string> = {
    "helpmycv-backend-production.keianggoro12.workers.dev": "BACKEND",
  };

type ServiceFetcher = {
  fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
};

/**
 * Reads the Worker bindings from the request context that OpenNext's
 * `cloudflare/init.js` exposes via the Workers RPC symbol. The proxy runs
 * inside that context because `worker.js` wraps the whole handler in
 * `runWithCloudflareRequestContext`.
 */
function getBindings(): Record<string, unknown> {
  const context = (globalThis as Record<symbol, unknown>)[
    Symbol.for("__cloudflare-context__")
  ] as { env?: Record<string, unknown> } | undefined;
  return context?.env ?? {};
}

function emptyReadableStream(): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.close();
    },
  });
}

const fetchProxy = {
  name: "fetch-proxy-service-binding",
  // @ts-ignore - matches the loose shape the OpenNext overrides expect
  proxy: async (internalEvent: {
    url: string;
    headers: Record<string, string>;
    method: string;
    body?: unknown;
  }) => {
    const { url, method, body } = internalEvent;

    const headers = new Headers();
    for (const [key, value] of Object.entries(internalEvent.headers)) {
      const lower = key.toLowerCase();
      // `Host` and `cf-connecting-ip` must not be forwarded: Cloudflare routes
      // on `Host` (a mismatched one 404s), and the connecting IP belongs to the
      // edge, not the backend.
      if (lower === "host" || lower === "cf-connecting-ip") continue;
      headers.set(key, value);
    }

    const init: RequestInit = {
      method,
      headers,
      body: body as BodyInit | undefined,
    };

    const bindingName = SERVICE_BINDINGS[new URL(url).hostname];
    const binding = bindingName
      ? (getBindings()[bindingName] as ServiceFetcher | undefined)
      : undefined;

    const response = binding
      ? await binding.fetch(url, init)
      : await fetch(url, init);

    const responseHeaders: Record<string, string | string[]> = {};
    response.headers.forEach((value: string, key: string) => {
      const cur = responseHeaders[key];
      if (cur === undefined) {
        responseHeaders[key] = value;
      } else if (Array.isArray(cur)) {
        cur.push(value);
      } else {
        responseHeaders[key] = [cur, value];
      }
    });

    return {
      type: "core",
      headers: responseHeaders,
      statusCode: response.status,
      isBase64Encoded: true,
      body: response.body ?? emptyReadableStream(),
    };
  },
};

export default fetchProxy;
