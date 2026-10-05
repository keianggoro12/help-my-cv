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

import { ArrowLeft, Download, Eye, EyeOff, GripVertical, LayoutDashboard, Loader2, Printer, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { useSession } from "@/components/providers/session-provider";
import { useToast } from "@/components/ui/toast";
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
import { getResume, getResumeAsAdmin, saveResume, saveResumeAsAdmin } from "@/lib/resume-store";
import { cn } from "@/lib/utils";

const PERSONAL: SectionKey = "personal";
/** Below this width the field column wins and the preview is toggled by hand. */
const PREVIEW_QUERY = "(min-width: 1280px)";

interface EditorPageProps {
  resumeId: string;
  /**
   * Which store pair to read and write through.
   *
   * `"owner"` (the default) is the user's own CV and is scoped to their user id
   * everywhere. `"admin"` resolves the same document through the unscoped admin
   * endpoints, which is what lets an admin open and save a CV belonging to
   * somebody else — the owner-scoped endpoint answers 404 for it by design.
   */
  loader?: "owner" | "admin";
}

export function EditorPage({ resumeId, loader = "owner" }: EditorPageProps) {
  const router = useRouter();
  const { user, loading, locale, t } = useSession();

  const [resume, setResume] = React.useState<Resume | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [isWide, setIsWide] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (loading || !user) {
      return;
    }
    // The full document is a request of its own: the list endpoint returns
    // summaries only, so the editor cannot load a CV from the cached list.
    let cancelled = false;
    void (loader === "admin" ? getResumeAsAdmin(resumeId) : getResume(user.id, resumeId)).then(
      (found) => {
        if (cancelled) {
          return;
        }
        if (found) {
          setResume(found);
        } else {
          setNotFound(true);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [loading, loader, resumeId, user]);

  // Wide screens get the preview by default; narrow ones opt in, because two
  // columns of form plus a sheet at 1024px leaves the fields unusably thin.
  React.useEffect(() => {
    const query = window.matchMedia(PREVIEW_QUERY);
    setIsWide(query.matches);
    setPreviewOpen(query.matches);
    const onChange = (event: MediaQueryListEvent) => {
      setIsWide(event.matches);
      setPreviewOpen(event.matches);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // Below `xl` the preview takes over the whole screen (see `previewOnly`), so
  // the section drawer has nothing left to scroll to. Close it if it was open.
  const previewOnly = !isWide && previewOpen;

  React.useEffect(() => {
    if (previewOnly) {
      setSidebarOpen(false);
    }
  }, [previewOnly]);

  // Close mobile sidebar when screen grows past lg
  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    if (query.matches) setSidebarOpen(false);
    const onChange = (event: MediaQueryListEvent) => event.matches && setSidebarOpen(false);
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

  async function handleSave() {
    if (!resume) {
      return;
    }
    setSaving(true);
    try {
      // Not deferred any more: with the API live this is a network round trip,
      // so the spinner stays up for as long as it genuinely takes and a failure
      // can be reported instead of silently showing a success that did not land.
      setResume(loader === "admin" ? await saveResumeAsAdmin(resume) : await saveResume(resume));
      setDirty(false);
      setSaved(true);
      toast({ type: "success", title: t("resume.saved") });
    } catch (error) {
      console.error("save resume failed", error);
      toast({ type: "error", title: t("resume.saveFailed") });
    } finally {
      setSaving(false);
    }
  }

  function handleDownload() {
    if (!resume || dirty || saving) return;
    window.print();
    toast({ type: "info", title: t("editor.download"), message: t("editor.printDialogOpened") });
  }

  const { toast } = useToast();

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
        <Button
          className="mt-6"
          onClick={() => router.push(loader === "admin" ? "/admin/resumes" : "/user/resume-builder")}
        >
          {t("editor.back")}
        </Button>
      </div>
    );
  }

  // The document is a network round trip, so this state is real and visible.
  // Rendering `null` here produced a blank page with no spinner and no way to
  // tell loading from broken — which is exactly what it looked like.
  if (!resume) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center gap-3 text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("editor.loading")}
      </div>
    );
  }

  const personalSection = resume.sections.find((section) => section.key === PERSONAL);
  const movableSections = resume.sections.filter((section) => section.key !== PERSONAL);

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col py-2">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            // Back to whichever list this editor was opened from: the admin
            // table for someone else's CV, the user's own builder otherwise.
            onClick={() => router.push(loader === "admin" ? "/admin/resumes" : "/user/resume-builder")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-foreground">{resume.title}</h1>
            <p className="text-xs text-muted-foreground">
              {saved ? t("resume.saved") : t("editor.title")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPreviewOpen((open) => !open)}
            aria-pressed={previewOpen}
            className="xl:hidden"
          >
            {previewOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {previewOpen ? t("editor.hidePreview") : t("editor.showPreview")}
          </Button>

          <Button
            variant="outline"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-pressed={sidebarOpen}
            className="xl:hidden"
          >
            <LayoutDashboard className="h-4 w-4" />
            {t("editor.sections")}
          </Button>

          <Button variant="outline" onClick={() => window.print()} aria-label={t("editor.print")}>
            <Printer className="h-4 w-4" />
            {t("editor.print")}
          </Button>

          <Button
            variant="outline"
            onClick={handleDownload}
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
        {/* Mobile sidebar drawer */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-72 transform overflow-y-auto bg-card border-r shadow-xl transition-transform duration-300 lg:hidden lg:relative lg:translate-x-0 lg:shadow-none lg:border-none",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
          aria-label={t("editor.sections")}
        >
          <div className="flex items-center justify-between border-b p-3 lg:hidden">
            <p className="font-semibold text-foreground">{t("editor.outline")}</p>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} aria-label="Close">
              <X className="h-5 w-5" />
            </Button>
          </div>
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

        {/* Desktop sidebar. Hidden while the narrow-screen preview is taking
            over — rail rows scroll the form column, which is not on screen. */}
        <aside
          className={cn(
            "hidden w-56 shrink-0 overflow-y-auto pb-8 lg:block",
            previewOnly && "lg:hidden",
          )}
        >
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

        {/* Backdrop for mobile sidebar */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Below `xl` the preview is a full-width overlay rather than a third
            column: at 45vw the sheet and the fields each got ~150px, so the
            form was unusable on a phone. `hidden` (not `display:none` via a
            conditional) keeps the field column mounted and its scroll state
            intact, so toggling back is instant and no in-progress input is
            lost. */}
        <div
          ref={scrollRef}
          className={cn("min-w-0 flex-1 overflow-y-auto pb-16", previewOnly && "hidden")}
        >
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
            // Full width on narrow screens so the sheet is legible; a capped
            // column only when it shares the row with the form (xl and up).
            previewOnly ? "w-full" : "hidden xl:block xl:w-[min(420px,45vw)]",
          )}
        >
          <PreviewPanel resume={resume} locale={locale} t={t} />
        </aside>
      </div>
    </div>
  );
}