"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

import {
  DataTable,
  DataTableActionsCell,
  DataTableCell,
  DataTableHead,
} from "@/components/admin/data-table";

import { useSession } from "@/components/providers/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { ApiResumeSummary } from "@helpmycv/shared";

/** One row: the shared summary plus who owns it, exactly as the API sends it. */
type AdminResumeRow = ApiResumeSummary & { ownerEmail: string; ownerName: string };

export function AdminResumesPage() {
  const { t, locale } = useSession();
  const { toast } = useToast();
  const [resumes, setResumes] = React.useState<AdminResumeRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<AdminResumeRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api.adminResumes();
        if (cancelled) return;
        setResumes(result.resumes ?? []);
      } catch (cause) {
        // A rejected fetch here means the session died or the network is gone.
        // Say so rather than rendering "no CVs", which reads as "nobody has
        // made one" and hides a real fault.
        console.error("admin resume list failed", cause);
        if (!cancelled) {
          setError(true);
          toast({ type: "error", title: t("admin.loadFailed") });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t, toast]);

  /**
   * The editor route is keyed by resume id, and the editor loads through the
   * owner-scoped `GET /api/resumes/:id`. An admin signed in as themselves would
   * get a 404 on someone else's CV there, so this points at the admin editor
   * route instead, which reads through `/api/admin/resumes/:id`.
   */
  const editorHref = (resumeId: string) => `/admin/resumes/${resumeId}/edit`;

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    try {
      await api.adminDeleteResume(deleteTarget.id);
      // Dropped from the local list rather than refetched: this screen already
      // holds the full row set, and a refetch would re-run the animation and
      // lose the scroll position for a one-row change.
      setResumes((current) => current.filter((resume) => resume.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast({ type: "success", title: t("admin.resumeDeleted") });
    } catch (cause) {
      console.error("admin delete resume failed", cause);
      toast({ type: "error", title: t("admin.resumeDeleteFailed") });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6 p-1 py-4">
      <header>
        <h1 className="text-2xl font-bold text-foreground">{t("admin.resumes")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {resumes.length > 0
            ? t("admin.resumesCount", { count: resumes.length })
            : t("admin.resumesSubtitle")}
        </p>
      </header>

      {resumes.length === 0 && !loading ? (
        <div className="rounded-2xl border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">
          {error ? t("admin.loadFailed") : t("admin.emptyResumes")}
        </div>
      ) : (
        <DataTable minWidth="720px" data-slot="content-enter">
          <thead>
            <tr>
              <DataTableHead>{t("resume.nameLabel")}</DataTableHead>
              <DataTableHead>{t("admin.createdBy")}</DataTableHead>
              <DataTableHead>{t("admin.lastUpdate")}</DataTableHead>
              <DataTableHead className="w-16">
                <span className="sr-only">{t("admin.actions")}</span>
              </DataTableHead>
            </tr>
          </thead>
          <tbody>
            {resumes.map((resume) => {
              const owner = resume.ownerName || resume.ownerEmail || resume.userId;
              return (
                <tr
                  key={resume.id}
                  className="transition-colors hover:bg-muted/40"
                  data-slot="data-table-row"
                >
                  <DataTableCell className="max-w-[320px] font-medium text-foreground">
                    {/* The editor route is keyed by resume id, not user id. */}
                    <Link
                      href={editorHref(resume.id)}
                      title={resume.title}
                      className="block truncate hover:underline"
                    >
                      {resume.title}
                    </Link>
                  </DataTableCell>
                  <DataTableCell className="max-w-[200px]">
                    <span className="block truncate" title={owner}>
                      {owner}
                    </span>
                  </DataTableCell>
                  <DataTableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Badge variant={resume.status === "final" ? "default" : "secondary"}>
                        {resume.status === "final" ? t("resume.status.final") : t("resume.status.draft")}
                      </Badge>
                      <span className="text-xs">{formatDate(resume.updatedAt, locale)}</span>
                    </div>
                  </DataTableCell>
                  <DataTableActionsCell>
                    <RowActionsMenu
                      label={t("admin.rowActions", { name: resume.title })}
                      actions={[
                        {
                          id: "edit",
                          label: t("admin.editResume"),
                          icon: <Pencil className="h-4 w-4 text-muted-foreground" />,
                          onSelect: () => {
                            router.push(editorHref(resume.id));
                          },
                        },
                        {
                          id: "delete",
                          label: t("admin.deleteResume"),
                          icon: <Trash2 className="h-4 w-4" />,
                          destructive: true,
                          onSelect: () => setDeleteTarget(resume),
                        },
                      ]}
                    />
                  </DataTableActionsCell>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("admin.deleteResumeTitle")}
        description={
          deleteTarget ? t("admin.deleteResumeBody", { title: deleteTarget.title }) : undefined
        }
        dismissible={!deleting}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t("resume.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {t("admin.deleteResumeCta")}
            </Button>
          </>
        }
      />
    </div>
  );
}