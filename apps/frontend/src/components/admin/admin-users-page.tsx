"use client";

import * as React from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";

import { useSession } from "@/components/providers/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { ApiUser } from "@helpmycv/shared";

type Draft = { name: string; role: "user" | "admin" };

export function AdminUsersPage() {
  const { t, locale } = useSession();
  const { toast } = useToast();
  const [users, setUsers] = React.useState<ApiUser[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [editTarget, setEditTarget] = React.useState<ApiUser | null>(null);
  const [draft, setDraft] = React.useState<Draft>({ name: "", role: "user" });
  const [saving, setSaving] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<ApiUser | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.adminUsers();
        if (cancelled) return;
        // Stored verbatim: widening this into `UserProfile` meant inventing a
        // `phone` and a `createdAt` of `new Date()`, which put "Joined today"
        // on every row. The list renders exactly what the API returns.
        setUsers(res.users ?? []);
      } catch (cause) {
        // Without this the table simply stayed empty, which reads as "no users
        // exist" and hides a real fault.
        console.error("admin user list failed", cause);
        toast({ type: "error", title: t("admin.loadFailed") });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t, toast]);

  function openEdit(user: ApiUser) {
    setEditTarget(user);
    setDraft({ name: user.name, role: user.role === "admin" ? "admin" : "user" });
  }

  async function handleSaveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTarget) {
      return;
    }
    const name = draft.name.trim();
    if (!name) {
      return;
    }
    setSaving(true);
    try {
      // Only the changed fields are sent. `email` is not among them on purpose:
      // it is the account's login identity and the endpoint does not accept it,
      // so a save can never silently change the address someone signs in with.
      const payload: { name?: string; role?: string } = { name };
      if (draft.role !== editTarget.role) {
        payload.role = draft.role;
      }
      const { user } = await api.adminUpdateUser(editTarget.id, payload);
      setUsers((current) => current.map((row) => (row.id === user.id ? user : row)));
      setEditTarget(null);
      toast({ type: "success", title: t("admin.userUpdated") });
    } catch (cause) {
      // `cannot_demote_self` is the one case with a message worth showing
      // verbatim: the form looks editable, so a silent failure would leave the
      // admin pressing Save over and over.
      const code = cause instanceof ApiError ? cause.code : "";
      if (code === "cannot_demote_self") {
        toast({ type: "error", title: t("admin.cannotDemoteSelf") });
      } else {
        console.error("admin update user failed", cause);
        toast({ type: "error", title: t("admin.userUpdateFailed") });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    try {
      await api.adminDeleteUser(deleteTarget.id);
      setUsers((current) => current.filter((user) => user.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast({ type: "success", title: t("admin.userDeleted") });
    } catch (cause) {
      console.error("admin delete user failed", cause);
      toast({ type: "error", title: t("admin.userDeleteFailed") });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6 p-1 py-4">
      <header>
        <h1 className="text-2xl font-bold text-foreground">{t("admin.users")}</h1>
      </header>

      <div
        data-slot="content-enter"
        className="overflow-x-auto rounded-3xl border bg-card shadow-sm"
      >
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">{t("auth.name")}</th>
              <th className="px-5 py-3 font-medium">{t("auth.email")}</th>
              <th className="px-5 py-3 font-medium">{t("auth.phone")}</th>
              <th className="px-5 py-3 font-medium">{t("admin.joined")}</th>
              <th className="w-12 px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b last:border-0">
                <td className="px-5 py-3 font-medium text-foreground">
                  {/* `/admin/users` is the user's own record; the CV editor is
                      keyed by resume id, so a user id here is a 404. */}
                  <Link href={`/admin/users?user=${user.id}`} className="hover:underline">
                    {user.name}
                  </Link>
                </td>
                <td className="px-5 py-3 text-muted-foreground">{user.email}</td>
                <td className="px-5 py-3 text-muted-foreground">—</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge>
                    {user.createdAt ? (
                      <span className="text-xs text-muted-foreground">
                        {formatDate(user.createdAt, locale)}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-5 py-3 text-right">
                  <RowActionsMenu
                    label={t("admin.rowActions", { name: user.name || user.email })}
                    actions={[
                      {
                        id: "edit",
                        label: t("admin.editUser"),
                        icon: <Pencil className="h-4 w-4 text-muted-foreground" />,
                        onSelect: () => openEdit(user),
                      },
                      {
                        id: "delete",
                        label: t("admin.deleteUser"),
                        icon: <Trash2 className="h-4 w-4" />,
                        destructive: true,
                        onSelect: () => setDeleteTarget(user),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {users.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-foreground">
                  {t("admin.emptyResumes")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title={t("admin.editUserTitle")}
        dismissible={!saving}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="space-y-2">
            <FieldLabel htmlFor="admin-user-email">{t("auth.email")}</FieldLabel>
            {/* Shown read-only rather than as an editable input: the endpoint
                refuses to change it, and an input that silently discards what
                was typed is worse than one that never invited the edit. */}
            <Input
              id="admin-user-email"
              value={editTarget?.email ?? ""}
              readOnly
              className="text-muted-foreground"
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="admin-user-name" required>
              {t("admin.editUserName")}
            </FieldLabel>
            <Input
              id="admin-user-name"
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="admin-user-role">{t("admin.editUserRole")}</FieldLabel>
            <Select
              id="admin-user-role"
              value={draft.role}
              onChange={(event) =>
                setDraft((current) => ({ ...current, role: event.target.value as Draft["role"] }))
              }
            >
              <option value="user">{t("admin.roleUser")}</option>
              <option value="admin">{t("admin.roleAdmin")}</option>
            </Select>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setEditTarget(null)} disabled={saving}>
              {t("resume.cancel")}
            </Button>
            <Button type="submit" disabled={saving || !draft.name.trim()}>
              {t("resume.save")}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("admin.deleteUserTitle")}
        description={
          deleteTarget
            ? t("admin.deleteUserBody", { name: deleteTarget.name || deleteTarget.email })
            : undefined
        }
        dismissible={!deleting}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t("resume.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {t("admin.deleteUserCta")}
            </Button>
          </>
        }
      />
    </div>
  );
}