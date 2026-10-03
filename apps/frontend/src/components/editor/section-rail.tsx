"use client";

/**
 * Section rail: the left column of the editor.
 *
 * It is the single place that decides a section's order and whether it is on,
 * so the centre column can stay a plain form. The drag handle lives here and
 * the drop targets are the rail rows, which means reordering is a one-column
 * gesture rather than dragging a 600px card around.
 *
 * Personal Information is passed in as `locked` and rendered without a handle
 * or an eye: it is pinned first and always visible, so there is nothing here to
 * drag or switch off.
 */

import { Eye, EyeOff, GripVertical, Lock } from "lucide-react";
import * as React from "react";

import type { ResumeSection, SectionKey, TranslationKey } from "@helpmycv/shared";
import { translateSection } from "@helpmycv/shared";

import { Sortable, SortableItem, SortableItemHandle } from "@/components/ui/sortable";
import { cn } from "@/lib/utils";

interface SectionRailProps {
  sections: ResumeSection[];
  locale: "en" | "id";
  activeKey: SectionKey | null;
  onReorder: (sections: ResumeSection[]) => void;
  onToggle: (key: SectionKey) => void;
  onJump: (key: SectionKey) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

export function SectionRail({
  sections,
  locale,
  activeKey,
  onReorder,
  onToggle,
  onJump,
  t,
}: SectionRailProps) {
  const personal = sections.filter((section) => section.key === "personal");
  const movable = sections.filter((section) => section.key !== "personal");

  return (
    <nav aria-label={t("editor.outline")} className="space-y-1">
      <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("editor.outline")}
      </p>

      {personal.map((section) => {
        // The locked row is outside the Sortable set, so it needs the active
        // treatment applied by hand — otherwise scrolling up into Personal
        // Information highlights nothing at all in the rail.
        const active = section.key === activeKey;
        return (
          <div
            key={section.key}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-2 py-2",
              active ? "border-primary/40 bg-accent" : "border-dashed bg-card/60 opacity-80",
            )}
          >
            <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-left text-sm text-muted-foreground">
              {translateSection(locale, section.key)}
            </span>
          </div>
        );
      })}

      <Sortable
        value={movable}
        onValueChange={onReorder}
        getItemValue={(section) => section.key}
        className="space-y-1"
      >
        {movable.map((section) => {
          const count = section.entries.items.length;
          const active = section.key === activeKey;

          return (
            <SortableItem key={section.key} value={section.key}>
              <div
                className={cn(
                  "group flex items-center gap-1.5 rounded-xl border px-2 py-1.5 transition-colors",
                  active ? "border-primary/40 bg-accent" : "border-transparent hover:bg-accent/60",
                  !section.visible && "opacity-60",
                )}
              >
                <SortableItemHandle
                  className="rounded-md p-0.5 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                  label={t("editor.dragHandle")}
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </SortableItemHandle>

                <button
                  type="button"
                  onClick={() => onJump(section.key)}
                  className="min-w-0 flex-1 truncate text-left text-sm text-foreground"
                >
                  {section.title?.trim() ? section.title : translateSection(locale, section.key)}
                </button>

                {count > 0 ? (
                  <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">
                    {count}
                  </span>
                ) : null}

                <button
                  type="button"
                  onClick={() => onToggle(section.key)}
                  aria-label={
                    section.visible ? t("editor.hideSection") : t("editor.showSection")
                  }
                  title={section.visible ? t("editor.hideSection") : t("editor.showSection")}
                  className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {section.visible ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </SortableItem>
          );
        })}
      </Sortable>
    </nav>
  );
}

/**
 * Tracks which section the reader is currently looking at.
 *
 * Driven by the container's scroll event rather than an IntersectionObserver.
 * An observer only fires when a tracked element's intersection *changes*, so
 * it goes silent whenever a section above grows (a card expands, an entry is
 * added) — the tracked boxes are still intersecting but nothing changed, and
 * the rail keeps highlighting a section that is no longer under the reader.
 * A scroll handler always recomputes from live geometry.
 *
 * The band is 96px from the top of the container, matching SectionShell's
 * `scroll-mt-24`, so a section that a jump just scrolled to counts as active
 * immediately instead of the rail lagging one section behind.
 */
export function useActiveSection(
  container: React.RefObject<HTMLElement | null>,
  keys: SectionKey[],
): [SectionKey | null, (key: SectionKey) => void] {
  const [activeKey, setActiveKey] = React.useState<SectionKey | null>(null);
  // The key list is rebuilt on every render by the caller, so the effect keys
  // off its contents rather than its identity.
  const keySignature = keys.join(",");

  React.useEffect(() => {
    const containerElement = container.current;
    const list = keySignature.split(",").filter(Boolean) as SectionKey[];
    if (!containerElement || list.length === 0) {
      return;
    }
    // Bound once so the scroll and resize handlers below keep the non-null
    // type instead of re-widening to `HTMLElement | null` inside closures.
    const root: HTMLElement = containerElement;

    const elements = list
      .map((key) => ({ key, element: root.querySelector<HTMLElement>(`#section-${key}`) }))
      .filter(
        (entry): entry is { key: SectionKey; element: HTMLElement } => entry.element !== null,
      );

    if (elements.length === 0) {
      return;
    }

    // Matches `scroll-mt-24` on SectionShell: a jump leaves the section 96px
    // down, so a shallower band would leave the rail one section behind.
    const BAND_TOP_PX = 96;

    let frame = 0;
    function update() {
      const band = root.getBoundingClientRect().top + BAND_TOP_PX;
      // The last section whose top has passed the band; the first section is
      // the fallback while the reader is still above the first heading.
      let current = elements[0];
      // When we're at the very top, favour Personal if present.
      if (root.scrollTop <= 12) {
        setActiveKey("personal");
        return;
      }
      for (const entry of elements) {
        if (entry.element.getBoundingClientRect().top <= band) {
          current = entry;
        }
      }
      setActiveKey((previous) => (previous === current.key ? previous : current.key));
    }
function onScroll() {
if (frame !== 0) {
  return;
}
frame = window.requestAnimationFrame(() => {
  frame = 0;
  update();
});
}

// Ensure the highlight matches immediately after a jump (smooth scroll).
// Also recompute on the first paint even if scroll didn't fire.
update();
root.addEventListener("scroll", onScroll, { passive: true });
const resize = new ResizeObserver(() => {
update();
});
resize.observe(root);
// Recompute once more after layout settles — some cases (jump + layout
// shift) need one extra pass before intersection settles.
window.setTimeout(() => {
update();
}, 0);
    return () => {
      root.removeEventListener("scroll", onScroll);
      resize.disconnect();
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [container, keySignature]);

  const jump = React.useCallback(
    (key: SectionKey) => {
      const target = container.current?.querySelector<HTMLElement>(`#section-${key}`);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [container],
  );

  return [activeKey, jump];
}