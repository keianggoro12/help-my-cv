"use client";

/**
 * Personal Information fields.
 *
 * Locked section, so there is no header-level eye or grip here — the shell
 * handles that. The photo is a file input reading into a data URL: with no
 * upload backend in phase 1, a local preview is honest about what is stored
 * and what is not, and the field still has a working path in the UI.
 */

import { useRef } from "react";

import { Trash2 } from "lucide-react";

import type { PersonalInfo, TranslationKey } from "@helpmycv/shared";

import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface PersonalSectionProps {
  personal: PersonalInfo;
  onChange: (personal: PersonalInfo) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

export function PersonalSection({ personal, onChange, t }: PersonalSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  function patch(changes: Partial<PersonalInfo>) {
    onChange({ ...personal, ...changes });
  }

  function onPickPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        patch({ photoUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
    // Clear the input so picking the same file twice still fires a change.
    event.target.value = "";
  }

  function onRemovePhoto() {
    patch({ photoUrl: null });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        {/* The remove control is overlaid on the thumbnail rather than parked at
            the far edge of the row: it acts on this picture, so it has to sit on
            the picture. Spanning the row left the button ~100px from anything it
            referred to, which read as an unrelated action. */}
        <div className="relative shrink-0">
          {personal.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={personal.photoUrl}
              alt=""
              className="h-16 w-16 rounded-2xl border object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed text-xs text-muted-foreground">
              {t("field.photo")}
            </div>
          )}
          {personal.photoUrl ? (
            /* The badge is drawn small on the thumbnail's corner but its hit area
               is padded out to 32px, so the control stays reachable on touch
               without the badge covering the picture. */
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onRemovePhoto}
              aria-label={t("field.removePhoto")}
              title={t("field.removePhoto")}
              className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full border-2 border-background bg-background text-destructive shadow-sm hover:bg-background hover:text-destructive [&>svg]:h-3.5 [&>svg]:w-3.5"
            >
              <Trash2 />
            </Button>
          ) : null}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <FieldLabel htmlFor="personal-photo">{t("field.photo")}</FieldLabel>
          <input
            ref={fileRef}
            id="personal-photo"
            type="file"
            accept="image/*"
            onChange={onPickPhoto}
            className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-xs file:font-medium file:text-foreground"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <FieldLabel htmlFor="personal-name" required>
            {t("field.fullName")}
          </FieldLabel>
          <Input
            id="personal-name"
            value={personal.fullName}
            onChange={(event) => patch({ fullName: event.target.value })}
            autoComplete="name"
          />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="personal-role">{t("field.role")}</FieldLabel>
          <Input
            id="personal-role"
            value={personal.role}
            onChange={(event) => patch({ role: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="personal-email">{t("field.email")}</FieldLabel>
          <Input
            id="personal-email"
            type="email"
            value={personal.email}
            onChange={(event) => patch({ email: event.target.value })}
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="personal-phone">{t("field.phone")}</FieldLabel>
          <Input
            id="personal-phone"
            type="tel"
            value={personal.phone}
            onChange={(event) => patch({ phone: event.target.value })}
            autoComplete="tel"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <FieldLabel htmlFor="personal-address">{t("field.address")}</FieldLabel>
          <Input
            id="personal-address"
            value={personal.address}
            onChange={(event) => patch({ address: event.target.value })}
            autoComplete="street-address"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <FieldLabel htmlFor="personal-portfolio">{t("field.portfolioUrl")}</FieldLabel>
          <Input
            id="personal-portfolio"
            type="url"
            placeholder="https://"
            value={personal.portfolioUrl}
            onChange={(event) => patch({ portfolioUrl: event.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <FieldLabel htmlFor="personal-summary">{t("field.summary")}</FieldLabel>
        <Textarea
          id="personal-summary"
          value={personal.summary}
          onChange={(event) => patch({ summary: event.target.value })}
          rows={4}
        />
      </div>
    </div>
  );
}
