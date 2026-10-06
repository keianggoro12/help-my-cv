/**
 * Auto CV endpoints.
 *
 * `POST /generate` is the only write: it runs the model and inserts the resume,
 * so a client that gets a 201 has a real row to open. Provider failures come
 * back as the engine's own error code (`invalid_key`, `rate_limited`, …) rather
 * than a blanket 500, because the Auto CV screen tells the user which one it was
 * and the Config log shows the detail.
 */

import type { AutoResumePayload } from "@helpmycv/shared";

import type { Env } from "../lib/helpers";
import { json } from "../lib/helpers";
import { AiCallError, generateAutoResume } from "../lib/ai";
import type { SessionUser } from "../lib/session";

/** Every code maps to a distinct status so a client can branch without parsing text. */
const STATUS_BY_CODE: Record<string, number> = {
  not_configured: 409,
  invalid_key: 502,
  rate_limited: 429,
  network_error: 502,
  provider_error: 502,
  invalid_response: 502,
};

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function handleGenerate(env: Env, user: SessionUser, body: unknown): Promise<Response> {
  const input = (typeof body === "object" && body !== null ? body : {}) as Partial<AutoResumePayload>;

  const title = stringField(input.title);
  const description = stringField(input.description);
  if (title === "" || description === "") {
    return json({ error: "invalid_input" }, 422);
  }

  // Only templates the factory can build are accepted; the picker already hides
  // the rest, so this is a guard against a hand-rolled request.
  const templateId = ["blank", "modern", "classic", "minimal"].includes(String(input.templateId))
    ? (input.templateId as AutoResumePayload["templateId"])
    : "blank";

  try {
    const resume = await generateAutoResume(env, user, {
      title,
      description,
      templateId,
      locale: input.locale === "id" ? "id" : "en",
    });

    return json(
      {
        resume: {
          id: resume.id,
          userId: resume.userId,
          title: resume.title,
          createdAt: resume.createdAt,
          updatedAt: resume.updatedAt,
          status: resume.status,
          templateId: resume.templateId,
          document: resume,
        },
      },
      201,
    );
  } catch (error) {
    if (error instanceof AiCallError) {
      return json({ error: error.code }, STATUS_BY_CODE[error.code] ?? 502);
    }
    console.error("auto resume generate", error);
    return json({ error: "internal_error" }, 500);
  }
}
