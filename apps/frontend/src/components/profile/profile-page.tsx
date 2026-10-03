"use client";

import * as React from "react";

import { useSession } from "@/components/providers/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { updateProfile } from "@/lib/auth-store";
import { formatDate } from "@/lib/format";

/** Name / phone editor. Email and password changes are out of phase 1 scope. */
export function ProfilePage() {
  const { user, refresh, t, locale } = useSession();
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [saved, setSaved] = React.useState(false);

  // Seed the inputs once the session is known, not during first render.
  React.useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone);
    }
  }, [user]);

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      return;
    }
    updateProfile(user.id, { name: name.trim() || user.name, phone: phone.trim() });
    refresh();
    setSaved(true);
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6 p-1 py-4">
      <header>
        <h1 className="text-2xl font-bold text-foreground">{t("sidebar.profile")}</h1>
      </header>

      <Card>
        <CardContent className="space-y-4 p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel htmlFor="profile-name" required>
                  {t("auth.name")}
                </FieldLabel>
                <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="profile-phone">{t("auth.phone")}</FieldLabel>
                <Input
                  id="profile-phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="profile-email">{t("auth.email")}</FieldLabel>
              <Input id="profile-email" value={user.email} readOnly disabled />
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit">{t("resume.save")}</Button>
              {saved ? <span className="text-sm text-muted-foreground">{t("resume.saved")}</span> : null}
            </div>
          </form>

          <div className="flex flex-wrap items-center gap-3 border-t pt-4 text-sm text-muted-foreground">
            <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge>
            <span>
              {t("overview.lastUpdated")}: {formatDate(user.createdAt, locale)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
