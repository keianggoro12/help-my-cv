import { createRequire as topLevelCreateRequire } from 'module';const require = topLevelCreateRequire(import.meta.url);import bannerUrl from 'url';const __dirname = bannerUrl.fileURLToPath(new URL('.', import.meta.url));
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// overrides/proxy-external-request.ts
var proxy_external_request_exports = {};
__export(proxy_external_request_exports, {
  default: () => proxy_external_request_default
});
function getBindings() {
  const context = globalThis[Symbol.for("__cloudflare-context__")];
  return context?.env ?? {};
}
function emptyReadableStream() {
  return new ReadableStream({
    start(controller) {
      controller.close();
    }
  });
}
var SERVICE_BINDINGS, fetchProxy, proxy_external_request_default;
var init_proxy_external_request = __esm({
  "overrides/proxy-external-request.ts"() {
    "use strict";
    SERVICE_BINDINGS = {
      "helpmycv-backend-production.keianggoro12.workers.dev": "BACKEND"
    };
    fetchProxy = {
      name: "fetch-proxy-service-binding",
      // @ts-ignore - matches the loose shape the OpenNext overrides expect
      proxy: async (internalEvent) => {
        const { url, method, body } = internalEvent;
        const headers = new Headers();
        for (const [key, value] of Object.entries(internalEvent.headers)) {
          const lower = key.toLowerCase();
          if (lower === "host" || lower === "cf-connecting-ip") continue;
          headers.set(key, value);
        }
        const init = {
          method,
          headers,
          body
        };
        const bindingName = SERVICE_BINDINGS[new URL(url).hostname];
        const binding = bindingName ? getBindings()[bindingName] : void 0;
        const response = binding ? await binding.fetch(url, init) : await fetch(url, init);
        const responseHeaders = {};
        response.headers.forEach((value, key) => {
          const cur = responseHeaders[key];
          if (cur === void 0) {
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
          body: response.body ?? emptyReadableStream()
        };
      }
    };
    proxy_external_request_default = fetchProxy;
  }
});

// open-next.config.ts
var proxyExternalRequest = () => Promise.resolve().then(() => (init_proxy_external_request(), proxy_external_request_exports)).then((m) => m.default);
var config = {
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
      queue: "dummy"
    }
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
      queue: "dummy"
    }
  },
  cloudflare: {
    // `ensureCloudflareConfig` only accepts the literal string "fetch" for
    // `proxyExternalRequest`, but the proxy used here is a lazy-loaded
    // function override that strips `Host`. Skip the shape check.
    dangerousDisableConfigValidation: true
  }
};
var open_next_config_default = config;
export {
  open_next_config_default as default
};
