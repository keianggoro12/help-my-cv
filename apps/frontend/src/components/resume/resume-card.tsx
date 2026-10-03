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

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import * as React from "react";

import type { Resume } from "@helpmycv/shared";
import type { TranslationKey } from "@helpmycv/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Dismiss on outside click or Escape, so the menu behaves like a menu and
  // not a toggle you have to click twice to close.
  React.useEffect(() => {
    if (!menuOpen) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <Card className="relative flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">{resume.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("resume.createdAt", { date: formatDate(resume.createdAt, locale) })}
          </p>
        </div>
        <div className="relative" ref={menuRef}>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("resume.openMenu")}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-2xl border bg-card p-1 shadow-lg animate-[pop-in_140ms_cubic-bezier(0.32,0.72,0,1)]"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
                {t("resume.edit")}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onRename();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
              >
                {t("resume.rename")}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                {t("resume.delete")}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center py-5">
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
