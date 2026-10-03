"use client";

/**
 * Section shell for the editor.
 *
 * The eye button hides a section and the grip reorders it — except for
 * Personal Information, which is `locked`: no eye, no grip, and a note saying
 * why. The lock is a prop rather than a check inside the component so the
 * locked section cannot accidentally grow a control later.
 *
 * A hidden section keeps its header (collapsed, dimmed) instead of
 * disappearing. Removing the header entirely would leave no way to turn it
 * back on without a separate "show hidden sections" mode, which is a worse
 * trap than a dimmed row.
 */

import { Eye, EyeOff, GripVertical, Lock } from "lucide-react";
import type { ReactNode } from "react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SortableItemHandle } from "@/components/ui/sortable";
import type { TranslationKey } from "@helpmycv/shared";
import { cn } from "@/lib/utils";

interface SectionShellProps {
  title: string;
  visible: boolean;
  /** Anchor target for the section rail's jump-to-section buttons. */
  id?: string;
  /** Omitted for the locked section, which has no eye to press. */
  onToggle?: () => void;
  /** Reorder controls. Omitted entirely for the locked section. */
  handle?: ReactNode;
  locked?: boolean;
  lockedNote?: string;
  children: ReactNode;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  /** Optional editable title override. Personal section title not editable. */
  editableTitle?: boolean;
  onTitleChange?: (title: string) => void;
}

export function SectionShell({
  title,
  visible,
  id,
  onToggle,
  handle,
  locked = false,
  lockedNote,
  children,
  t,
  editableTitle = false,
  onTitleChange,
}: SectionShellProps) {
  return (
    <section
      id={id}
      className={cn(
        // scroll-mt clears the sticky editor header so a jump lands on the
        // section title instead of tucking it underneath.
        "scroll-mt-24 rounded-3xl border bg-card p-5 shadow-sm transition-opacity",
        !visible && "opacity-60",
      )}
    >
      <header className="flex items-center gap-3">
        {!locked && handle ? (
          <SortableItemHandle
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
            label={t("editor.dragHandle")}
          >
            <GripVertical className="h-4 w-4" />
          </SortableItemHandle>
        ) : null}

        <div className="min-w-0 flex-1">
          {editableTitle && !locked ? (
            <Input
              value={title}
              onChange={(e) => onTitleChange?.(e.target.value)}
              className="h-7 border-none px-0 font-semibold shadow-none focus-visible:ring-0"
              aria-label={t("editor.sectionTitle")}
              placeholder={t("editor.sectionTitle")}
            />
          ) : (
            <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
          )}
          {locked && lockedNote ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              {lockedNote}
            </p>
          ) : null}
        </div>

        {!locked && onToggle ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              aria-label={visible ? t("editor.hideSection") : t("editor.showSection")}
              title={visible ? t("editor.hideSection") : t("editor.showSection")}
            >
              {visible ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>
          </div>
        ) : null}
      </header>

      {visible ? <div className="mt-5">{children}</div> : (
        <p className="mt-3 text-xs text-muted-foreground">{t("editor.sectionHidden")}</p>
      )}
    </section>
  );
}
