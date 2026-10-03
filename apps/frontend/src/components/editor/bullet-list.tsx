"use client";

/**
 * Bullet list with the AI "improve" affordance.
 *
 * Three bullets are seeded for a new entry but never capped — the PRD is
 * explicit that three is a starting point, not a limit, so there is no
 * maximum anywhere in this component.
 *
 * The improve button is a mock in phase 1 (see `lib/ai-improve.ts`); it shows
 * the loading state so the interaction is exercised end to end before the
 * engine is wired in.
 */

import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import * as React from "react";

import type { Bullet, Locale, TranslationKey } from "@helpmycv/shared";
import { createBullets, createId } from "@helpmycv/shared";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { improveBullet } from "@/lib/ai-improve";

interface BulletListProps {
  bullets: Bullet[];
  onChange: (bullets: Bullet[]) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  locale: Locale;
}

export function BulletList({ bullets, onChange, t, locale }: BulletListProps) {
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  function update(id: string, text: string) {
    onChange(bullets.map((bullet) => (bullet.id === id ? { ...bullet, text } : bullet)));
  }

  function remove(id: string) {
    onChange(bullets.filter((bullet) => bullet.id !== id));
  }

  function add() {
    onChange([...bullets, { id: createId("b"), text: "" }]);
  }

  async function improve(bullet: Bullet) {
    if (!bullet.text.trim()) {
      return;
    }
    setPendingId(bullet.id);
    // Fire-and-forget: the loading state is driven by the id, and a failure
    // just leaves the user's text untouched.
    const improved = await improveBullet(bullet.text, locale);
    setPendingId(null);
    if (improved) {
      update(bullet.id, improved);
    }
  }

  return (
    <div className="space-y-2">
      {bullets.map((bullet, index) => (
        <div key={bullet.id} className="flex items-start gap-2">
          <span className="mt-2.5 select-none text-xs text-muted-foreground">{index + 1}.</span>
          <Textarea
            value={bullet.text}
            onChange={(event) => update(bullet.id, event.target.value)}
            rows={2}
            className="min-h-[60px] resize-y"
            aria-label={`${t("editor.addBullet")} ${index + 1}`}
          />
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("editor.improve")}
              disabled={pendingId === bullet.id || !bullet.text.trim()}
              onClick={() => void improve(bullet)}
            >
              {pendingId === bullet.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("editor.deleteBullet")}
              onClick={() => remove(bullet.id)}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      ))}

      <Button variant="ghost" size="sm" onClick={add} className="text-muted-foreground">
        <Plus className="h-4 w-4" />
        {t("editor.addBullet")}
      </Button>
    </div>
  );
}

export { createBullets };
