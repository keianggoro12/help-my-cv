"use client";

import * as React from "react";

import { useSession } from "@/components/providers/session-provider";
import { useToast } from "@/components/ui/toast";
import { api, API_ENABLED } from "@/lib/api-client";
import { readJson, STORAGE_KEYS } from "@/lib/storage";
import type { UserProfile } from "@helpmycv/shared";

export function AdminDashboardPage() {
  const { t } = useSession();
  const { toast } = useToast();
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const [resumeCount, setResumeCount] = React.useState(0);
  // Counted from the overview response rather than thrown away: the endpoint
  // reports the user total, and the dashboard was rendering a hardcoded 0
  // next to a resume count that did work.
  const [userCount, setUserCount] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (API_ENABLED) {
        try {
          const res = await api.adminOverview();
          if (cancelled) return;
          setUserCount(res.stats.users ?? 0);
          setResumeCount(res.stats.resumes ?? 0);
        } catch (e) {
          console.error("admin overview", e);
          if (!cancelled) {
            toast({ type: "error", title: t("admin.loadFailed") });
          }
        }
        return;
      }
      const store = readJson<Record<string, UserProfile[]>>(STORAGE_KEYS.resumes, {});
      if (cancelled) return;
      const list = Object.values(readJson<Record<string, UserProfile>>(STORAGE_KEYS.users, {}));
      setUsers(list);
      setUserCount(list.length);
      setResumeCount(Object.values(store).reduce((total, entries) => total + entries.length, 0));
    })();
    return () => {
      cancelled = true;
    };
  }, [t, toast]);

  const stats = [
    { label: t("admin.users"), value: API_ENABLED ? userCount : users.length },
    { label: t("admin.resumes"), value: resumeCount },
  ];

  return (
    <div className="space-y-6 p-1 py-4">
      <header>
        <h1 className="text-2xl font-bold text-foreground">{t("admin.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.subtitle")}</p>
      </header>

      <div data-slot="content-enter" className="grid gap-4 sm:grid-cols-2">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-3xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-3xl border border-dashed bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("admin.comingSoon")}</p>
      </section>
    </div>
  );
}