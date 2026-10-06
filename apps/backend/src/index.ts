import { Hono } from "hono";

import type { Env } from "./lib/helpers";
import { corsPreflight, json } from "./lib/helpers";
import { attachUser } from "./middleware/auth";
import { adminRoutes, aiRoutes, authRoutes, resumeRoutes, storageRoutes } from "./routes";

/**
 * Help My CV API.
 *
 * Mounts everything under `/api` so the frontend's relative `/api/*` calls line
 * up with what this Worker serves. `attachUser` runs app-wide and resolves a
 * bearer token when present but never rejects — the per-route `requireAuth` is
 * what actually gates a route, so a missing session is a 401 from the handler
 * rather than a blanket rejection that would break `/auth/login`.
 */
const app = new Hono<{ Bindings: Env }>();

app.options("*", () => corsPreflight());

app.use("/api/*", attachUser);

app.get("/api/health", (c) => json({ ok: true }));

app.route("/api/auth", authRoutes);
app.route("/api/resumes", resumeRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/storage", storageRoutes);
app.route("/api/ai", aiRoutes);

app.notFound((c) => json({ error: "not_found" }, 404));
app.onError((error, c) => {
  // Log the real error server-side and return a generic message: an exception
  // message can carry SQL detail, and the client cannot act on it anyway.
  console.error("unhandled", error);
  return json({ error: "internal_error" }, 500);
});

export default app;