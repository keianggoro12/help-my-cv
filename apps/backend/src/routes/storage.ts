import type { Env } from "../lib/helpers";
import { json } from "../lib/helpers";
import type { AppVariables } from "../middleware/auth";
import { Hono } from "hono";

type AppEnv = { Bindings: Env; Variables: AppVariables };

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

function newId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const storageRoutes = new Hono<AppEnv>();

// Writes require a session; reads do not. An `<img src>` request carries no
// Authorization header, so gating the GET behind `requireAuth` made every
// stored avatar render as a broken image. Object keys are
// `uploads/<userId>/<timestamp>_<12 random bytes>.<ext>`, which are not
// guessable, so a public read is safe here.
storageRoutes.post("/upload", async (c) => {
  if (!c.get("user")) {
    return json({ error: "unauthenticated" }, 401);
  }
  const form = await c.req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return json({ error: "file_missing" }, 400);
  }
  if (!ALLOWED.includes(file.type)) {
    return json({ error: "file_type" }, 422);
  }
  if (file.size > MAX_SIZE) {
    return json({ error: "file_too_large" }, 413);
  }
  const ext = file.type.split("/")[1] || "bin";
  const key = `uploads/${c.get("user").id}/${Date.now()}_${newId()}.${ext}`;
  await c.env.R2.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });
  return json({ key, url: `/api/storage/${key}` });
});

storageRoutes.get("/*", async (c) => {
  const key = c.req.path.replace("/api/storage/", "");
  if (!key) return json({ error: "not_found" }, 404);
  const obj = await c.env.R2.get(key);
  if (!obj) return json({ error: "not_found" }, 404);
  const headers = new Headers();
  headers.set("Content-Type", obj.httpMetadata?.contentType || "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=31536000");
  return new Response(obj.body, { headers });
});