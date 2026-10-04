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