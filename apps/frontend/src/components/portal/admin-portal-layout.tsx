"use client";

import { FileText, LayoutDashboard, Users } from "lucide-react";
import type { ReactNode } from "react";

import { PortalLayout } from "@/components/portal/portal-layout";
import type { SidebarItem } from "@/components/portal/portal-sidebar";
import { useSession } from "@/components/providers/session-provider";

const ADMIN_NAV: SidebarItem[] = [
  { key: "home", href: "/admin/dashboard", labelKey: "admin.title", icon: LayoutDashboard },
  { key: "users", href: "/admin/users", labelKey: "admin.users", icon: Users },
  { key: "resumes", href: "/admin/resumes", labelKey: "admin.resumes", icon: FileText },
];

export function AdminPortalLayout({ children }: { children: ReactNode }) {
  const { t } = useSession();

  return (
    <PortalLayout
      role="admin"
      eyebrow={t("sidebar.adminWorkspace")}
      title={t("admin.title")}
      subtitle={t("admin.subtitle")}
      items={ADMIN_NAV}
      profileHref="/admin/profile"
    >
      {children}
    </PortalLayout>
  );
}
