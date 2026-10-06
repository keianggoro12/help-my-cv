/**
 * Auto CV engine.
 *
 * Three jobs: hold the AI settings an admin saved in Config, call whichever
 * provider those settings name, and turn the reply into a `Resume` the editor
 * can open without edits.
 *
 * Two rules shape everything here. The API key is read from D1 and only ever
 * sent to the provider, never back to a client. And a provider failure is a
 * typed `AiCallError` (invalid key, rate limit, network, bad reply) rather than
 * a generic 500, because the Config log has to say which one happened.
 */

import type {
  AiConfig,
  AiLogEntry,
  AiProviderId,
  AutoResumePayload,
  Bullet,
  EducationEntry,
  ExperienceEntry,
  ProjectEntry,
  SkillEntry,
  AchievementEntry,
  CertificationEntry,
  Locale,
  PersonalInfo,
  Resume,
  SectionKey,
} from "@helpmycv/shared";
import { createId, createResume, migrateResume } from "@helpmycv/shared";
import { AI_MODELS } from "@helpmycv/shared";

import type { Env } from "./helpers";
import { json } from "./helpers";
import type { SessionUser } from "./session";

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

export type AiErrorCode =
  | "not_configured"
  | "invalid_key"
  | "rate_limited"
  | "network_error"
  | "provider_error"
  | "invalid_response";

export class AiCallError extends Error {
  readonly code: AiErrorCode;
  /** Provider text (or parse detail) for the log. Never contains the key. */
  readonly detail: string;

  constructor(code: AiErrorCode, detail = "") {
    super(detail || code);
    this.name = "AiCallError";
    this.code = code;
    this.detail = detail;
  }
}

function detailOf(error: unknown): string {
  if (error instanceof AiCallError) return error.detail || error.code;
  if (error instanceof Error) return error.message;
  return String(error);
}

function codeOf(error: unknown): AiErrorCode {
  return error instanceof AiCallError ? error.code : "provider_error";
}

/* -------------------------------------------------------------------------- */
/* Config storage                                                             */
/* -------------------------------------------------------------------------- */

export interface AiConfigRow {
  provider: AiProviderId;
  model: string;
  api_key: string;
  updated_at: string;
}

export async function readAiConfig(env: Env): Promise<AiConfigRow | null> {
  const row = await env.DB.prepare(
    "SELECT provider, model, api_key, updated_at FROM ai_config WHERE id = 1",
  ).first<AiConfigRow>();
  return row ?? null;
}

/** The client-facing view of the settings: the key is a boolean, not a value. */
export function toPublicConfig(row: AiConfigRow): AiConfig {
  return {
    provider: row.provider,
    model: row.model,
    hasApiKey: row.api_key.trim() !== "",
    updatedAt: row.updated_at,
  };
}

export async function listAiConfig(env: Env): Promise<AiConfig | null> {
  const row = await readAiConfig(env);
  return row ? toPublicConfig(row) : null;
}

/**
 * Upserts the single config row. An empty `apiKey` keeps the stored one, which
 * is what lets the Config form save a model change without re-typing the key.
 */
export async function saveAiConfig(
  env: Env,
  input: { provider: AiProviderId; model: string; apiKey?: string },
): Promise<AiConfig> {
  const existing = await readAiConfig(env);
  const key = (input.apiKey ?? "").trim() || existing?.api_key || "";
  if (key.trim() === "") {
    throw new AiCallError("not_configured", "no api key supplied or stored");
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO ai_config (id, provider, model, api_key, updated_at)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       provider = excluded.provider,
       model = excluded.model,
       api_key = excluded.api_key,
       updated_at = excluded.updated_at`,
  )
    .bind(input.provider, input.model.trim(), key.trim(), now)
    .run();

  return toPublicConfig(await readAiConfig(env) as AiConfigRow);
}

/* -------------------------------------------------------------------------- */
/* Logging                                                                    */
/* -------------------------------------------------------------------------- */

export interface AiLogInput {
  kind: "check" | "generate";
  status: "ok" | "error";
  provider: string;
  model: string;
  message: string;
  userId?: string;
}

/**
 * Appends one log row. Best effort on purpose: losing a log line is better
 * than turning a working Auto CV run into a 500 because a write failed.
 */
export async function recordAiLog(env: Env, entry: AiLogInput): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO ai_logs (kind, status, provider, model, message, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        entry.kind,
        entry.status,
        entry.provider,
        entry.model,
        entry.message.slice(0, 500),
        entry.userId ?? null,
        new Date().toISOString(),
      )
      .run();
  } catch (error) {
    console.error("ai log write failed", error);
  }
}

export async function listAiLogs(env: Env): Promise<AiLogEntry[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, kind, status, provider, model, message, created_at
     FROM ai_logs ORDER BY id DESC LIMIT 50`,
  ).all<{
    id: number;
    kind: "check" | "generate";
    status: "ok" | "error";
    provider: string;
    model: string;
    message: string;
    created_at: string;
  }>();

  return (results ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    provider: row.provider,
    model: row.model,
    message: row.message,
    createdAt: row.created_at,
  }));
}

/* -------------------------------------------------------------------------- */
/* Provider calls                                                             */
/* -------------------------------------------------------------------------- */

const PROVIDER_URLS: Record<AiProviderId, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  gemini: "https://generativelanguage.googleapis.com/v1beta/models",
};

interface ProviderRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  extract: (data: Record<string, unknown>) => string;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function buildRequest(row: AiConfigRow, system: string, prompt: string): ProviderRequest {
  if (row.provider === "anthropic") {
    return {
      url: PROVIDER_URLS.anthropic,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": row.api_key,
        "anthropic-version": "2023-06-01",
      },
      body: {
        model: row.model,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: prompt }],
      },
      extract: (data) => {
        const blocks = Array.isArray(data.content) ? data.content : [];
        return blocks.map((block) => String(record(block).text ?? "")).join("");
      },
    };
  }

  if (row.provider === "gemini") {
    return {
      url: `${PROVIDER_URLS.gemini}/${encodeURIComponent(row.model)}:generateContent`,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": row.api_key,
      },
      body: {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4 },
      },
      extract: (data) => {
        const candidates = Array.isArray(data.candidates) ? data.candidates : [];
        const first = record(candidates[0]);
        const content = record(first.content);
        const parts = Array.isArray(content.parts) ? content.parts : [];
        return parts.map((part) => String(record(part).text ?? "")).join("");
      },
    };
  }

  return {
    url: PROVIDER_URLS.openai,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${row.api_key}`,
    },
    body: {
      model: row.model,
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    },
    extract: (data) => {
      const choices = Array.isArray(data.choices) ? data.choices : [];
      const message = record(record(choices[0]).message);
      return String(message.content ?? "");
    },
  };
}

/**
 * 401/403, 429 and everything else are different admin problems, so they are
 * different codes. `body` matters because Gemini answers a rejected key with
 * 400 rather than 401, and a status-only rule would blame the provider for a
 * key the admin can fix.
 */
function statusToCode(status: number, body = ""): AiErrorCode {
  if (status === 401 || status === 403) return "invalid_key";
  if (status === 429) return "rate_limited";
  if (KEY_REJECTED_BY_BODY.test(body)) return "invalid_key";
  return "provider_error";
}

/** Gemini's key rejection markers: `API_KEY_INVALID` and its message text. */
const KEY_REJECTED_BY_BODY = /API_KEY_INVALID|API key not valid/i;

async function readErrorBody(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return "";
  }
}

/** Statuses we treat as transient and worth trying the next model for. */
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

async function callModel(
  row: AiConfigRow,
  system: string,
  prompt: string,
  timeoutMs = 45_000,
): Promise<string> {
  const models = AI_MODELS[row.provider];
  const startIndex = models.indexOf(row.model);
  if (startIndex === -1) {
    // Saved model not in current list (retired) — start from default (first)
    return callWithFallback(row, system, prompt, models, 0, timeoutMs);
  }
  return callWithFallback(row, system, prompt, models, startIndex, timeoutMs);
}

async function callWithFallback(
  row: AiConfigRow,
  system: string,
  prompt: string,
  models: string[],
  startIndex: number,
  timeoutMs: number,
): Promise<string> {
  let lastDetail = "";
  for (let i = startIndex; i < models.length; i++) {
    const model = models[i];
    const request = buildRequest({ ...row, model }, system, prompt);

    let response: Response;
    try {
      response = await fetch(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(request.body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      lastDetail = error instanceof Error ? error.message : String(error);
      continue; // network error → next model
    }

    if (!response.ok) {
      const detail = `HTTP ${response.status}: ${await readErrorBody(response)}`;
      const code = statusToCode(response.status, detail);
      lastDetail = detail;

      // Retryable: try next model
      if (RETRYABLE_STATUSES.has(response.status) || code === "rate_limited") {
        continue;
      }
      // Non-retryable (invalid_key, etc): stop immediately
      throw new AiCallError(code, detail);
    }

    let data: Record<string, unknown>;
    try {
      data = record(await response.json());
    } catch {
      throw new AiCallError("invalid_response", "provider reply was not JSON");
    }

    const text = request.extract(data).trim();
    if (text === "") {
      throw new AiCallError("invalid_response", "provider returned no text");
    }
    return text;
  }
  // Exhausted all models
  throw new AiCallError("provider_error", lastDetail || "all models exhausted");
}

/* -------------------------------------------------------------------------- */
/* Prompt                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The exact JSON the model must return, written in the shapes `types.ts`
 * defines: project entries carry `name`, skills carry `level`, dates are
 * `YYYY-MM`. Anything the model omits falls back to the section defaults when
 * the reply is hydrated.
 */
const SCHEMA = `{
  "personal": {
    "fullName": "",
    "role": "",
    "email": "",
    "phone": "",
    "address": "",
    "portfolioUrl": "",
    "summary": ""
  },
  "sections": [
    {
      "key": "experience",
      "items": [
        {
          "company": "",
          "role": "",
          "location": "",
          "startDate": "YYYY-MM",
          "endDate": "YYYY-MM",
          "current": false,
          "employmentType": "",
          "bullets": ["Achievement written as one short sentence."]
        }
      ]
    },
    {
      "key": "education",
      "items": [
        {
          "institution": "",
          "location": "",
          "startDate": "YYYY-MM",
          "endDate": "YYYY-MM",
          "current": false,
          "degree": "",
          "gpa": "",
          "bullets": []
        }
      ]
    },
    {
      "key": "skills",
      "items": [{ "name": "", "level": "Beginner | Intermediate | Advanced | Expert", "bullets": [] }]
    },
    {
      "key": "projects",
      "items": [
        { "name": "", "url": "", "startDate": "YYYY-MM", "endDate": "YYYY-MM", "current": false, "bullets": [] }
      ]
    },
    {
      "key": "achievements",
      "items": [{ "title": "", "organization": "", "date": "YYYY-MM", "url": "", "bullets": [] }]
    },
    {
      "key": "certifications",
      "items": [{ "name": "", "issuer": "", "date": "YYYY-MM", "url": "", "bullets": [] }]
    }
  ]
}`;

function buildPrompts(payload: AutoResumePayload): { system: string; prompt: string } {
  const locale: Locale = payload.locale === "id" ? "id" : "en";
  const system = `You are Help My CV's resume writer. You turn a free-text description into one complete resume as a single JSON object.

Rules:
- Reply with JSON only: no markdown fences, no commentary, no keys beyond the shape below.
- Write in ${locale === "id" ? "Bahasa Indonesia" : "English"} unless a name, company or certificate belongs to another language. Keep names, employers, schools and dates exactly as written; only tidy grammar and ordering. Never change the meaning.
- Sort each fact into its field: jobs under experience, schools under education, tools and strengths under skills, side work under projects, awards, courses and volunteer work under achievements, licences and courses under certifications. Personal details, including the summary headline, go under personal.
- Dates as "YYYY-MM" (a bare year is fine too); empty string when unknown; "current": true only while the person still does it.
- Each bullet is one sentence of at most 14 words, starting with the action. Maximum 4 bullets per entry.
- Omit a section key entirely when it has no content. Never invent employers, dates, grades, links or certificates.
- Leave out fields you have no information for instead of filling them with placeholders.

Return exactly this shape:
${SCHEMA}`;

  const prompt = `Resume title: ${payload.title}

Description from the user:
${payload.description}`;

  return { system, prompt };
}

/**
 * Pulls the object out of a reply. Models occasionally wrap JSON in a fence or
 * add a sentence around it, and neither is worth a failed CV.
 */
function parseModelJson(reply: string): unknown {
  let text = reply.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1];

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new AiCallError("invalid_response", `no JSON object in reply: ${text.slice(0, 120)}`);
  }

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (error) {
    throw new AiCallError("invalid_response", `unparsable JSON: ${detailOf(error)}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Hydration: model JSON -> a document the editor opens as-is                 */
/* -------------------------------------------------------------------------- */

const FILLABLE_SECTIONS: Array<Exclude<SectionKey, "personal">> = [
  "experience",
  "education",
  "skills",
  "projects",
  "achievements",
  "certifications",
];

function str(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function bool(value: unknown): boolean {
  return value === true || value === "true";
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asBullets(value: unknown): Bullet[] {
  return list(value)
    .map((item) =>
      typeof item === "string"
        ? item
        : typeof item === "object" && item !== null
          ? str(record(item).text)
          : "",
    )
    .map((text) => text.trim())
    .filter((text) => text !== "")
    .map((text) => ({ id: createId("bullet"), text }));
}

function hydrateEntries(
  key: Exclude<SectionKey, "personal">,
  items: unknown[],
): Resume["sections"][number]["entries"] | null {
  switch (key) {
    case "education": {
      const entries: EducationEntry[] = items.map((item) => {
        const o = record(item);
        return {
          id: createId("edu"),
          institution: str(o.institution),
          location: str(o.location),
          startDate: str(o.startDate),
          endDate: str(o.endDate),
          current: bool(o.current),
          degree: str(o.degree),
          gpa: str(o.gpa),
          bullets: asBullets(o.bullets),
        };
      });
      return { kind: "education", items: entries };
    }
    case "experience": {
      const entries: ExperienceEntry[] = items.map((item) => {
        const o = record(item);
        return {
          id: createId("exp"),
          company: str(o.company),
          role: str(o.role),
          location: str(o.location),
          startDate: str(o.startDate),
          endDate: str(o.endDate),
          current: bool(o.current),
          employmentType: str(o.employmentType),
          bullets: asBullets(o.bullets),
        };
      });
      return { kind: "experience", items: entries };
    }
    case "skills": {
      const entries: SkillEntry[] = items.map((item) => {
        const o = record(item);
        return {
          id: createId("skill"),
          name: str(o.name),
          level: str(o.level),
          bullets: asBullets(o.bullets),
        };
      });
      return { kind: "skills", items: entries };
    }
    case "projects": {
      const entries: ProjectEntry[] = items.map((item) => {
        const o = record(item);
        return {
          id: createId("proj"),
          name: str(o.name),
          url: str(o.url),
          startDate: str(o.startDate),
          endDate: str(o.endDate),
          current: bool(o.current),
          bullets: asBullets(o.bullets),
        };
      });
      return { kind: "projects", items: entries };
    }
    case "achievements": {
      const entries: AchievementEntry[] = items.map((item) => {
        const o = record(item);
        return {
          id: createId("ach"),
          title: str(o.title),
          organization: str(o.organization),
          date: str(o.date),
          url: str(o.url),
          bullets: asBullets(o.bullets),
        };
      });
      return { kind: "achievements", items: entries };
    }
    case "certifications": {
      const entries: CertificationEntry[] = items.map((item) => {
        const o = record(item);
        return {
          id: createId("cert"),
          name: str(o.name),
          issuer: str(o.issuer),
          date: str(o.date),
          url: str(o.url),
          bullets: asBullets(o.bullets),
        };
      });
      return { kind: "certifications", items: entries };
    }
    default:
      return null;
  }
}

function hydrateDocument(raw: unknown, user: SessionUser, payload: AutoResumePayload): Resume {
  const source = record(raw);
  if (!("personal" in source) && !("sections" in source)) {
    throw new AiCallError("invalid_response", "reply had neither personal nor sections");
  }

  const base = createResume({
    id: createId("cv"),
    userId: user.id,
    title: payload.title,
    templateId: payload.templateId,
    locale: payload.locale === "id" ? "id" : "en",
    email: user.email,
  });

  const personal = record(source.personal);
  const merged: PersonalInfo = {
    fullName: str(personal.fullName) || base.personal.fullName,
    role: str(personal.role),
    email: str(personal.email) || base.personal.email,
    phone: str(personal.phone),
    address: str(personal.address),
    portfolioUrl: str(personal.portfolioUrl),
    summary: str(personal.summary),
    photoUrl: base.personal.photoUrl,
  };

  const filled = new Map<SectionKey, Resume["sections"][number]["entries"]>();
  for (const rawSection of list(source.sections)) {
    const section = record(rawSection);
    const key = str(section.key) as SectionKey;
    if (!FILLABLE_SECTIONS.includes(key as Exclude<SectionKey, "personal">)) continue;

    const items = list(section.items);
    if (items.length === 0) continue;

    const entries = hydrateEntries(key as Exclude<SectionKey, "personal">, items);
    if (entries) filled.set(key, entries);
  }

  // A reply with nothing in it is a failed generation, not a blank CV the user
  // was bounced into.
  if (merged.fullName === "" && filled.size === 0) {
    throw new AiCallError("invalid_response", "reply contained no usable content");
  }

  const sections = base.sections.map((section) =>
    filled.has(section.key) ? { ...section, entries: filled.get(section.key) as Resume["sections"][number]["entries"] } : section,
  );

  // migrateResume clamps bullet counts and restores any section the reply left
  // out, so the stored document matches what a hand-built CV looks like.
  return migrateResume({ ...base, personal: merged, sections });
}

/* -------------------------------------------------------------------------- */
/* Public operations                                                          */
/* -------------------------------------------------------------------------- */

/** Pings the configured model. Used by the Config "Check" button. */
export async function checkAiConnection(
  env: Env,
  user: SessionUser,
): Promise<{ ok: boolean; code: AiErrorCode | "ok"; message: string }> {
  const row = await readAiConfig(env);
  if (!row) {
    await recordAiLog(env, {
      kind: "check",
      status: "error",
      provider: "",
      model: "",
      message: "not_configured: no AI settings saved yet",
      userId: user.id,
    });
    return { ok: false, code: "not_configured", message: "no AI settings saved yet" };
  }

  try {
    const reply = await callModel(row, "Reply with the single word OK.", "ping", 20_000);
    const message = reply.slice(0, 120);
    await recordAiLog(env, {
      kind: "check",
      status: "ok",
      provider: row.provider,
      model: row.model,
      message,
      userId: user.id,
    });
    return { ok: true, code: "ok", message };
  } catch (error) {
    const message = detailOf(error);
    await recordAiLog(env, {
      kind: "check",
      status: "error",
      provider: row.provider,
      model: row.model,
      message,
      userId: user.id,
    });
    return { ok: false, code: codeOf(error), message };
  }
}

/**
 * Runs the whole Auto CV pass and stores the new resume in the same shape a
 * manual create writes, so the editor, the paginator and the PDF path cannot
 * tell the two apart.
 */
export async function generateAutoResume(
  env: Env,
  user: SessionUser,
  payload: AutoResumePayload,
): Promise<Resume> {
  const row = await readAiConfig(env);
  if (!row) {
    await recordAiLog(env, {
      kind: "generate",
      status: "error",
      provider: "",
      model: "",
      message: "not_configured: no AI settings saved yet",
      userId: user.id,
    });
    throw new AiCallError("not_configured");
  }

  let resume: Resume;
  try {
    const { system, prompt } = buildPrompts(payload);
    const reply = await callModel(row, system, prompt);
    resume = hydrateDocument(parseModelJson(reply), user, payload);
  } catch (error) {
    await recordAiLog(env, {
      kind: "generate",
      status: "error",
      provider: row.provider,
      model: row.model,
      message: detailOf(error),
      userId: user.id,
    });
    throw error instanceof AiCallError ? error : new AiCallError(codeOf(error), detailOf(error));
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO resumes (id, user_id, title, document, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(resume.id, user.id, resume.title, JSON.stringify(resume), now, now)
    .run();

  await recordAiLog(env, {
    kind: "generate",
    status: "ok",
    provider: row.provider,
    model: row.model,
    message: `created ${resume.title}`,
    userId: user.id,
  });

  return resume;
}

/* -------------------------------------------------------------------------- */
/* Handlers                                                                   */
/* -------------------------------------------------------------------------- */

export async function handleAiConfigGet(env: Env): Promise<Response> {
  return json({ config: await listAiConfig(env) });
}

export async function handleAiConfigPut(env: Env, body: unknown): Promise<Response> {
  const input = record(body);
  const provider = str(input.provider) as AiProviderId;
  const model = str(input.model);

  if (!["openai", "anthropic", "gemini"].includes(provider)) {
    return json({ error: "ai_provider_unknown" }, 422);
  }
  if (model === "") {
    return json({ error: "ai_model_required" }, 422);
  }

  try {
    const config = await saveAiConfig(env, {
      provider,
      model,
      apiKey: typeof input.apiKey === "string" ? input.apiKey : undefined,
    });
    return json({ config });
  } catch (error) {
    if (error instanceof AiCallError) {
      return json({ error: error.code }, 422);
    }
    console.error("ai config save", error);
    return json({ error: "internal_error" }, 500);
  }
}

export async function handleAiConfigCheck(env: Env, user: SessionUser): Promise<Response> {
  return json(await checkAiConnection(env, user));
}

export async function handleAiLogs(env: Env): Promise<Response> {
  return json({ logs: await listAiLogs(env) });
}
