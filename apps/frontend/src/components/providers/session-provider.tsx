"use client";

/**
 * Session and locale context.
 *
 * The session is read from localStorage after mount, never during render, so
 * the server and client agree on the first paint (an SSR'd page that read
 * localStorage would produce a hydration mismatch). Consumers get `loading`
 * to distinguish "signed out" from "not known yet" and avoid bouncing a
 * signed-in user to /login on a hard refresh.
 *
 * Storage writes dispatch a `helpmycv:storage` event (see `lib/storage.ts`),
 * which is what keeps two tabs in sync — the native `storage` event only
 * fires in *other* tabs.
 */

import type { Locale, UserProfile } from "@helpmycv/shared";
import { translate, type TranslationKey } from "@helpmycv/shared";
import * as React from "react";

import { getSession, signOut as clearSession } from "@/lib/auth-store";
import { ensureSeeded } from "@/lib/resume-store";
import { readJson, STORAGE_KEYS, writeJson } from "@/lib/storage";

interface SessionContextValue {
  user: UserProfile | null;
  /** True until the first localStorage read resolves. */
  loading: boolean;
  signOut: () => void;
  /** Re-reads the session from storage, e.g. after a profile update. */
  refresh: () => void;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

const DEFAULT_LOCALE: Locale = "en";

function readStoredLocale(): Locale {
  const stored = readJson<Locale | null>(STORAGE_KEYS.locale, null);
  return stored === "id" || stored === "en" ? stored : DEFAULT_LOCALE;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [locale, setLocaleState] = React.useState<Locale>(DEFAULT_LOCALE);

  /**
   * Re-reads the session from storage.
   *
   * `getSession()` parses a fresh object every call, so passing it straight to
   * `setUser` would change `user`'s identity on every storage event even when the
   * session is byte-for-byte identical. Anything with `user` in a dependency
   * array — the editor's load effect, the resume list — would then re-run each
   * time. The session is only replaced when it actually differs.
   */
  const refresh = React.useCallback(() => {
    setUser((current) => {
      const next = getSession();
      if (current && next && current.id === next.id && current.email === next.email) {
        return current;
      }
      if (!current && !next) {
        return current;
      }
      return next;
    });
    setLoading(false);
  }, []);

  React.useEffect(() => {
    ensureSeeded();
    setLocaleState(readStoredLocale());
    refresh();

    // Same-tab writes and other-tab writes both land here.
    const onStorage = () => refresh();
    window.addEventListener("helpmycv:storage", onStorage);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("helpmycv:storage", onStorage);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    writeJson(STORAGE_KEYS.locale, next);
  }, []);

  const signOut = React.useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const t = React.useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );

  const value = React.useMemo<SessionContextValue>(
    () => ({ user, loading, signOut, refresh, locale, setLocale, t }),
    [user, loading, signOut, refresh, locale, setLocale, t],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = React.useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used inside a SessionProvider");
  }
  return context;
}
