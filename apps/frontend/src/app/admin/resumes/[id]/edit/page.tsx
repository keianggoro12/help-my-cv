"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { EditorPage } from "@/components/editor/editor-page";
import { useSession } from "@/components/providers/session-provider";
import { Button } from "@/components/ui/button";

/**
 * Admin editor for one CV, mounted at `/admin/resumes/[id]/edit`.
 *
 * A separate route rather than reusing `/user/[id]/edit` because that page
 * resolves the CV through the owner-scoped `GET /api/resumes/:id`, which answers
 * 404 for anyone but the owner — so an admin opening a user's CV from the admin
 * table landed on "not found" with no way back. `EditorPage` takes a loader, so
 * the admin path supplies the unscoped one and everything below the editor is
 * the same component the user sees.
 */
export default function AdminEditResumePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { user, loading, t } = useSession();
  const [resumeId, setResumeId] = React.useState<string | null>(null);

  React.useEffect(() => {
    params.then((p) => setResumeId(p.id));
  }, [params]);

  // An ordinary account has no business here even if it guesses the URL; the
  // API would reject the read anyway, but bouncing here means no blank frame.
  React.useEffect(() => {
    if (!loading && !user) {
      router.push("/admin");
    }
  }, [loading, user, router]);

  if (!loading && !user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-sm text-muted-foreground">
        <p>{t("editor.sessionExpired")}</p>
        <Button onClick={() => router.push("/admin")}>{t("editor.back")}</Button>
      </div>
    );
  }

  if (loading || !user || !resumeId) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center gap-3 text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        {t("editor.loading")}
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-sm text-muted-foreground">
        <p>{t("admin.loadFailed")}</p>
        <Button onClick={() => router.push("/admin/resumes")}>{t("admin.resumes")}</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-[2000px] flex-col px-2 sm:px-4 lg:px-6">
      <EditorPage resumeId={resumeId} loader="admin" />
    </div>
  );
}