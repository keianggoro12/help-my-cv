"use client";

/**
 * Shared mobile chrome for the user and admin portals.
 *
 * Both portals render the same header bar, drawer and hamburger and only pass
 * their own nav items, user and accent. That is deliberate: when the two
 * dashboards grew their own header independently, admin ended up with two
 * hamburgers and the two portals drifted apart on avatar size, paddings and
 * drawer width.
 *
 * Desktop is untouched — this component is `md:hidden`, and the sidebars that
 * replace it on large screens are unchanged.
 */

import { Menu, X, type LucideIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { cn } from "@/lib/utils";

export interface MobileNavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
}

interface MobileChromeProps {
  /** Fallback secondary line under the name when no role is supplied. */
  title: string;
  userName: string;
  userImage?: string | null;
  /** Secondary line under the name, e.g. "Admin". */
  userRole?: string;
  navItems: MobileNavItem[];
  activeKey?: string;
  /** Called when an item without an `href` is tapped. */
  onNavigate?: (key: string) => void;
  footer?: React.ReactNode;
}

/** Avatar size is fixed so both portals match exactly. */
function Avatar({ name, image }: { name: string; image?: string | null }) {
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt={name} className="h-10 w-10 shrink-0 rounded-xl object-cover" />
  ) : (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-semibold text-muted-foreground">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function MobileChrome({
  title,
  userName,
  userImage,
  userRole,
  navItems,
  activeKey,
  onNavigate,
  footer,
}: MobileChromeProps) {
  const [open, setOpen] = useState(false);
  useBodyScrollLock(open);

  return (
    <>
      <div className="flex items-center justify-between gap-2 bg-card px-4 py-3 shadow-sm md:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={userName} image={userImage} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{userName}</p>
            <p className="truncate text-xs text-muted-foreground">{userRole ?? title}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <Button variant="outline" size="sm" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 animate-[scrim-in_220ms_ease-out] bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="fixed right-0 top-0 h-full w-64 animate-[drawer-in_260ms_cubic-bezier(0.32,0.72,0,1)] bg-card shadow-xl">
            <div className="flex items-center justify-between gap-2 border-b p-4">
              <p className="font-semibold text-foreground">Menu</p>
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="rounded-xl p-2 text-muted-foreground hover:bg-accent"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <nav className="space-y-1 p-3">
              {navItems.map((item) => {
                const content = (
                  <>
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </>
                );
                const className = cn(
                  "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition",
                  activeKey === item.key
                    ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                );

                return item.href ? (
                  <a key={item.key} href={item.href} className={className}>
                    {content}
                  </a>
                ) : (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      onNavigate?.(item.key);
                      setOpen(false);
                    }}
                    className={className}
                  >
                    {content}
                  </button>
                );
              })}
            </nav>

            {footer ? <div className="absolute bottom-0 w-full border-t p-3">{footer}</div> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
