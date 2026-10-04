"use client";

import * as React from "react";
import Link from "next/link";

import { useSession } from "@/components/providers/session-provider";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { UserProfile } from "@helpmycv/shared";

export function AdminUsersPage() {
  const { t, locale } = useSession();
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.adminUsers();
        if (cancelled) return;
        setUsers(
          (res.users ?? []).map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            phone: "",
            imageUrl: u.imageUrl ?? null,
            createdAt: new Date().toISOString(),
          })),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
                <td className="px-5 py-3 font-medium text-foreground">
                  <Link href={`/user/${user.id}/edit`} className="hover:underline">
                    {user.name}
                  </Link>
                </td>
                <td className="px-5 py-3 text-muted-foreground">{user.email}</td>
                <td className="px-5 py-3 text-muted-foreground">{user.phone}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(user.createdAt, locale)}</span>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-sm text-muted-foreground">
                  {t("admin.emptyResumes")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}