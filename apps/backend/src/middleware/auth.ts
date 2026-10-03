/**
 * Auth middleware.
 *
 * `requireAuth` and `requireAdmin` read the bearer token and stash the resolved
 * user on the context so route handlers never re-query it. A revoked or
 * expired token is 401, not a silent anonymous context — that distinction is
 * what stops a stale client from reading someone else's CV.
 */

import { createMiddleware } from "hono/factory";
import type { Env } from "../lib/helpers";
import { json } from "../lib/helpers";
import { bearerToken, type SessionUser, resolveSession } from "../lib/session";

export interface AppVariables {
  user: SessionUser;
}

type AppEnv = { Bindings: Env; Variables: AppVariables };

export const attachUser = createMiddleware<AppEnv>(async (c, next) => {
  const token = bearerToken(c.req.header("Authorization"));
  if (token) {
    const user = await resolveSession(c.env, token);
    if (user) {
      c.set("user", user);
    }
  }
  await next();
});

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("user")) {
    return json({ error: "unauthenticated" }, 401);
  }
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return json({ error: "unauthenticated" }, 401);
  }
  if (user.role !== "admin") {
    return json({ error: "forbidden" }, 403);
  }
  await next();
});