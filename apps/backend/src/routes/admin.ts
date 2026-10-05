import type { Env } from "../lib/helpers";
import { json } from "../lib/helpers";

interface CountRow {
  count: number;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

/**
 * Admin endpoints.
 *
 * Mounted behind `requireAdmin`, and every query is a plain SELECT rather than
 * a join on the caller's own id — an admin is meant to see everyone. Nothing
 * here accepts a user id from the request body: acting *on* a user is a
 * different endpoint on purpose, so a compromised admin session cannot be used
 * to escalate another account's role by guessing ids.
 */

export async function overview(env: Env): Promise<Response> {
  const [users, resumes, sessions] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count FROM users").first<CountRow>(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM resumes").first<CountRow>(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM sessions WHERE expires_at > ?")
      .bind(new Date().toISOString())
      .first<CountRow>(),
  ]);

  return json({
    stats: {
      users: users?.count ?? 0,
      resumes: resumes?.count ?? 0,
      activeSessions: sessions?.count ?? 0,
    },
  });
}

export async function listUsers(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id, email, name, role, created_at
       FROM users
      ORDER BY created_at DESC
      LIMIT 200`,
  ).all<UserRow>();

  return json({
    users: (results ?? []).map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      createdAt: row.created_at,
    })),
  });
}

export async function listAllResumes(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.user_id, r.title, r.document, r.created_at, r.updated_at, u.email, u.name
       FROM resumes r
       JOIN users u ON u.id = r.user_id
      ORDER BY r.updated_at DESC
      LIMIT 200`,
  ).all<{
    id: string;
    user_id: string;
    title: string;
    document: string;
    created_at: string;
    updated_at: string;
    email: string;
    name: string;
  }>();

  return json({
    resumes: (results ?? []).map((row) => {
      // Same as the owner-scoped list: the badge comes out of the document blob,
      // and a row whose blob will not parse still lists (as a draft).
      let status: "draft" | "final" = "draft";
      try {
        if ((JSON.parse(row.document) as { status?: string }).status === "final") {
          status = "final";
        }
      } catch {
        // Keep the row; a draft badge is the safe default.
      }

      return {
        id: row.id,
        userId: row.user_id,
        ownerEmail: row.email,
        ownerName: row.name,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        status,
      };
    }),
  });
}

export async function deleteUser(env: Env, userId: string): Promise<Response> {
  const result = await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
  if (!result.meta.changes) {
    return json({ error: "not_found" }, 404);
  }
  // The resumes and sessions go with it through ON DELETE CASCADE, so a deleted
  // account leaves no CVs behind and no live token keeps working.
  return json({ ok: true });
}

export async function promoteUser(env: Env, userId: string): Promise<Response> {
  const result = await env.DB.prepare("UPDATE users SET role = 'admin' WHERE id = ?")
    .bind(userId)
    .run();
  if (!result.meta.changes) {
    return json({ error: "not_found" }, 404);
  }
  return json({ ok: true });
}

/**
 * Edits another account on an admin's behalf.
 *
 * Deliberately a *different* handler from `PATCH /api/auth/me` rather than a
 * shared one with a target id: that endpoint has no id in the path precisely so
 * a client cannot address somebody else's profile, and widening it would throw
 * that away. Here the caller has already been through `requireAdmin`, so the
 * target id comes from the URL and is only ever used to locate the row.
 *
 * Only `name`, `role` and `imageUrl` are writable. `email` is the account's
 * login identity and is left alone for the same reason the self-service endpoint
 * leaves it alone — an admin can already act on a user, but silently changing
 * the address a person signs in with is a different and much less reversible
 * act, and no admin screen asks for it. `password_hash` is not writable at all,
 * so this path cannot be used to take over an account.
 */
export async function updateUser(
  env: Env,
  actorId: string,
  userId: string,
  body: { name?: string; role?: string; imageUrl?: string | null },
): Promise<Response> {
  const updates: string[] = [];
  const values: string[] = [];

  if (typeof body.name === "string" && body.name.trim() !== "") {
    updates.push("name = ?");
    values.push(body.name.trim());
  }
  if (body.role === "admin" || body.role === "user") {
    // Refuse to demote the account performing the request: with two admins the
    // last one standing could remove their own access and lock everyone out of
    // the admin area, and the fix would require direct database access.
    if (body.role === "user" && userId === actorId) {
      return json({ error: "cannot_demote_self" }, 400);
    }
    updates.push("role = ?");
    values.push(body.role);
  }
  if (body.imageUrl === null || typeof body.imageUrl === "string") {
    updates.push("image_url = ?");
    values.push(body.imageUrl ?? "");
  }

  if (updates.length === 0) {
    // Nothing recognised in the body. Treated as bad input rather than a silent
    // success, so a client that sends a typo'd field finds out.
    return json({ error: "nothing_to_update" }, 400);
  }

  values.push(userId);
  const result = await env.DB.prepare(
    `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
  )
    .bind(...values)
    .run();

  if (!result.meta.changes) {
    return json({ error: "not_found" }, 404);
  }
  return json({ user: await readUser(env, userId) });
}

/** Reads one user back in the same shape `listUsers` returns. */
export async function readUser(env: Env, userId: string): Promise<Record<string, unknown> | null> {
  const row = await env.DB.prepare(
    "SELECT id, email, name, role, created_at FROM users WHERE id = ?",
  )
    .bind(userId)
    .first<UserRow>();
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
  };
}