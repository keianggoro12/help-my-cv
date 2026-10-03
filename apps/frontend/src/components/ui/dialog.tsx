"use client";

import * as React from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Modal dialog.
 *
 * Rendered only when `open` is true, so the DOM never holds a hidden dialog
 * that could trap focus. Escape and scrim clicks both close it; the body scroll
 * lock lives in `useBodyScrollLock` and is shared with the mobile drawer so
 * the two can never disagree about whether the page behind is scrollable.
 */
export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Disable closing via Escape/scrim, e.g. while an async action runs. */
  dismissible?: boolean;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  dismissible = true,
}: DialogProps) {
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && dismissible) {
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dismissible, onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="fixed inset-0 animate-[fade-in_200ms_ease-out] bg-black/50"
        onClick={() => {
          if (dismissible) {
            onClose();
          }
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative z-10 flex max-h-[90vh] w-full flex-col overflow-y-auto rounded-t-3xl border bg-card p-6 shadow-xl animate-[pop-in_220ms_cubic-bezier(0.32,0.72,0,1)] sm:max-w-lg sm:rounded-3xl",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 id={titleId} className="text-lg font-semibold text-foreground">
              {title}
            </h2>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {children ? <div className="mt-6">{children}</div> : null}
        {footer ? <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div> : null}
      </div>
    </div>
  );
}
