"use client";

/**
 * Auto CV: describe the job history in plain text, the model drafts the CV.
 *
 * The form stays deliberately bare — a name, one textarea and the same
 * template grid the Create-CV dialog uses — because everything else in the
 * request is the model's job. What this screen owns is failure: a rejected
 * key, a rate limit and a garbled reply are different problems for the person
 * waiting, so each one gets its own message instead of a generic error.
 */

import type { ResumeTemplateId } from "@helpmycv/shared";
import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { useSession } from "@/components/providers/session-provider";
import { TemplateGrid } from "@/components/resume/template-grid";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { API_ENABLED, ApiError, api } from "@/lib/api-client";

/** Engine error codes the user can actually act on; anything else is generic. */
const ERROR_KEYS: Record<string, string> = {
  not_configured: "autoResume.notConfigured",
  invalid_key: "autoResume.invalidKey",
  rate_limited: "autoResume.rateLimited",
  network_error: "autoResume.networkError",
  invalid_response: "autoResume.invalidResponse",
};

export function AutoResumePage() {
  const router = useRouter();
  const { user, loading, locale, t } = useSession();
  const { toast } = useToast();

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [templateId, setTemplateId] = React.useState<ResumeTemplateId>("blank");
  const [pending, setPending] = React.useState(false);

  if (!loading && !user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-sm text-muted-foreground">
        <p>{t("editor.sessionExpired")}</p>
        <Button onClick={() => router.push("/")}>{t("editor.back")}</Button>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !user) {
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (trimmedTitle === "") {
      toast({ type: "error", title: t("autoResume.nameRequired") });
      return;
    }
    if (trimmedDescription === "") {
      toast({ type: "error", title: t("autoResume.descriptionRequired") });
      return;
    }
    // Demo mode has no backend to hold a key or call a provider.
    if (!API_ENABLED) {
      toast({ type: "error", title: t("autoResume.backendRequired") });
      return;
    }

    setPending(true);
    try {
      const { resume } = await api.generateAutoResume({
        title: trimmedTitle,
        description: trimmedDescription,
        templateId,
        locale,
      });
      // The row already exists server-side, so the editor route is real.
      router.push(`/user/${resume.id}/edit`);
    } catch (error) {
      console.error("auto resume failed", error);
      const code = error instanceof ApiError ? error.code : "";
      toast({
        type: "error",
        title: t((ERROR_KEYS[code] ?? "autoResume.failed") as never),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6 p-1 py-4">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden />
          {t("autoResume.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("autoResume.subtitle")}</p>
      </header>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6 rounded-2xl border bg-card p-6">
        <div className="space-y-2">
          <FieldLabel htmlFor="auto-resume-title" required>
            {t("autoResume.nameLabel")}
          </FieldLabel>
          <Input
            id="auto-resume-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("autoResume.namePlaceholder")}
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="auto-resume-description" required>
            {t("autoResume.descriptionLabel")}
          </FieldLabel>
          <Textarea
            id="auto-resume-description"
            rows={12}
            className="min-h-[200px]"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t("autoResume.descriptionPlaceholder")}
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <FieldLabel>{t("autoResume.templateLabel")}</FieldLabel>
          <TemplateGrid value={templateId} onChange={setTemplateId} />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {t("autoResume.process")}
          </Button>
        </div>
      </form>

      {/*
        The whole screen greys out while the model runs. A generation can take
        ten seconds or more, and a spinner inside the button alone reads as
        "nothing happened" at that length — the scrim says the page is busy and
        blocks a second submit at the same time. Built from the same scrim and
        card recipe as `Dialog` rather than a new overlay component.
      */}
      {pending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 animate-[fade-in_200ms_ease-out] bg-black/50" />
          <div
            role="status"
            aria-live="polite"
            className="relative z-10 flex items-center gap-3 rounded-2xl border bg-card px-6 py-5 shadow-xl animate-[pop-in_220ms_cubic-bezier(0.32,0.72,0,1)]"
          >
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
            <span className="text-sm font-medium text-foreground">{t("autoResume.processing")}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
