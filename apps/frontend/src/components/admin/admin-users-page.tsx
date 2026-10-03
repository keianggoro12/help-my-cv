"use client";

import * as React from "react";

import { useSession } from "@/components/providers/session-provider";
import { Badge } from "@/components/ui/badge";
import { readJson, STORAGE_KEYS } from "@/lib/storage";
import { formatDate } from "@/lib/format";
import type { UserProfile } from "@helpmycv/shared";

/** Read-only user list. Role changes and moderation are out of phase 1 scope. */
export function AdminUsersPage() {
  const { t, locale } = useSession();
  const [users, setUsers] = React.useState<UserProfile[]>([]);

  React.useEffect(() => {
    setUsers(
      Object.values(readJson<Record<string, UserProfile>>(STORAGE_KEYS.users, {})).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
  }, []);

  return (
    <div className="space-y-6 p-1 py-4">
      <header>
        <h1 className="text-2xl font-bold text-foreground">{t("admin.users")}</h1>
      </header>

      <div className="overflow-x-auto rounded-3xl border bg-card shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">{t("auth.name")}</th>
              <th className="px-5 py-3 font-medium">{t("auth.email")}</th>
              <th className="px-5 py-3 font-medium">{t("auth.phone")}</th>
              <th className="px-5 py-3 font-medium">{t("admin.joined")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b last:border-0">
                <td className="px-5 py-3 font-medium text-foreground">{user.name}</td>
                <td className="px-5 py-3 text-muted-foreground">{user.email}</td>
                <td className="px-5 py-3 text-muted-foreground">{user.phone}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(user.createdAt, locale)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
