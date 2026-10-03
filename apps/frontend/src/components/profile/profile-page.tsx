"use client";

import * as React from "react";

import { useSession } from "@/components/providers/session-provider";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { updateProfile } from "@/lib/auth-store";
import { formatDate } from "@/lib/format";
import { API_BASE, readToken } from "@/lib/api-client";
import { Camera, Loader2 } from "lucide-react";

function AvatarPreview({ name, imageUrl }: { name: string; imageUrl: string | null | undefined }) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt={name} className="h-20 w-20 rounded-full object-cover ring-2 ring-background shadow-sm" />;
  }
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground ring-2 ring-background shadow-sm">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

/** Name / phone editor. Email and password changes are out of phase 1 scope. */
export function ProfilePage() {
  const { user, refresh, t, locale } = useSession();
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Seed the inputs once the session is known, not during first render.
  React.useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone);
    }
  }, [user]);

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const token = readToken();
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/storage/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (res.ok) {
        const data = await res.json();
        let url = data?.url;
        if (url && url.startsWith("/")) url = `${API_BASE}${url}`;
        if (url) {
          updateProfile(user.id, { imageUrl: url });
          refresh();
          toast({ type: "success", title: t("profile.photoUpdated") });
          return;
        }
      }
      // Fallback to data URL if upload failed
      const reader = new FileReader();
      reader.onload = () => {
        updateProfile(user.id, { imageUrl: reader.result as string });
        refresh();
        toast({ type: "success", title: t("profile.photoUpdated") });
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const { toast } = useToast();

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      return;
    }
    updateProfile(user.id, { name: name.trim() || user.name, phone: phone.trim() });
    refresh();
    setSaved(true);
    toast({ type: "success", title: t("resume.saved") });
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
          {/* Avatar upload */}
          <div className="flex items-center gap-4">
            <AvatarPreview name={user.name} imageUrl={user.imageUrl} />
            <div className="space-y-2">
              <label htmlFor="profile-avatar" className="flex items-center gap-2 cursor-pointer">
                <Camera className="h-4 w-4" />
                <span className="text-sm font-medium text-foreground">{uploading ? t("profile.uploading") : t("profile.changePhoto")}</span>
                <input
                  id="profile-avatar"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={uploading}
                  className="sr-only"
                  ref={fileInputRef}
                />
              </label>
              <p className="text-xs text-muted-foreground">{t("profile.photoHint")}</p>
            </div>
          </div>

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
