"use client";

/**
 * Create-CV flow: template picker, then name.
 *
 * Two steps rather than one form because they answer different questions, and
 * the second step is short enough that merging them would only add noise. The
 * chosen template is carried between them, so going back does not lose it.
 *
 * Only "Blank" is selectable in phase 1; the rest render as disabled cards
 * with a "Coming soon" badge, so the eventual template gallery does not need
 * a layout change when the others ship.
 */

import type { ResumeTemplateId } from "@helpmycv/shared";
import { RESUME_TEMPLATES } from "@helpmycv/shared";
import { ArrowLeft, Check } from "lucide-react";
import * as React from "react";

import { useSession } from "@/components/providers/session-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CreateResumeDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (templateId: ResumeTemplateId, title: string) => void;
}

export function CreateResumeDialog({ open, onClose, onCreate }: CreateResumeDialogProps) {
  const { t } = useSession();
  const [step, setStep] = React.useState<"template" | "name">("template");
  const [template, setTemplate] = React.useState<ResumeTemplateId>("blank");
  const [title, setTitle] = React.useState("");

  // Reopening always starts from a clean template step.
  React.useEffect(() => {
    if (open) {
      setStep("template");
      setTemplate("blank");
      setTitle("");
    }
  }, [open]);

  function handleCreate() {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }
    onCreate(template, trimmed);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={step === "template" ? t("resume.chooseTemplateTitle") : t("resume.nameTitle")}
      description={step === "template" ? t("resume.chooseTemplateSubtitle") : t("resume.nameSubtitle")}
    >
      {step === "template" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            {RESUME_TEMPLATES.map((item) => {
              const selected = template === item.id;
              const disabled = !item.available;

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setTemplate(item.id)}
                  aria-pressed={selected}
                  className={cn(
                    "relative flex flex-col gap-2 rounded-2xl border p-4 text-left transition-colors",
                    disabled
                      ? "cursor-not-allowed border-dashed opacity-60"
                      : selected
                        ? "border-primary bg-primary/5"
                        : "hover:bg-accent",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {t(`resume.template.${item.id}` as never)}
                    </span>
                    {selected ? <Check className="h-4 w-4 text-primary" /> : null}
                  </div>
                  <div className="h-20 rounded-lg border bg-card p-2" aria-hidden>
                    <div className="h-2 w-8 rounded-full bg-muted" />
                    <div className="mt-2 space-y-1">
                      <div className="h-1.5 w-full rounded-full bg-muted" />
                      <div className="h-1.5 w-4/5 rounded-full bg-muted" />
                    </div>
                    <div className="mt-2 h-1.5 w-6 rounded-full bg-muted" />
                  </div>
                  {disabled ? (
                    <span className="text-xs font-medium text-muted-foreground">
                      {t("resume.template.comingSoon")}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end">
            <Button disabled={!template} onClick={() => setStep("name")}>
              {t("resume.continue")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleCreate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <FieldLabel htmlFor="resume-title" required>
                {t("resume.nameLabel")}
              </FieldLabel>
              <Input
                id="resume-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("resume.namePlaceholder")}
                autoFocus
                required
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep("template")}>
                <ArrowLeft className="h-4 w-4" />
                {t("resume.cancel")}
              </Button>
              <Button type="submit" disabled={!title.trim()}>
                {t("resume.continue")}
              </Button>
            </div>
          </form>
        </>
      )}
    </Dialog>
  );
}
