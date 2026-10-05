"use client";

/**
 * Row action menu for the admin tables.
 *
 * Extracted from `resume-card.tsx`, which already had this shape working for a
 * user: a `MoreHorizontal` trigger plus a `role="menu"` panel that closes on
 * outside click or Escape. Duplicating it per admin page would have meant three
 * copies of the same dismiss logic, and the copy in `resume-card.tsx` carries a
 * lesson worth not repeating — a menu that only closes on a second click of its
 * trigger is a toggle, not a menu.
 *
 * `z-40` rather than `z-50`: the tables live inside `overflow-x-auto` containers,
 * and a panel above the sticky page header reads as belonging to a different
 * layer. Nothing else is mounted at that depth on these screens.
 */

import { MoreHorizontal } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

export interface RowAction {
  /** Stable id, also used as the React key and for the menu item's test id. */
  id: string;
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  /** Renders the item in the destructive colour and adds a separator above it. */
  destructive?: boolean;
}

interface RowActionsMenuProps {
  actions: RowAction[];
  /** Accessible name for the trigger, e.g. "Actions for Andi". */
  label: string;
  className?: string;
}

export function RowActionsMenu({ actions, label, className }: RowActionsMenuProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // The trigger sits in the last column of a table row that also contains a
  // `Link`. Without this, the panel is left on screen if the row unmounts
  // mid-interaction (a delete, a filter change) and the pointer is left over a
  // trigger that no longer exists.
  React.useEffect(() => {
    return () => setOpen(false);
  }, []);

  return (
    <div className={cn("relative inline-block text-left", className)} ref={containerRef}>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        data-slot="row-actions-trigger"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open ? (
        <div
          role="menu"
          data-slot="row-actions-menu"
          className="absolute right-0 top-10 z-40 w-52 overflow-hidden rounded-2xl border bg-card p-1 shadow-lg animate-[pop-in_140ms_cubic-bezier(0.32,0.72,0,1)]"
        >
          {actions.map((action, index) => (
            <React.Fragment key={action.id}>
              {action.destructive && index > 0 ? (
                <div className="my-1 h-px bg-border" role="separator" />
              ) : null}
              <button
                type="button"
                role="menuitem"
                data-slot={`row-action-${action.id}`}
                onClick={() => {
                  setOpen(false);
                  action.onSelect();
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  action.destructive
                    ? "text-destructive hover:bg-destructive/10"
                    : "text-foreground hover:bg-accent",
                )}
              >
                {action.icon}
                {action.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      ) : null}
    </div>
  );
}