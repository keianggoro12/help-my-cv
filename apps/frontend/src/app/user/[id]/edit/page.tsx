"use client";

import { EditorPage } from "@/components/editor/editor-page";
import { useSession } from "@/components/providers/session-provider";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import * as React from "react";

interface EditResumePageProps {
  params: Promise<{ id: string }>;
}

export default function EditResumePage({ params }: EditResumePageProps) {
  const router = useRouter();
  const { user, loading, t } = useSession();
  const [resumeId, setResumeId] = React.useState<string | null>(null);

  // `use(params)` unwraps the promise during render, so there is no
  // `paramsReady` state to wait on. The previous version resolved `params` in
  // an effect and returned `null` until it had — which meant a blank page on
  // every navigation, not just a slow one.
  React.useEffect(() => {
    params.then((p) => setResumeId(p.id));
  }, [params]);

  React.useEffect(() => {
    if (!loading && !user) {
      router.push("/user/resume-builder");
    }
  }, [loading, user, router]);

  // Signed out: send them somewhere useful rather than showing an empty frame
  // for the length of the redirect.
  if (!loading && !user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-sm text-muted-foreground">
        <p>{t("editor.sessionExpired")}</p>
        <Button onClick={() => router.push("/user/resume-builder")}>{t("editor.back")}</Button>
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

  return <EditorPage resumeId={resumeId} />;
}
