"use client";

/**
 * Pill navbar for the marketing front page.
 *
 * `activeTab` is owned by the caller and defaults to the pathname, so the
 * highlighted item follows real navigation instead of only following clicks
 * (the demo version of this component only ever followed clicks, which made
 * the lamp sit on "Home" after a back navigation).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export interface NavBarItem {
  name: string;
  url: string;
  icon: LucideIcon;
}

interface NavBarProps {
  items: NavBarItem[];
  className?: string;
  /** Overrides the pathname-derived active item. */
  activeUrl?: string;
}

export function NavBar({ items, className, activeUrl }: NavBarProps) {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState(activeUrl ?? pathname);

  useEffect(() => {
    if (activeUrl) {
      setActiveTab(activeUrl);
    } else {
      setActiveTab(pathname);
    }
  }, [activeUrl, pathname]);

  return (
    <div className={cn("fixed bottom-0 left-1/2 z-50 -translate-x-1/2 sm:bottom-auto sm:top-0 sm:pt-6", className)}>
      <div className="flex items-center gap-3 rounded-full border border-border bg-background/80 py-1 pl-1 pr-1 shadow-lg backdrop-blur-lg sm:pr-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.url;

          return (
            <Link
              key={item.name}
              href={item.url}
              onClick={() => setActiveTab(item.url)}
              className={cn(
                "relative cursor-pointer whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold transition-colors",
                "text-foreground/80 hover:text-primary",
                isActive && "text-primary",
              )}
            >
              {/* Mobile collapses to the icon alone; the label stays in the DOM
                  for screen readers rather than being dropped. */}
              <span className="hidden md:inline">{item.name}</span>
              <span className="md:hidden">
                <Icon size={18} strokeWidth={2.5} aria-hidden />
              </span>
              {isActive ? (
                <motion.div
                  layoutId="lamp"
                  className="absolute inset-0 -z-10 rounded-full bg-primary/10"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  <div className="absolute -top-2 left-1/2 w-8 -translate-x-1/2 rounded-t-full bg-primary">
                    <div className="absolute -left-2 -top-2 h-6 w-12 rounded-full bg-primary/20 blur-md" />
                    <div className="absolute -top-1 h-6 w-8 rounded-full bg-primary/20 blur-md" />
                    <div className="absolute left-2 top-0 h-4 w-4 rounded-full bg-primary/20 blur-sm" />
                  </div>
                </motion.div>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
