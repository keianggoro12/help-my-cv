"use client";

import type { Locale } from "@helpmycv/shared";
import { LOCALE_LABELS } from "@helpmycv/shared";
import { Languages } from "lucide-react";

import { useSession } from "@/components/providers/session-provider";
import { Select } from "@/components/ui/select";

/**
 * EN/ID switch.
 *
 * The two locales are fixed for phase 1, so a native select lists both
 * explicitly instead of a two-state toggle: adding a language later is a data
 * change, not a UI rewrite.
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const { locale, setLocale } = useSession();

  return (
    <div className={className}>
      <Select
        aria-label="Language"
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        {(Object.keys(LOCALE_LABELS) as Locale[]).map((value) => (
          <option key={value} value={value}>
            {LOCALE_LABELS[value]}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** Compact icon button for the mobile drawer footer. */
export function LanguageSwitchIcon() {
  const { locale, setLocale } = useSession();
  const next: Locale = locale === "en" ? "id" : "en";

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      aria-label={`Language: ${LOCALE_LABELS[locale]}. Switch to ${LOCALE_LABELS[next]}.`}
      title={LOCALE_LABELS[locale]}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Languages className="h-4 w-4" />
    </button>
  );
}
