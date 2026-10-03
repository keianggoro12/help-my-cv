"use client";

/**
 * CV editor, laid out in three columns:
 *
 *   left   the section rail — order and visibility live here, so the form in
 *          the middle stays a plain form with no reorder affordances in it
 *   middle the fields for the sections, in the resume's own order
 *   right  a live A4 preview that re-renders from the same `Resume` object
 *
 * Personal Information is pinned above the sortable set: it is not a sortable
 * item, so there is nothing to drag it with and no eye to turn it off. The
 * middle column follows `resume.sections` order, which is the same array the
 * rail reorders, so dragging in the rail moves the whole section — entries
 * included — down the document.
 *
 * Saving is explicit (a button in the sticky header) rather than autosaved:
 * there is no backend to debounce against in phase 1, and an autosave firing
 * on every keystroke into localStorage is a trap when the browser history is
 * the only undo.
 */

import { ArrowLeft, Download, Eye, EyeOff, GripVertical, Loader2, Printer, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { useSession } from "@/components/providers/session-provider";
import { PersonalSection } from "@/components/editor/personal-section";
import { PreviewPanel } from "@/components/editor/preview-panel";
import { SectionRail, useActiveSection } from "@/components/editor/section-rail";
import { SectionBody, readSectionEntries } from "@/components/editor/section-body";
import { SectionShell } from "@/components/editor/section-shell";
import { Button } from "@/components/ui/button";
import { Sortable, SortableItem, SortableItemHandle } from "@/components/ui/sortable";
import type {
  AnyEntry,
  Resume,
  ResumeSection,
  SectionKey,
} from "@helpmycv/shared";
import { translateSection } from "@helpmycv/shared";
import { getResume, saveResume } from "@/lib/resume-store";
import { cn } from "@/lib/utils";

const PERSONAL: SectionKey = "personal";
/** Below this width the field column wins and the preview is toggled by hand. */
const PREVIEW_QUERY = "(min-width: 1280px)";

interface EditorPageProps {
  resumeId: string;
}

export function EditorPage({ resumeId }: EditorPageProps) {
  const router = useRouter();
  const { user, loading, locale, t } = useSession();

  const [resume, setResume] = React.useState<Resume | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (loading || !user) {
      return;
    }
    const found = getResume(user.id, resumeId);
    if (found) {
      setResume(found);
    } else {
      setNotFound(true);
    }
  }, [loading, resumeId, user]);

  // Wide screens get the preview by default; narrow ones opt in, because two
  // columns of form plus a sheet at 1024px leaves the fields unusably thin.
  React.useEffect(() => {
    const query = window.matchMedia(PREVIEW_QUERY);
    setPreviewOpen(query.matches);
    const onChange = (event: MediaQueryListEvent) => setPreviewOpen(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  function patch(changes: Partial<Resume>) {
    setResume((current) => (current ? { ...current, ...changes } : current));
    setDirty(true);
    setSaved(false);
  }

  function patchSection(key: SectionKey, changes: Partial<ResumeSection>) {
    setResume((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        sections: current.sections.map((section) =>
          section.key === key ? { ...section, ...changes } : section,
        ),
      };
    });
    setDirty(true);
    setSaved(false);
  }

  function reorderSections(next: ResumeSection[]) {
    setResume((current) => (current ? { ...current, sections: next } : current));
    setDirty(true);
    setSaved(false);
  }

  function handleToggle(key: SectionKey) {
    const section = resume?.sections.find((candidate) => candidate.key === key);
    if (!section || key === PERSONAL) {
      return;
    }
    patchSection(key, { visible: !section.visible });
  }

  function updateSectionEntries(key: Exclude<SectionKey, "personal">, entries: AnyEntry[]) {
    patchSection(key, { entries: { kind: key, items: entries } as ResumeSection["entries"] });
  }

  function handleSave() {
    if (!resume) {
      return;
    }
    setSaving(true);
    // Deferred a tick so the spinner is actually painted; a synchronous
    // localStorage write would finish before the browser could draw.
    window.setTimeout(() => {
      setResume(saveResume(resume));
      setSaving(false);
      setDirty(false);
      setSaved(true);
    }, 250);
  }

  const sectionKeys = React.useMemo(
    () => (resume ? resume.sections.map((section) => section.key) : []),
    [resume],
  );
  const [activeKey, jumpToSection] = useActiveSection(scrollRef, sectionKeys);

  if (notFound) {
    return (
      <div className="rounded-3xl border border-dashed bg-card p-12 text-center">
        <h1 className="text-lg font-semibold text-foreground">{t("editor.notFound")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("editor.notFoundBody")}</p>
        <Button className="mt-6" onClick={() => router.push("/user/resume-builder")}>
          {t("editor.back")}
        </Button>
      </div>
    );
  }

  if (!resume) {
    return null;
  }

  const personalSection = resume.sections.find((section) => section.key === PERSONAL);
  const movableSections = resume.sections.filter((section) => section.key !== PERSONAL);

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col py-2">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/user/resume-builder")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-foreground">{resume.title}</h1>
            <p className="text-xs text-muted-foreground">
              {saved ? t("resume.saved") : t("editor.title")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPreviewOpen((open) => !open)}
            aria-pressed={previewOpen}
            className="xl:hidden"
          >
            {previewOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {previewOpen ? t("editor.hidePreview") : t("editor.showPreview")}
          </Button>

          <Button variant="outline" onClick={() => window.print()} aria-label={t("editor.print")}>
            <Printer className="h-4 w-4" />
            {t("editor.print")}
          </Button>

          <Button
            variant="outline"
            onClick={() => window.print()}
            disabled={!resume || dirty || saving}
            aria-label={t("editor.download")}
            title={dirty || saving ? t("editor.downloadDisabled") : t("editor.download")}
          >
            <Download className="h-4 w-4" />
            {t("editor.download")}
          </Button>

          <Button onClick={handleSave} disabled={!dirty || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? t("resume.saving") : t("resume.save")}
          </Button>
        </div>
      </header>

      {/* The middle column scrolls; the rail and the preview get their own
          scroll areas so a long form never scrolls the preview out of view. */}
      <div className="flex min-h-0 flex-1 gap-4 pt-4">
        <aside className="hidden w-56 shrink-0 overflow-y-auto pb-8 lg:block">
          <SectionRail
            sections={resume.sections}
            locale={locale}
            activeKey={activeKey}
            onReorder={reorderSections}
            onToggle={handleToggle}
            onJump={jumpToSection}
            t={t}
          />
        </aside>

        <div ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto pb-16">
          <div className="space-y-4">
            {personalSection ? (
              <SectionShell
                id={`section-${PERSONAL}`}
                title={translateSection(locale, PERSONAL)}
                visible
                locked
                lockedNote={t("editor.personalLocked")}
                t={t}
              >
                <PersonalSection
                  personal={resume.personal}
                  onChange={(personal) => patch({ personal })}
                  t={t}
                />
              </SectionShell>
            ) : null}

            <Sortable
              value={movableSections}
              onValueChange={reorderSections}
              getItemValue={(section) => section.key}
              className="space-y-4"
            >
              {movableSections.map((section) => (
                <SortableItem key={section.key} value={section.key}>
                  <SectionShell
                    id={`section-${section.key}`}
                    title={section.title?.trim() ? section.title : translateSection(locale, section.key)}
                    visible={section.visible}
                    onToggle={() => handleToggle(section.key)}
                    editableTitle={section.key !== PERSONAL}
                    onTitleChange={(title) =>
                      patchSection(section.key, { title: title.trim() ? title : undefined })
                    }
                    handle={
                      <SortableItemHandle
                        className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
                        label={t("editor.dragHandle")}
                      >
                        <GripVertical className="h-4 w-4" />
                      </SortableItemHandle>
                    }
                    t={t}
                  >
                    <SectionBody
                      sectionKey={section.key as Exclude<SectionKey, "personal">}
                      entries={readSectionEntries(
                        section,
                        section.key as Exclude<SectionKey, "personal">,
                      )}
                      onChange={(entries) =>
                        updateSectionEntries(section.key as Exclude<SectionKey, "personal">, entries)
                      }
                      t={t}
                      locale={locale}
                    />
                  </SectionShell>
                </SortableItem>
              ))}
            </Sortable>
          </div>
        </div>

        <aside
          className={cn(
            "shrink-0 overflow-hidden rounded-2xl border bg-card",
            "w-[min(420px,45vw)]",
            previewOpen ? "block" : "hidden",
          )}
        >
          <PreviewPanel resume={resume} locale={locale} t={t} />
        </aside>
      </div>
    </div>
  );
}