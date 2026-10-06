import type { CreateResumePayload, Resume } from "@helpmycv/shared";
import { Hono } from "hono";

import type { Env } from "../lib/helpers";
import { json } from "../lib/helpers";
import type { AppVariables } from "../middleware/auth";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { handleLogin, handleLogout, handleRegister, handleUpdateProfile } from "./auth";
import { handleGenerate } from "./auto-resume";
import {
  handleAiConfigCheck,
  handleAiConfigGet,
  handleAiConfigPut,
  handleAiLogs,
} from "../lib/ai";
import {
  deleteUser,
  listAllResumes,
  listUsers,
  overview,
  promoteUser,
  updateUser,
} from "./admin";
import { storageRoutes } from "./storage";
import {
  adminDeleteResume,
  adminGetResume,
  adminUpdateResume,
  createResume,
  deleteResume,
  getResume,
  listResumes,
  updateResume,
} from "./resumes";

type AppEnv = { Bindings: Env; Variables: AppVariables };

/** Public: anyone with credentials can sign up or in. */
export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/register", (c) => handleRegister(c.env, c.req.raw));
authRoutes.post("/login", (c) => handleLogin(c.env, c.req.raw));
authRoutes.post("/logout", (c) => handleLogout(c.env, c.req.raw));
// Profile edits need a session, so this one sits behind the guard rather than
// answering 401 itself like `/me` does.
authRoutes.patch("/me", requireAuth, (c) => handleUpdateProfile(c.env, c.req.raw, c.get("user")));
authRoutes.get("/me", (c) => {
  const user = c.get("user");
  // No middleware here on purpose: `/me` has to answer 401 for an absent
  // session rather than fall through to the app-level guard, otherwise the
  // client cannot tell "signed out" from "wrong endpoint".
  return user ? json({ user }) : json({ error: "unauthenticated" }, 401);
});

/**
 * Private: every handler runs behind `requireAuth` and scopes its query to
 * `user_id`, so a forged resume id in the path returns 404 rather than someone
 * else's CV.
 */
export const resumeRoutes = new Hono<AppEnv>();

resumeRoutes.use("*", requireAuth);

resumeRoutes.get("/", (c) => listResumes(c.env, c.get("user").id));

resumeRoutes.post("/", async (c) => {
  let title = "Untitled CV";
  try {
    const body = (await c.req.json()) as CreateResumePayload;
    if (typeof body.title === "string" && body.title.trim() !== "") {
      title = body.title.trim();
    }
  } catch {
    // A body-less POST still creates a CV; the title is editable afterwards.
  }
  return createResume(c.env, c.get("user"), title);
});

resumeRoutes.get("/:id", (c) => getResume(c.env, c.get("user").id, c.req.param("id")));

resumeRoutes.patch("/:id", async (c) => {
  let body: { title?: string; document?: Resume };
  try {
    body = (await c.req.json()) as { title?: string; document?: Resume };
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  return updateResume(c.env, c.get("user").id, c.req.param("id"), body);
});

resumeRoutes.delete("/:id", (c) => deleteResume(c.env, c.get("user").id, c.req.param("id")));

export { storageRoutes };

/**
 * Auto CV: a signed-in user describes the CV they want, the engine runs the
 * configured model and inserts the resume. The route only validates the text it
 * is about to spend money on; the provider itself is what fails with a code.
 */
export const aiRoutes = new Hono<AppEnv>();

aiRoutes.use("*", requireAuth);
aiRoutes.post("/generate", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  return handleGenerate(c.env, c.get("user"), body);
});


/**
 * Admin: overview plus the actions an admin is expected to take on other
 * people's CVs and accounts, all gated by `requireAdmin` so a normal session
 * gets 403 rather than a filtered response.
 *
 * The resume routes live under `/api/admin` rather than extending
 * `/api/resumes/:id`. That is not cosmetic: the owner-scoped endpoints answer
 * 404 for anyone but the owner, which is the correct answer for a user and the
 * wrong one for an admin sitting on this screen. Keeping them apart means the
 * owner check stays in one place and the admin capability is explicit in the
 * route table instead of hiding behind a role check inside a query.
 */
export const adminRoutes = new Hono<AppEnv>();

adminRoutes.use("*", requireAdmin);

adminRoutes.get("/overview", (c) => overview(c.env));
adminRoutes.get("/users", (c) => listUsers(c.env));
adminRoutes.get("/resumes", (c) => listAllResumes(c.env));

adminRoutes.post("/users/:id/promote", (c) => promoteUser(c.env, c.req.param("id")));
adminRoutes.delete("/users/:id", (c) => deleteUser(c.env, c.req.param("id")));
adminRoutes.patch("/users/:id", async (c) => {
  let body: { name?: string; role?: string; imageUrl?: string | null };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  return updateUser(c.env, c.get("user").id, c.req.param("id"), body);
});

adminRoutes.get("/resumes/:id", (c) => adminGetResume(c.env, c.req.param("id")));
adminRoutes.delete("/resumes/:id", (c) => adminDeleteResume(c.env, c.req.param("id")));
adminRoutes.patch("/resumes/:id", async (c) => {
  let body: { title?: string; document?: Resume };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  return adminUpdateResume(c.env, c.req.param("id"), body);
});

/**
 * Config: the AI settings Auto CV runs on, plus the log panel below them. The
 * read never returns the stored key, only whether one exists, so a screenshot
 * of this screen cannot leak it.
 */
adminRoutes.get("/ai/config", (c) => handleAiConfigGet(c.env));

adminRoutes.put("/ai/config", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  return handleAiConfigPut(c.env, body);
});

adminRoutes.post("/ai/config/check", (c) => handleAiConfigCheck(c.env, c.get("user")));

adminRoutes.get("/ai/logs", (c) => handleAiLogs(c.env));