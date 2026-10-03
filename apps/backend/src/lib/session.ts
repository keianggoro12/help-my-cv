/**
 * Session tokens: opaque random strings in a `sessions` table rather than
 * signed JWTs.
 *
 * A Worker cannot read a secret from the environment without it being in
 * wrangler.toml, and a leaked signing key invalidates every session at once.
 * Opaque tokens are revocable per row, which is what an admin "sign out
 * everywhere" needs and what the admin dashboard will want to show.
 */

import type { Env } from "./helpers";

const SESSION_TTL_DAYS = 30;

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createSession(db: D1Database, userId: string): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = toHex(bytes.buffer);

  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000).toISOString();
  await db
    .prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(token, userId, expiresAt)
    .run();

  return token;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
}

/** Resolves a bearer token to its user, or null when absent/expired. */
export async function resolveSession(env: Env, token: string): Promise<SessionUser | null> {
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > ?`,
  )
    .bind(token, new Date().toISOString())
    .first<SessionUser>();

  return row ?? null;
}

export function bearerToken(header: string | null | undefined): string | null {
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const token = header.slice(7).trim();
  return token === "" ? null : token;
}

export async function deleteSession(env: Env, token: string): Promise<void> {
  await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
}

export async function purgeExpiredSessions(env: Env): Promise<void> {
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?")
    .bind(new Date().toISOString())
    .run();
}