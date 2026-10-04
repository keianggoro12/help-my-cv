"use client";

import * as React from "react";
import Link from "next/link";

import { useSession } from "@/components/providers/session-provider";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { Resume } from "@helpmycv/shared";

export function AdminResumesPage() {
  const { t, locale } = useSession();
  const [resumes, setResumes] = React.useState<Array<Resume & { ownerEmail: string }>>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.adminResumes();
        if (cancelled) return;
        setResumes(
          (res.resumes ?? []).map((r) => ({
            id: r.id,
            title: r.title,
            userId: r.userId,
            updatedAt: r.updatedAt,
            createdAt: (r as any).createdAt ?? r.updatedAt,
            sections: [] as any,
            personal: {
              fullName: r.ownerEmail || "",
              role: "",
              email: r.ownerEmail || "",
              phone: "",
              location: "",
              linkedin: "",
              website: "",
              summary: "",
            } as any,
            ownerEmail: r.ownerEmail,
          } as any)),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6 p-1 py-4">
      <header>
        <h1 className="text-2xl font-bold text-foreground">{t("admin.resumes")}</h1>
      </header>

      {resumes.length === 0 && !loading ? (
        <div className="rounded-3xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
          {t("admin.emptyResumes")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border bg-card shadow-sm">
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
                    <Link href={`/user/${resume.userId}/edit`} className="hover:underline">
                      {resume.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    <Link href={`/user/${resume.userId}/edit`} className="hover:underline">
                      {resume.ownerEmail ?? resume.personal?.fullName ?? "—"}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{formatDate(resume.updatedAt, locale)}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      aria-label="Actions"
                      onClick={() => {
                        window.open(`/user/${resume.userId}/edit`, "_blank");
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-more-horizontal"
                      >
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="19" cy="12" r="1" />
                        <circle cx="5" cy="12" r="1" />
                      </svg>
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