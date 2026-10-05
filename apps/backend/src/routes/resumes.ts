import type { Resume } from "@helpmycv/shared";
// Aliased: the handler below is also called createResume, and the factory is
// what builds a document in exactly the shape the editor expects.
import { createResume as buildDocument, migrateResume } from "@helpmycv/shared";

import type { Env } from "../lib/helpers";
import { json } from "../lib/helpers";
import type { SessionUser } from "../lib/session";

function newId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

interface ResumeRow {
  id: string;
  user_id: string;
  title: string;
  document: string;
  created_at: string;
  updated_at: string;
}

function toSummary(row: ResumeRow) {
  // `status` lives inside the document, not in a column: the list view renders a
  // draft/final badge and the overview counts by it, so it has to be read back
  // out of the blob rather than defaulting to "draft" for every row.
  let status: "draft" | "final" = "draft";
  try {
    const document = JSON.parse(row.document) as Resume;
    if (document.status === "final") {
      status = "final";
    }
  } catch {
    // A row written by a client that never persisted a parseable document still
    // lists fine; it just shows as a draft.
  }

  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status,
  };
}

export async function listResumes(env: Env, userId: string): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT id, user_id, title, document, created_at, updated_at FROM resumes WHERE user_id = ? ORDER BY updated_at DESC",
  )
    .bind(userId)
    .all<ResumeRow>();

  return json({ resumes: (results ?? []).map(toSummary) });
}

export async function getResume(env: Env, userId: string, resumeId: string): Promise<Response> {
  const row = await env.DB.prepare(
    "SELECT id, user_id, title, document, created_at, updated_at FROM resumes WHERE id = ? AND user_id = ?",
  )
    .bind(resumeId, userId)
    .first<ResumeRow>();

  if (!row) {
    return json({ error: "not_found" }, 404);
  }

  // Parsed and re-migrated on the way out so a document saved by an older
  // client never reaches the editor missing a section.
  const document = migrateResume(JSON.parse(row.document) as Resume);
  return json({ resume: { ...toSummary(row), document } });
}

export async function createResume(
  env: Env,
  user: SessionUser,
  title: string,
): Promise<Response> {
  const id = newId();
  const now = new Date().toISOString();

  // The document is built by the same factory the frontend uses, so a new CV
  // created through the API is byte-for-byte the shape the editor expects.
  const document = buildDocument({
    id,
    userId: user.id,
    title,
    templateId: "blank",
  });

  await env.DB.prepare(
    "INSERT INTO resumes (id, user_id, title, document, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, user.id, title, JSON.stringify(document), now, now)
    .run();

  return json(
    {
      resume: {
        id,
        userId: user.id,
        title,
        createdAt: now,
        updatedAt: now,
        status: document.status,
        document,
      },
    },
    201,
  );
}

export async function updateResume(
  env: Env,
  userId: string,
  resumeId: string,
  body: { title?: string; document?: Resume },
): Promise<Response> {
  const current = await env.DB.prepare(
    "SELECT id, user_id, title, document, created_at, updated_at FROM resumes WHERE id = ? AND user_id = ?",
  )
    .bind(resumeId, userId)
    .first<ResumeRow>();

  if (!current) {
    return json({ error: "not_found" }, 404);
  }

  const title = body.title ?? current.title;
  const existing = JSON.parse(current.document) as Resume;
  // Migrating both sides: the incoming document may predate a section, and the
  // stored one does too. Writing the un-migrated incoming copy would drop a
  // section the editor already shows.
  const document = migrateResume(
    body.document ? { ...body.document, id: resumeId, userId, title } : { ...existing, title },
  );

  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE resumes SET title = ?, document = ?, updated_at = ? WHERE id = ? AND user_id = ?",
  )
    .bind(title, JSON.stringify({ ...document, updatedAt: now }), now, resumeId, userId)
    .run();

  return json({
    resume: {
      id: resumeId,
      userId,
      title,
      createdAt: current.created_at,
      updatedAt: now,
      status: document.status,
    },
  });
}

export async function deleteResume(
  env: Env,
  userId: string,
  resumeId: string,
): Promise<Response> {
  const result = await env.DB.prepare("DELETE FROM resumes WHERE id = ? AND user_id = ?")
    .bind(resumeId, userId)
    .run();

  if (!result.meta.changes) {
    return json({ error: "not_found" }, 404);
  }
  return json({ ok: true });
}

/* ---------------------------------------------------------------------------
 * Admin variants
 *
 * The four functions above all scope to `user_id`, which is what stops one
 * account reading or destroying another's CV by guessing an id. An admin is
 * explicitly meant to work on anyone's CV, but reusing the owner-scoped
 * handlers for that would mean either an `isAdmin` branch inside every query or
 * dropping the owner check — the first spreads the exception through the code
 * that most needs to be uniform, the second weakens the rule for ordinary
 * users.
 *
 * So these are separate functions with no owner predicate at all. They are only
 * reachable from routes mounted behind `requireAdmin`, and they take the
 * caller from the middleware rather than a body or query field, so nothing a
 * client sends can talk them into acting on the wrong account.
 * ------------------------------------------------------------------------- */

export async function adminGetResume(env: Env, resumeId: string): Promise<Response> {
  const row = await env.DB.prepare(
    "SELECT id, user_id, title, document, created_at, updated_at FROM resumes WHERE id = ?",
  )
    .bind(resumeId)
    .first<ResumeRow>();

  if (!row) {
    return json({ error: "not_found" }, 404);
  }
  return json({ resume: { ...toSummary(row), document: migrateResume(JSON.parse(row.document) as Resume) } });
}

export async function adminUpdateResume(
  env: Env,
  resumeId: string,
  body: { title?: string; document?: Resume },
): Promise<Response> {
  const current = await env.DB.prepare(
    "SELECT id, user_id, title, document, created_at, updated_at FROM resumes WHERE id = ?",
  )
    .bind(resumeId)
    .first<ResumeRow>();

  if (!current) {
    return json({ error: "not_found" }, 404);
  }

  const title = body.title ?? current.title;
  const existing = JSON.parse(current.document) as Resume;
  // Same migration on both sides as the owner-scoped path: an admin editing an
  // old CV must not silently drop a section the stored document already has.
  const document = migrateResume(
    body.document
      ? { ...body.document, id: resumeId, userId: current.user_id, title }
      : { ...existing, title },
  );

  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE resumes SET title = ?, document = ?, updated_at = ? WHERE id = ?",
  )
    .bind(title, JSON.stringify({ ...document, updatedAt: now }), now, resumeId)
    .run();

  return json({
    resume: {
      id: resumeId,
      userId: current.user_id,
      title,
      createdAt: current.created_at,
      updatedAt: now,
      status: document.status,
    },
  });
}

export async function adminDeleteResume(env: Env, resumeId: string): Promise<Response> {
  const result = await env.DB.prepare("DELETE FROM resumes WHERE id = ?").bind(resumeId).run();
  if (!result.meta.changes) {
    return json({ error: "not_found" }, 404);
  }
  return json({ ok: true });
}