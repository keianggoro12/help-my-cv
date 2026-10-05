"use client";

/**
 * Pointer-tracked gradient behind the marketing page.
 *
 * Two blurred squares sit under the content and follow the cursor. The
 * implementation choices that are not obvious:
 *
 *   - The pointer only ever writes a `translate3d`. Animating a
 *     viewport-sized `background-position` (or applying a `filter: blur()` to
 *     a full-screen layer) repaints the whole layer on every pointer event,
 *     which is the difference between this gliding and this stuttering. The
 *     softness lives in the gradient stops instead of in a blur filter, and
 *     the easing lives in a CSS transition instead of in a rAF loop, so both
 *     stay on the compositor.
 *
 *   - The coordinates are custom properties on <html>, not React state. A
 *     pointermove fires far more often than React should re-render, and this
 *     layer has nothing to re-render — it is decoration behind
 *     `pointer-events: none`. Writing a style property on the document element
 *     costs nothing and never touches the tree React reconciles.
 *
 *   - Nothing here knows which theme is active. The tint and the blend mode are
 *     swapped by the `.dark` class in globals.css, so toggling the theme
 *     updates the glow on the next frame with no work from this component.
 */

import * as React from "react";

export function LandingAura() {
  React.useEffect(() => {
    const root = document.documentElement;

    // Offsets from the centre of the viewport rather than absolute page
    // coordinates: the layers are centred and translate by this, so a resize
    // only changes the offset, never the gradient inside the layer.
    function paint(clientX: number, clientY: number) {
      root.style.setProperty(
        "--aura-dx",
        `${Math.round(clientX - window.innerWidth / 2)}px`,
      );
      root.style.setProperty(
        "--aura-dy",
        `${Math.round(clientY - window.innerHeight / 2)}px`,
      );
    }

    function onPointerMove(event: PointerEvent) {
      // A finger drag would park the glow wherever the touch lifted, and a
      // scroll gesture is not a cursor at all.
      if (event.pointerType === "touch") return;
      paint(event.clientX, event.clientY);
    }

    // Recentres after a resize so the glow does not stay off to one side.
    function onResize() {
      paint(window.innerWidth / 2, window.innerHeight / 2);
    }

    // Start dead centre: a pointer that never moves (a phone, a keyboard-only
    // reader) still gets the gradient rather than an empty page.
    onResize();

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      root.style.removeProperty("--aura-dx");
      root.style.removeProperty("--aura-dy");
    };
  }, []);

  return (
    <div className="landing-aura" aria-hidden="true">
      <div className="landing-aura__layer landing-aura__tint" />
      <div className="landing-aura__layer landing-aura__gloss" />
    </div>
  );
}
