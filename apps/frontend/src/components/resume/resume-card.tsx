"use client";

/**
 * Resume card.
 *
 * The preview is a miniature of the real layout, blurred on purpose: the PRD
 * asks for a blurred thumbnail so the list reads as a gallery of CVs without
 * leaking the contents to someone glancing over your shoulder. It is a static
 * mock of the layout, not a live render of the stored data, because
 * phase 1 has no PDF/print renderer to screenshot from.
 */

import { Pencil, Trash2 } from "lucide-react";

import type { Resume } from "@helpmycv/shared";
import type { TranslationKey } from "@helpmycv/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function BlurredPreview() {
  return (
    <div aria-hidden className="pointer-events-none select-none">
      <div className="mx-auto h-28 w-24 rounded-lg border bg-white p-2 shadow-sm dark:bg-slate-200">
        <div className="mx-auto h-3 w-10 rounded-full bg-slate-300" />
        <div className="mx-auto mt-1 h-1.5 w-14 rounded-full bg-slate-200" />
        <div className="mt-3 space-y-1">
          <div className="h-1.5 w-full rounded-full bg-slate-200" />
          <div className="h-1.5 w-4/5 rounded-full bg-slate-200" />
        </div>
        <div className="mt-2 h-1.5 w-8 rounded-full bg-slate-300" />
        <div className="mt-1 space-y-1">
          <div className="h-1.5 w-full rounded-full bg-slate-200" />
          <div className="h-1.5 w-11/12 rounded-full bg-slate-200" />
        </div>
        <div className="mt-2 h-1.5 w-9 rounded-full bg-slate-300" />
        <div className="mt-1 space-y-1">
          <div className="h-1.5 w-full rounded-full bg-slate-200" />
          <div className="h-1.5 w-3/4 rounded-full bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

interface ResumeCardProps {
  resume: Resume;
  locale: "en" | "id";
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  onEdit: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function ResumeCard({ resume, locale, t, onEdit, onRename, onDelete }: ResumeCardProps) {
  return (
    <Card className="relative flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">{resume.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("resume.createdAt", { date: formatDate(resume.createdAt, locale) })}
          </p>
        </div>
        {/* Same menu the admin tables use, so "the three dots" behave the same
            everywhere: dismiss on outside click or Escape, not only on a second
            click of the trigger. */}
        <RowActionsMenu
          label={t("resume.openMenu")}
          actions={[
            {
              id: "edit",
              label: t("resume.edit"),
              icon: <Pencil className="h-4 w-4 text-muted-foreground" />,
              onSelect: onEdit,
            },
            { id: "rename", label: t("resume.rename"), onSelect: onRename },
            {
              id: "delete",
              label: t("resume.delete"),
              icon: <Trash2 className="h-4 w-4" />,
              destructive: true,
              onSelect: onDelete,
            },
          ]}
        />
      </div>

      <div
        className="flex flex-1 items-center justify-center py-5"
        data-slot="clickable-row"
        role="button"
        tabIndex={0}
        onClick={onEdit}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onEdit();
          }
        }}
      >
        {/* Blurred at rest, as the PRD asks: the card grid is a gallery, and a
            readable thumbnail would leak the whole CV to anyone glancing at
            the screen. Hover sharpens it for the person who owns it. */}
        <div className="cursor-zoom-in transition-[filter] duration-300 blur-[2px] hover:blur-0">
          <BlurredPreview />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Badge variant={resume.status === "final" ? "default" : "secondary"}>
          {resume.status === "final" ? t("resume.status.final") : t("resume.status.draft")}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {t("resume.updatedAt", { date: formatDate(resume.updatedAt, locale) })}
        </span>
      </div>

      <Button className={cn("mt-4 w-full")} onClick={onEdit}>
        <Pencil className="h-4 w-4" />
        {t("resume.edit")}
      </Button>
    </Card>
  );
}
