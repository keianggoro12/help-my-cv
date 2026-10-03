"use client";

/**
 * Mock AI bullet improvement.
 *
 * Phase 1 has no engine, so this rewrites the sentence locally and the button
 * is real end to end: it is asynchronous, has a loading state, and replaces
 * the text in place. When the real engine is wired in, only this function
 * changes — keep the same signature, the same "return null on failure and
 * leave the user's text alone" contract, and the same locale argument, since
 * a CV written in Indonesian must be improved in Indonesian.
 *
 * `locale` is part of the contract for that future call, not decoration: it is
 * accepted and threaded through so callers do not have to change shape when
 * the real engine lands.
 */

import type { Locale } from "@helpmycv/shared";

/** Simple, honest rewrites: no invented achievements, no invented metrics. */
export async function improveBullet(text: string, locale: Locale): Promise<string | null> {
  void locale;

  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  // A short delay so the loading state is actually visible; a button that
  // responds instantly reads as broken when the real engine takes seconds.
  await new Promise((resolve) => setTimeout(resolve, 600));

  const sentence = trimmed.replace(/\s+/g, " ").replace(/[.]+$/, "");
  const capitalised = sentence.charAt(0).toUpperCase() + sentence.slice(1);

  const cleaned = capitalised
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Only capitalisation, spacing and the trailing full stop are touched: the
  // point of the button is to tighten the sentence, not to paraphrase it.
  return `${cleaned}.`;
}
