"use client";

/**
 * Row action menu for the tables.
 *
 * Portalled to `document.body` and positioned from a self-measured rect, rather
 * than `absolute` inside the table cell.
 *
 * The absolute version worked on desktop and broke on mobile, and the reason is
 * structural rather than cosmetic: both admin tables are wrapped in
 * `overflow-x-auto` so the table can scroll sideways on a narrow screen. That
 * wrapper establishes a clipping box, so an absolutely-positioned panel is cut
 * off the moment it extends past the table's bottom edge. Measured at 390px on
 * the last row of `/admin/users`: the menu rendered at y=612 with height 91,
 * the wrapper ended at y=621, and the menu's own bottom item was 82px past the
 * clip — `elementFromPoint` at that item's centre returned the table cell, not
 * the menu. The last action in the list was unclickable on exactly the row you
 * are most likely to act on.
 *
 * A portal escapes the clip entirely, which is the whole fix. The rest follows
 * from that: once the menu is positioned against the viewport rather than the
 * cell, it also has to stay inside the viewport, hence the two-pass
 * measure-then-place, the vertical flip, and the clamp.
 */

import { MoreHorizontal } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export interface RowAction {
  /** Stable id, also used as the React key and for the menu item's data-slot. */
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

type Placement = "below" | "above";

interface Position {
  left: number;
  top: number;
  placement: Placement;
  /** Set once the menu has been measured, so the first paint is not at 0,0. */
  ready: boolean;
}

/** Gap between the trigger and the panel, and the minimum gutter to the edge. */
const OFFSET = 8;
const MARGIN = 12;

export function RowActionsMenu({ actions, label, className }: RowActionsMenuProps) {
  const [open, setOpen] = React.useState(false);
  // `createPortal` has no document to target during SSR, and these pages render
  // on the server. Gating on a mount flag keeps the panel out of the server HTML
  // entirely rather than trying to portal during render.
  const [mounted, setMounted] = React.useState(false);
  const [position, setPosition] = React.useState<Position>({
    left: 0,
    top: 0,
    placement: "below",
    ready: false,
  });

  React.useEffect(() => setMounted(true), []);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const close = React.useCallback(() => setOpen(false), []);

  /**
   * Place the panel in two passes: render it once with no position so it can be
   * measured, then position it from that measurement. Doing it in one pass is
   * impossible — the trigger is near the right edge, and how far left the menu
   * has to start depends on how wide the menu turned out to be.
   */
  const place = React.useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) {
      return;
    }

    const anchor = trigger.getBoundingClientRect();
    const { width, height } = menu.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;

    // Right-aligned to the trigger: the kebab is always in the last column, so
    // its trailing edge is the edge that has to stay put.
    let left = anchor.right - width;

    // Clamp as a backstop for the case the alignment does not cover — a trigger
    // near the left gutter, or a menu wider than the space beside it.
    left = Math.min(Math.max(left, MARGIN), viewportWidth - width - MARGIN);

    // Flip above the trigger when there is not enough room below. Without this
    // the last rows of a long table push the menu off the bottom of the screen.
    const roomBelow = viewportHeight - anchor.bottom;
    const placement: Placement =
      roomBelow < height + OFFSET + MARGIN && anchor.top > height + OFFSET + MARGIN
        ? "above"
        : "below";

    const top =
      placement === "below" ? anchor.bottom + OFFSET : anchor.top - height - OFFSET;

    setPosition({
      left,
      // A menu taller than the space it was given scrolls rather than escapes.
      top: Math.max(MARGIN, Math.min(top, viewportHeight - height - MARGIN)),
      placement,
      ready: true,
    });
  }, []);

  // Measure after the panel is in the DOM but before the browser paints it, so
  // it never appears for one frame at the wrong place.
  React.useLayoutEffect(() => {
    if (open) {
      place();
    }
  }, [open, place]);

  // The anchor is a snapshot from click time. Any scroll or resize moves it, and
  // a menu left at the old coordinates points at empty space — or, on a table
  // scrolled sideways, at a different row entirely.
  React.useEffect(() => {
    if (!open) {
      return;
    }
    const onReflow = () => place();
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open, place]);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      // Both nodes are checked: the trigger is outside the portalled panel, so
      // a click on it would otherwise read as an outside click and close-then-
      // reopen instead of toggling.
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
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

  function openMenu() {
    setOpen(true);
  }

  const menu = open ? (
    <div
      ref={menuRef}
      role="menu"
      data-slot="row-actions-menu"
      data-placement={position.placement}
      // `fixed` because the coordinates are viewport-relative, which is what the
      // portal buys: no ancestor between the menu and the viewport to clip it.
      style={{
        left: position.left,
        top: position.top,
        // Hidden until measured. Without this the panel paints at 0,0 for one
        // frame, because `ready` is only set after the first measurement.
        visibility: position.ready ? "visible" : "hidden",
        // Grows out of the corner nearest the trigger, so it reads as coming
        // from the button rather than dropping from above itself.
        transformOrigin: position.placement === "above" ? "bottom right" : "top right",
        maxHeight: `calc(100vh - ${MARGIN * 2}px)`,
      }}
      className={cn(
        "fixed z-[60] w-52 overflow-y-auto overscroll-contain rounded-2xl border bg-card p-1 shadow-lg",
        "animate-[pop-in_140ms_cubic-bezier(0.32,0.72,0,1)]",
      )}
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
              close();
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
  ) : null;

  return (
    <>
      <div className={cn("relative inline-block text-left", className)} ref={containerRef}>
        <button
          ref={triggerRef}
          type="button"
          aria-label={label}
          title={label}
          aria-haspopup="menu"
          aria-expanded={open}
          data-slot="row-actions-trigger"
          onClick={open ? close : openMenu}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Portalled so no table wrapper can clip it. */}
      {mounted && menu ? createPortal(menu, document.body) : null}
    </>
  );
}