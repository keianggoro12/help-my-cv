"use client";

/**
 * Template picker grid: cards, badges and thumbnails.
 *
 * Shared by the Create-CV dialog and the Auto CV form. Two copies of this
 * markup would drift the moment a template ships, and the disabled "Coming
 * soon" state is the kind of detail that silently stops being enforced in one
 * of them.
 */

import type { ResumeTemplateId } from "@helpmycv/shared";
import { RESUME_TEMPLATES } from "@helpmycv/shared";
import { Check } from "lucide-react";

import { useSession } from "@/components/providers/session-provider";
import { cn } from "@/lib/utils";

interface TemplateGridProps {
  value: ResumeTemplateId;
  onChange: (templateId: ResumeTemplateId) => void;
}

export function TemplateGrid({ value, onChange }: TemplateGridProps) {
  const { t } = useSession();

  return (
    <div className="grid grid-cols-2 gap-3">
      {RESUME_TEMPLATES.map((item) => {
        const selected = value === item.id;
        const disabled = !item.available;

        return (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(item.id)}
            aria-pressed={selected}
            className={cn(
              "relative flex flex-col gap-2 rounded-2xl border p-4 text-left transition-colors",
              disabled
                ? "cursor-not-allowed border-dashed opacity-60"
                : selected
                  ? "border-primary bg-primary/5"
                  : "hover:bg-accent",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">
                {t(`resume.template.${item.id}` as never)}
              </span>
              {selected ? <Check className="h-4 w-4 text-primary" /> : null}
            </div>
            <TemplateThumb id={item.id} />
            {disabled ? (
              <span className="text-xs font-medium text-muted-foreground">
                {t("resume.template.comingSoon")}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A schematic of each layout, drawn from the same blocks the real sheet uses.
 *
 * Every card previously showed the identical grey placeholder, so the picker
 * gave four names and no information — you picked a template before knowing
 * what any of them looked like. Each thumbnail here mirrors one real
 * structural decision of its layout (left-aligned name under a rule for
 * `blank`, centred small-caps name under a double rule for `classic`) rather
 * than depicting typography it cannot render at 80 pixels tall.
 */
function TemplateThumb({ id }: { id: ResumeTemplateId }) {
  if (id === "classic") {
    return (
      <div className="flex h-20 flex-col items-center rounded-lg border bg-card px-2 py-2" aria-hidden>
        <div className="h-2 w-10 rounded-sm bg-muted" />
        <div className="mt-1 h-1 w-6 rounded-sm bg-muted/70" />
        {/* The double rule is the layout's whole signature at this size. */}
        <div className="mt-1.5 h-px w-full bg-foreground/40" />
        <div className="mt-px h-px w-full bg-foreground/20" />
        <div className="mt-2 flex w-full items-center gap-1">
          <div className="h-1.5 w-7 rounded-sm bg-foreground/30" />
          <div className="h-px flex-1 bg-muted" />
          <div className="h-1.5 w-5 rounded-sm bg-muted" />
        </div>
        <div className="mt-1 flex w-full items-center gap-1">
          <div className="h-1.5 w-7 rounded-sm bg-foreground/30" />
          <div className="h-px flex-1 bg-muted" />
          <div className="h-1.5 w-5 rounded-sm bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-20 flex-col rounded-lg border bg-card p-2" aria-hidden>
      <div className="h-2 w-8 rounded-full bg-muted" />
      <div className="mt-2 space-y-1">
        <div className="h-1.5 w-full rounded-full bg-muted" />
        <div className="h-1.5 w-4/5 rounded-full bg-muted" />
      </div>
      <div className="mt-2 h-1.5 w-6 rounded-full bg-muted" />
    </div>
  );
}
