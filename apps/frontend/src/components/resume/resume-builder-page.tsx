"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import * as React from "react";

import { useSession } from "@/components/providers/session-provider";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { CreateResumeDialog } from "@/components/resume/create-resume-dialog";
import { ResumeCard } from "@/components/resume/resume-card";
import type { Resume } from "@helpmycv/shared";
import { createBlankResume, deleteResume, loadResumesForUser, renameResume } from "@/lib/resume-store";

/**
 * Resume Builder: the CV grid plus create / rename / delete.
 *
 * The list lives in component state and is re-read from storage after every
 * mutation rather than patched in place, so a card can never show a title
 * that disagrees with what is on disk.
 */
export function ResumeBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, locale, t } = useSession();
  const { toast } = useToast();

  const [resumes, setResumes] = React.useState<Resume[]>([]);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createPending, setCreatePending] = React.useState(false);
  const [renameTarget, setRenameTarget] = React.useState<Resume | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<Resume | null>(null);

  const refresh = React.useCallback(async () => {
    if (user) {
      setResumes(await loadResumesForUser(user.id));
    }
  }, [user]);

  React.useEffect(() => {
    if (!loading && user) {
      void refresh();
    }
  }, [loading, refresh, user]);

  // Redirect to homepage/login if not signed in (avoid showing a half-loaded builder)
  // The overview page deep-links here with ?create=1.
  React.useEffect(() => {
    if (!loading && user && searchParams.get("create") === "1") {
      setCreateOpen(true);
    }
  }, [loading, user, searchParams]);

  if (!loading && !user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-sm text-muted-foreground">
        <p>{t("editor.sessionExpired")}</p>
        <Button onClick={() => router.push("/")}>{t("editor.back")}</Button>
      </div>
    );
  }

  async function handleCreate(templateId: "blank" | "modern" | "classic" | "minimal", title: string) {
    if (!user) {
      return;
    }
    setCreatePending(true);
    try {
      const resume = await createBlankResume(
        user.id,
        title,
        templateId,
        user.email,
        { fullName: user.name, email: user.email, phone: user.phone },
      );
      setCreateOpen(false);
      router.push(`/user/${resume.id}/edit`);
    } catch (error) {
      // With the API live the id comes from the server, so a failed insert means
      // there is no CV to open — say so instead of navigating to a dead route.
      console.error("create resume failed", error);
      toast({ type: "error", title: t("resume.createFailed") });
    } finally {
      setCreatePending(false);
    }
  }

  async function handleRenameSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !renameTarget) {
      return;
    }
    const value = renameValue.trim();
    if (value) {
      try {
        await renameResume(user.id, renameTarget.id, value);
      } catch (error) {
        console.error("rename resume failed", error);
        toast({ type: "error", title: t("resume.renameFailed") });
        return;
      }
    }
    setRenameTarget(null);
    void refresh();
  }

  async function handleDelete() {
    if (!user || !deleteTarget) {
      return;
    }
    try {
      await deleteResume(user.id, deleteTarget.id);
    } catch (error) {
      console.error("delete resume failed", error);
      toast({ type: "error", title: t("resume.deleteFailed") });
      return;
    }
    setDeleteTarget(null);
    void refresh();
  }

  return (
    <div className="space-y-6 p-1 py-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("resume.builderTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("resume.builderSubtitle")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          {t("resume.create")}
        </Button>
      </header>

      {resumes.length === 0 ? (
        <div className="rounded-3xl border border-dashed bg-card p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm font-medium text-foreground">{t("resume.emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("resume.emptyBody")}</p>
          <Button className="mt-6" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("resume.create")}
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resumes.map((resume) => (
            <li key={resume.id}>
              <ResumeCard
                resume={resume}
                locale={locale}
                t={t}
                onEdit={() => router.push(`/user/${resume.id}/edit`)}
                onRename={() => {
                  setRenameTarget(resume);
                  setRenameValue(resume.title);
                }}
                onDelete={() => setDeleteTarget(resume)}
              />
            </li>
          ))}
        </ul>
      )}

      <CreateResumeDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
        pending={createPending}
      />

      <Dialog
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title={t("resume.rename")}
      >
        <form onSubmit={handleRenameSubmit} className="space-y-4">
          <div className="space-y-2">
            <FieldLabel htmlFor="rename-title" required>
              {t("resume.nameLabel")}
            </FieldLabel>
            <Input
              id="rename-title"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setRenameTarget(null)}>
              {t("resume.cancel")}
            </Button>
            <Button type="submit" disabled={!renameValue.trim()}>
              {t("resume.save")}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("resume.deleteConfirmTitle")}
        description={deleteTarget ? t("resume.deleteConfirmBody", { title: deleteTarget.title }) : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              {t("resume.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t("resume.deleteConfirmCta")}
            </Button>
          </>
        }
      />
    </div>
  );
}
