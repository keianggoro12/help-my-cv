"use client";

/**
 * Portal layout shell for /user and /admin.
 *
 * Renders the shared mobile chrome above the content and the shared sidebar
 * beside it, so the two dashboards can only differ in their nav items and
 * copy — never in chrome. The editor hides the sidebar (a two-column form at
 * 288px wide is unusable), which is the one place the two layouts differ.
 */

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useSession } from "@/components/providers/session-provider";
import { LanguageSwitchIcon } from "@/components/portal/language-switch";
import { type PortalSidebarProps, PortalSidebar } from "@/components/portal/portal-sidebar";
import { MobileChrome, type MobileNavItem } from "@/components/ui/mobile-chrome";
import { useRequireAuth } from "@/lib/use-require-auth";
import { cn } from "@/lib/utils";

interface PortalLayoutProps extends Omit<PortalSidebarProps, "activePrefixes"> {
  role: "user" | "admin";
  activePrefixes?: Record<string, string>;
  children: ReactNode;
}
export function PortalLayout({
  role,
  eyebrow,
  title,
  subtitle,
  items,
  activePrefixes,
  profileHref,
  children,
}: PortalLayoutProps) {
  const { ready } = useRequireAuth(role);
  const { user, signOut, t } = useSession();
  const pathname = usePathname();

  // The editor gets the full width; the dashboards keep the sidebar.
  const hideSidebar = pathname.includes("/edit");

  const mobileItems: MobileNavItem[] = items.map((item) => ({
    key: item.key,
    label: t(item.labelKey),
    icon: item.icon,
    href: item.href,
  }));

  const activeKey = items.find((item) => {
    if (pathname === item.href) {
      return true;
    }
    const prefix = activePrefixes?.[item.key];
    return prefix ? pathname.startsWith(prefix) : false;
  })?.key;

  return (
    <main className="min-h-screen bg-muted/40 text-foreground">
      <div
        className={cn(
          "mx-auto flex h-[calc(100vh-2rem)] gap-6 px-4 py-4 sm:px-6 lg:px-8",
          // The editor manages its own column widths and vertical scrolling,
          // so it takes the whole viewport and drops the centred dashboard
          // measure instead of being capped at max-w-7xl.
          hideSidebar ? "max-w-none" : "max-w-7xl overflow-x-hidden",
        )}
      >
        {!hideSidebar ? (
          <PortalSidebar
            eyebrow={eyebrow}
            title={title}
            subtitle={subtitle}
            items={items}
            activePrefixes={activePrefixes}
            profileHref={profileHref}
          />
        ) : null}

        <div className="min-w-0 flex-1">
          <MobileChrome
            title={title}
            userName={user?.name ?? ""}
            userImage={user?.imageUrl}
            userRole={user?.role === "admin" ? t("sidebar.adminWorkspace") : undefined}
            navItems={mobileItems}
            activeKey={activeKey}
            footer={
              <div className="flex items-center gap-2">
                <LanguageSwitchIcon />
                <button
                  type="button"
                  onClick={signOut}
                  className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {t("sidebar.signOut")}
                </button>
              </div>
            }
          />

          {/* Holding the content back until the guard resolves avoids painting a
              dashboard for a moment before the redirect. */}
          <div className={ready ? undefined : "invisible"}>{children}</div>
        </div>
      </div>
    </main>
  );
}
