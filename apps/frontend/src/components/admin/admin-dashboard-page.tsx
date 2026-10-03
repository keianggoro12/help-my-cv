"use client";

import * as React from "react";

import { useSession } from "@/components/providers/session-provider";
import { readJson, STORAGE_KEYS } from "@/lib/storage";
import type { UserProfile } from "@helpmycv/shared";

/**
 * Admin dashboard.
 *
 * The PRD's admin scope for phase 1 is only "there is an admin dashboard", so
 * this reads the mock user store directly and shows real counts from it rather
 * than inventing a stats API. Every number here is derived from the same
 * localStorage the user side writes to, so the admin view and the user view
 * cannot disagree.
 */
export function AdminDashboardPage() {
  const { t } = useSession();
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const [resumeCount, setResumeCount] = React.useState(0);

  React.useEffect(() => {
    const store = readJson<Record<string, UserProfile[]>>(STORAGE_KEYS.resumes, {});
    setUsers(Object.values(readJson<Record<string, UserProfile>>(STORAGE_KEYS.users, {})));
    setResumeCount(Object.values(store).reduce((total, list) => total + list.length, 0));
  }, []);

  const stats = [
    { label: t("admin.users"), value: users.length },
    { label: t("admin.resumes"), value: resumeCount },
  ];

  return (
    <div className="space-y-6 p-1 py-4">
      <header>
        <h1 className="text-2xl font-bold text-foreground">{t("admin.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.subtitle")}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
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
