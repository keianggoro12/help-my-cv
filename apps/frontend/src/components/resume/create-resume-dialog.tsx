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
import { ArrowLeft } from "lucide-react";
import * as React from "react";

import { useSession } from "@/components/providers/session-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { TemplateGrid } from "@/components/resume/template-grid";

interface CreateResumeDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * Async because with the API live the row is inserted server-side and the id
   * the editor needs only exists once the request resolves. Returning the
   * promise lets the dialog keep the submit button disabled meanwhile.
   */
  onCreate: (templateId: ResumeTemplateId, title: string) => void | Promise<void>;
  /** True while the create request is in flight. */
  pending?: boolean;
}

export function CreateResumeDialog({ open, onClose, onCreate, pending = false }: CreateResumeDialogProps) {
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
          <TemplateGrid value={template} onChange={setTemplate} />

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
              <Button type="submit" disabled={!title.trim() || pending}>
                {pending ? t("resume.creating") : t("resume.continue")}
              </Button>
            </div>
          </form>
        </>
      )}
    </Dialog>
  );
}
