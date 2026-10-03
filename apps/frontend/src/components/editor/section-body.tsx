"use client";

/**
 * Generic body for every entry-based section.
 *
 * The nested-sortable design lives here: entries render inside a second
 * `Sortable` whose items are entry ids, nested within the section's own
 * sortable item. That is the whole mechanism — an entry cannot leave its
 * section because the outer context never sees it as a draggable child.
 */

import { GripVertical, Plus } from "lucide-react";

import type { AnyEntry, Locale, ResumeSection, SectionKey, TranslationKey } from "@helpmycv/shared";
import { createEmptySectionEntries, findSectionSchema } from "@helpmycv/shared";

import { EntryCard, duplicateEntry } from "@/components/editor/entry-card";
import { Button } from "@/components/ui/button";
import { Sortable, SortableItem, SortableItemHandle } from "@/components/ui/sortable";
import { cn } from "@/lib/utils";

interface SectionBodyProps {
  sectionKey: Exclude<SectionKey, "personal">;
  entries: AnyEntry[];
  onChange: (entries: AnyEntry[]) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  locale: Locale;
}

export function SectionBody({ sectionKey, entries, onChange, t, locale }: SectionBodyProps) {
  const schema = findSectionSchema(sectionKey);

  if (!schema) {
    return null;
  }

  return (
    <div className="space-y-3">
      {entries.length === 0 ? (
        <p
          className={cn(
            "rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground",
          )}
        >
          {t(schema.emptyKey)}
        </p>
      ) : (
        <Sortable
          value={entries}
          onValueChange={onChange}
          getItemValue={(entry) => entry.id}
          className="space-y-3"
        >
          {entries.map((entry, index) => (
            <SortableItem key={entry.id} value={entry.id}>
              <EntryCard
                entry={entry}
                schema={schema}
                index={index}
                locale={locale}
                t={t}
                dragHandle={
                  <SortableItemHandle
                    className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
                    label={t("editor.dragHandle")}
                  >
                    <GripVertical className="h-4 w-4" />
                  </SortableItemHandle>
                }
                onChange={(updated) =>
                  onChange(entries.map((c) => (c.id === updated.id ? updated : c)))
                }
                onDuplicate={() => {
                  // The copy lands directly after the original: that is what
                  // "duplicate" means to someone who just clicked it.
                  const next = entries.slice();
                  next.splice(index + 1, 0, duplicateEntry(entry));
                  onChange(next);
                }}
                onDelete={() => onChange(entries.filter((c) => c.id !== entry.id))}
              />
            </SortableItem>
          ))}
        </Sortable>
      )}

      <Button
        variant="outline"
        onClick={() => onChange([...entries, createEmptySectionEntries(sectionKey)])}
      >
        <Plus className="h-4 w-4" />
        {t("editor.addEntry")}
      </Button>
    </div>
  );
}

/**
 * Narrows a resume's stored entries to the items of one section.
 *
 * Stored data predates the achievements section, so a section may be missing
 * or hold a different kind than its key implies; both fall back to an empty
 * list instead of throwing and blanking the editor.
 */
export function readSectionEntries(
  section: ResumeSection | undefined,
  key: Exclude<SectionKey, "personal">,
): AnyEntry[] {
  if (!section || section.entries.kind !== key) {
    return [];
  }
  return section.entries.items as AnyEntry[];
}