"use client";

/**
 * One entry in an entry-based section, rendered from its schema.
 *
 * Every section in the PRD behaves identically — a reorderable list of entries
 * with a few fields, bullets, and add/duplicate/delete — so the field layout
 * comes from `SECTION_SCHEMAS` instead of being hardcoded per section. Writing
 * one card per section produced five copies that drifted apart as soon as one
 * of them needed a field the others did not.
 *
 * Entries live in their own `Sortable` context inside the section, so an entry
 * can reorder among its siblings but has no way to escape its section: that
 * falls out of the markup rather than a guard.
 */

import { Copy, Trash2 } from "lucide-react";

import type {
  AnyEntry,
  EntryField,
  Locale,
  SectionSchema,
  TranslationKey,
} from "@helpmycv/shared";
import { createId } from "@helpmycv/shared";

import { BulletList } from "@/components/editor/bullet-list";
import { MonthYearPicker } from "@/components/editor/month-year-picker";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Entries are not a single shape, so field access goes through this rather
 * than through a type that claims they are. Only fields listed in the schema
 * are ever read, and those exist on every entry type that names them.
 */
type MutableEntry = Record<string, unknown> & { id: string; bullets: AnyEntry["bullets"] };

interface EntryCardProps {
  entry: AnyEntry;
  schema: SectionSchema;
  index: number;
  onChange: (entry: AnyEntry) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  dragHandle: React.ReactNode;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  locale: Locale;
}

export function EntryCard({
  entry,
  schema,
  index,
  onChange,
  onDelete,
  onDuplicate,
  dragHandle,
  t,
  locale,
}: EntryCardProps) {
  const draft = entry as unknown as MutableEntry;

  function patch(changes: Record<string, unknown>) {
    // Cast through `unknown`: entries are a union, and merging `entry` with a
    // partial patch cannot be proven to be any one member of it, even though
    // only schema-listed keys are ever patched.
    onChange({ ...draft, ...changes } as unknown as AnyEntry);
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-background/40 p-4">
      <div className="flex items-center gap-2">
        {dragHandle}
        <span className="flex-1 text-xs font-medium text-muted-foreground">
          {t(`entry.${schema.key}` as TranslationKey)} {index + 1}
        </span>
        <Button variant="ghost" size="icon" aria-label={t("editor.duplicate")} onClick={onDuplicate}>
          <Copy className="h-4 w-4 text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("editor.deleteEntry")}
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {schema.fields.map((field) => (
          <EntryFieldControl
            key={fieldKey(field)}
            field={field}
            entryId={draft.id}
            draft={draft}
            patch={patch}
            t={t}
            locale={locale}
          />
        ))}
      </div>

      {schema.bullets ? (
        <div className="space-y-2">
          {/* Per-section label: what the bullets describe differs by section, so
              "About me" (the Personal Information summary) is not reused here. */}
          <FieldLabel>{t(schema.bulletsLabel)}</FieldLabel>
          <BulletList
            bullets={draft.bullets}
            onChange={(bullets) => patch({ bullets })}
            t={t}
            locale={locale}
          />
        </div>
      ) : null}
    </div>
  );
}

interface EntryFieldControlProps {
  field: EntryField;
  entryId: string;
  draft: MutableEntry;
  patch: (changes: Record<string, unknown>) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  locale: Locale;
}

function EntryFieldControl({ field, entryId, draft, patch, t, locale }: EntryFieldControlProps) {
  if (field.kind === "date-single") {
    return (
      <MonthYearPicker
        id={`${field.key}-${entryId}`}
        label={t("field.date")}
        value={String(draft[field.key] ?? "")}
        onChange={(value) => patch({ [field.key]: value })}
        locale={locale}
      />
    );
  }

  if (field.kind === "date-range") {
    const current = Boolean(draft[field.currentKey]);

    return (
      <>
        <MonthYearPicker
          id={`${field.startKey}-${entryId}`}
          label={t("field.startDate")}
          value={String(draft[field.startKey] ?? "")}
          onChange={(value) => patch({ [field.startKey]: value })}
          locale={locale}
        />

        {/* "Current" swaps the end picker out rather than disabling it: a
            visible-but-inert field reads as broken. */}
        {current ? (
          <div className="space-y-2">
            <FieldLabel htmlFor={`present-${entryId}`}>{t("field.endDate")}</FieldLabel>
            <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
              <input
                id={`present-${entryId}`}
                type="checkbox"
                checked
                onChange={(event) =>
                  patch({ [field.currentKey]: event.target.checked, [field.endKey]: "" })
                }
                className="mr-2 accent-current"
              />
              {t("field.present")}
            </div>
          </div>
        ) : (
          <MonthYearPicker
            id={`${field.endKey}-${entryId}`}
            label={t("field.endDate")}
            value={String(draft[field.endKey] ?? "")}
            onChange={(value) => patch({ [field.endKey]: value })}
            locale={locale}
          />
        )}
      </>
    );
  }

  // A full-width field needs to break out of the two-column grid.
  return (
    <div className={cn("space-y-2", field.grow && "sm:col-span-2")}>
      <FieldLabel htmlFor={`${field.key}-${entryId}`}>{t(field.label)}</FieldLabel>
      <Input
        id={`${field.key}-${entryId}`}
        value={String(draft[field.key] ?? "")}
        onChange={(event) => patch({ [field.key]: event.target.value })}
      />
    </div>
  );
}

function fieldKey(field: EntryField): string {
  return field.kind === "text" ? field.key : `${field.kind}`;
}

/** A duplicate is a deep-ish copy with fresh ids, so it never aliases the original. */
export function duplicateEntry(entry: AnyEntry): AnyEntry {
  const copy = { ...entry } as MutableEntry;
  copy.id = `${entry.id}_copy_${createId("").slice(1)}`;
  if (Array.isArray(copy.bullets)) {
    copy.bullets = copy.bullets.map((bullet) => ({ ...bullet, id: createId("b") }));
  }
  return copy as unknown as AnyEntry;
}