import type { Resume } from "./types";
import { DEFAULT_SECTION_ORDER, emptyEntries } from "./defaults";

/**
 * Brings a stored resume up to the current section shape.
 *
 * Lives in shared rather than in the frontend store because both sides need
 * the same answer: the mock localStorage layer reads it on every list/get, and
 * the backend reads and writes it so a document saved by an older client never
 * reaches the editor missing a section.
 *
 * Appending new sections rather than prepending keeps an order the user has
 * already arranged intact — prepending would silently reshuffle every CV they
 * have tuned.
 */
export function migrateResume(resume: Resume): Resume {
  const present = new Set(resume.sections.map((section) => section.key));
  const missing = DEFAULT_SECTION_ORDER.filter((key) => !present.has(key)).map((key) => ({
    key,
    visible: true,
    entries: emptyEntries(key),
  }));

  if (missing.length === 0) {
    return resume;
  }
  return { ...resume, sections: [...resume.sections, ...missing] };
}