import { useEffect } from "react";

/**
 * Locks body scrolling while a modal or drawer is open.
 *
 * Saves and restores the previous value rather than setting "hidden" blindly,
 * so a nested lock (dialog opened from the mobile drawer) unwinds in the
 * right order instead of leaving the page permanently unscrollable.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [active]);
}
