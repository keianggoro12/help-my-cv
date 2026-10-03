"use client";

import { useRouter } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import * as React from "react";

import { useSession } from "@/components/providers/session-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listResumes } from "@/lib/resume-store";
import { formatDate } from "@/lib/format";

export function OverviewPage() {
  const router = useRouter();
  const { user, loading, t } = useSession();
  const [resumes, setResumes] = React.useState(() =>
    user ? listResumes(user.id) : [],
  );

  // Re-read once the session is known; the initial state is empty because the
  // user id is unavailable during the first render.
  React.useEffect(() => {
    if (!loading && user) {
      setResumes(listResumes(user.id));
    }
  }, [loading, user]);

  const totals = React.useMemo(
    () => ({
      all: resumes.length,
      draft: resumes.filter((resume) => resume.status === "draft").length,
      final: resumes.filter((resume) => resume.status === "final").length,
    }),
    [resumes],
  );

  const lastUpdated = resumes[0]?.updatedAt ?? null;
  const recent = resumes.slice(0, 3);

  return (
    <div className="space-y-6 p-1 py-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("overview.greeting", { name: user?.name?.split(" ")[0] ?? "" })}
          </h1>
          <p className="text-sm text-muted-foreground">{t("overview.subtitle")}</p>
        </div>
        <Button onClick={() => router.push("/user/resume-builder?create=1")}>
          <Plus className="h-4 w-4" />
          {t("overview.createCta")}
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t("overview.totalResumes")}</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{totals.all}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t("overview.draft")}</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{totals.draft}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t("overview.finalized")}</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{totals.final}</p>
          </CardContent>
        </Card>
      </div>

      {lastUpdated ? (
        <p className="text-sm text-muted-foreground">
          {t("overview.lastUpdated")}: {formatDate(lastUpdated)}
        </p>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t("overview.recentResumes")}</h2>
          <Button variant="ghost" size="sm" onClick={() => router.push("/user/resume-builder")}>
            {t("overview.viewAll")}
          </Button>
        </div>

        {recent.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card p-10 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">{t("overview.emptyTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("overview.emptyBody")}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {recent.map((resume) => (
              <li key={resume.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/user/${resume.id}/edit`)}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border bg-card px-4 py-3 text-left transition-colors hover:bg-accent"
                >
                  <span className="truncate text-sm font-medium text-foreground">{resume.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(resume.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
