"use client";

/**
 * Sidebar for the user and admin portals.
 *
 * One component serves both dashboards. They differ only in nav items, title
 * and accent, and the *active* item style is a single definition here on
 * purpose: Jastip gave each sidebar index its own gradient, which read as a
 * bug when the highlight changed colour as you moved down the list.
 *
 * Layout follows Jastip: the aside is `hidden md:flex`, `w-72`, `rounded-3xl`
 * and sticky, so the marketing page's full-bleed sections and the dashboard
 * share one max-width rhythm.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, type LucideIcon } from "lucide-react";

import { useSession } from "@/components/providers/session-provider";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitch } from "@/components/portal/language-switch";
import type { TranslationKey } from "@helpmycv/shared";
import { cn } from "@/lib/utils";

export interface SidebarItem {
  key: string;
  href: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
}

export interface PortalSidebarProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: SidebarItem[];
  /** Path prefixes that keep an item lit while nested (e.g. inside an editor). */
  activePrefixes?: Record<string, string>;
  /** Where the user card at the bottom links to. */
  profileHref: string;
}

function Avatar({ name, image }: { name: string; image: string | null }) {
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt={name} className="h-11 w-11 rounded-2xl object-cover" />
  ) : (
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-xs font-semibold text-muted-foreground">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function PortalSidebar({
  eyebrow,
  title,
  subtitle,
  items,
  activePrefixes = {},
  profileHref,
}: PortalSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, t } = useSession();

  function isActive(item: SidebarItem) {
    if (pathname === item.href) {
      return true;
    }
    const prefix = activePrefixes[item.key];
    return prefix ? pathname.startsWith(prefix) : false;
  }

  function handleSignOut() {
    signOut();
    router.push("/");
  }

  return (
    <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-72 shrink-0 flex-col rounded-3xl bg-card p-5 shadow-sm md:flex">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {eyebrow}
        </div>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <nav className="mt-8 space-y-2">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition",
              isActive(item)
                ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {t(item.labelKey)}
          </Link>
        ))}
      </nav>

      <div className="mt-auto space-y-3">
        {/* The user card doubles as the Profile link — the PRD puts profile at
            the bottom of the sidebar next to sign out, so it is the card
            itself rather than a fourth nav item up top. */}
        <Link
          href={profileHref}
          className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-accent"
        >
          <Avatar name={user?.name ?? ""} image={user?.imageUrl ?? null} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{t("sidebar.profile")}</p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitch className="flex-1" />
          <Button
            variant="outline"
            className="flex-1 justify-start"
            onClick={handleSignOut}
            aria-label={t("sidebar.signOut")}
          >
            <LogOut className="h-4 w-4" />
            {t("sidebar.signOut")}
          </Button>
        </div>
      </div>
    </aside>
  );
}
