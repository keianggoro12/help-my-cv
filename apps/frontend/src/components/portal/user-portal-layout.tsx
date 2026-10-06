"use client";

import { FileText, LayoutDashboard, Sparkles } from "lucide-react";

import { PortalLayout } from "@/components/portal/portal-layout";
import type { SidebarItem } from "@/components/portal/portal-sidebar";
import { useSession } from "@/components/providers/session-provider";
import type { ReactNode } from "react";

const USER_NAV: SidebarItem[] = [
  { key: "overview", href: "/user/dashboard", labelKey: "sidebar.overview", icon: LayoutDashboard },
  // Auto CV sits above Resumes: it is where a CV starts when there is nothing
  // to edit yet, and the spec places it there deliberately.
  { key: "autoResume", href: "/user/auto-resume", labelKey: "sidebar.autoResume", icon: Sparkles },
  { key: "resumes", href: "/user/resume-builder", labelKey: "sidebar.resumes", icon: FileText },
];

/**
 * The personal card doubles as the Profile link, so the nav stays at two
 * items and the Resume Builder highlight survives navigation into the editor.
 */
const USER_ACTIVE_PREFIXES: Record<string, string> = {
  resumes: "/user/resume-builder",
};

export function UserPortalLayout({ children }: { children: ReactNode }) {
  const { t } = useSession();

  return (
    <PortalLayout
      role="user"
      eyebrow={t("brand.name")}
      title={t("sidebar.overview")}
      subtitle={t("overview.subtitle")}
      items={USER_NAV}
      activePrefixes={USER_ACTIVE_PREFIXES}
      profileHref="/user/profile"
    >
      {children}
    </PortalLayout>
  );
}
