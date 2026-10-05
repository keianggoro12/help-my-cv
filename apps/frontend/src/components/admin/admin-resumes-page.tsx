"use client";

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";

import { useSession } from "@/components/providers/session-provider";
import { Badge } from "@/components/ui/badge";
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

  const openEditor = (resumeId: string) => {
    window.open(`/user/${resumeId}/edit`, "_blank", "noopener");
  };

  return (
    <div className="space-y-6 p-1 py-4">
      <header>
        <h1 className="text-2xl font-bold text-foreground">{t("admin.resumes")}</h1>
      </header>

      {resumes.length === 0 && !loading ? (
        <div className="rounded-3xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
          {error ? t("admin.loadFailed") : t("admin.emptyResumes")}
        </div>
      ) : (
        <div
          data-slot="content-enter"
          className="overflow-x-auto rounded-3xl border bg-card shadow-sm"
        >
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">{t("resume.nameLabel")}</th>
                <th className="px-5 py-3 font-medium">{t("admin.createdBy")}</th>
                <th className="px-5 py-3 font-medium">{t("admin.lastUpdate")}</th>
                <th className="w-12 px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {resumes.map((resume) => (
                <tr key={resume.id} className="border-b last:border-0">
                  <td className="px-5 py-3 font-medium text-foreground">
                    {/* The editor route is keyed by resume id, not user id. */}
                    <Link href={`/user/${resume.id}/edit`} className="hover:underline">
                      {resume.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {resume.ownerName || resume.ownerEmail || "—"}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Badge variant={resume.status === "final" ? "default" : "secondary"}>
                        {resume.status === "final" ? t("resume.status.final") : t("resume.status.draft")}
                      </Badge>
                      <span className="text-xs">{formatDate(resume.updatedAt, locale)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      aria-label={t("admin.openResume")}
                      title={t("admin.openResume")}
                      onClick={() => openEditor(resume.id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
