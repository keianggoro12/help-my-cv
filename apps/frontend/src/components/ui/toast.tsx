"use client";

import * as React from "react";
import { CheckCircle, AlertCircle, Info, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info" | "loading";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (toast: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5" />,
  error: <AlertCircle className="h-5 w-5" />,
  info: <Info className="h-5 w-5" />,
  loading: <Loader2 className="h-5 w-5 animate-spin" />,
};

/**
 * One accent per outcome, expressed through the app's own tokens so a toast
 * inherits light and dark from `html.dark` exactly like every other surface.
 *
 * The previous palette spelled each type out in raw Tailwind colours with hand
 * picked `dark:` pairs, which is why the four toasts looked like they came from
 * different apps and why a toast raised on a light page could keep a dark
 * background. Everything below resolves from `--primary`, `--destructive` and
 * the card surfaces, so there is nothing left to keep in sync by hand.
 *
 * `ACCENT_BAR` is kept separate from `ACCENT_ICON` because they land on
 * different elements: the icon inherits colour from its wrapper, the bar is a
 * positioned sibling that has to be told its own background. Folding the bar's
 * colour into the icon's class via a nested `[&_[data-slot=…]]` variant
 * generated no rule at all, leaving the bar transparent.
 */
const ACCENT_ICON: Record<ToastType, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  error: "text-destructive",
  info: "text-primary",
  loading: "text-muted-foreground",
};

const ACCENT_BAR: Record<ToastType, string> = {
  success: "bg-emerald-500",
  error: "bg-destructive",
  info: "bg-primary",
  loading: "bg-muted-foreground",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const toast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...toast, id }]);
    if (toast.duration !== 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, toast.duration ?? 4000);
    }
    return id;
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div
      // Above the dialog (z-50). A toast raised from inside a modal — signing in
      // or registering both fire one before navigating — was painted underneath
      // the overlay and by the panel, which is why those toasts seemed to never
      // appear. The dialog is the only other z-50 layer in the app, so this is
      // the one number that has to beat it.
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:max-w-sm md:max-w-md"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [leaving, setLeaving] = React.useState(false);

  function handleDismiss() {
    setLeaving(true);
    // Let the exit animation finish before the row leaves the list, otherwise
    // it vanishes mid-slide and the motion reads as a glitch.
    window.setTimeout(() => onDismiss(toast.id), 200);
  }

  return (
    <div
      className={cn(
        "pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border bg-card px-4 py-3 pl-5 text-card-foreground shadow-lg",
        "animate-[toast-in_280ms_cubic-bezier(0.32,0.72,0,1)]",
        leaving && "animate-[toast-out_200ms_ease-in_forwards]",
      )}
      role="alert"
    >
      {/* A hairline in the outcome colour down the leading edge. Carries the
          type without tinting the whole surface, which keeps every toast on
          `bg-card` and therefore legible in both themes. */}
      <span
        data-slot="toast-accent"
        aria-hidden="true"
        className={cn("absolute inset-y-0 left-0 w-1", ACCENT_BAR[toast.type])}
      />
      <div className={cn("mt-0.5 shrink-0", ACCENT_ICON[toast.type])}>{ICONS[toast.type]}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{toast.title}</p>
        {toast.message ? (
          <p className="mt-0.5 break-words text-sm leading-snug text-muted-foreground">
            {toast.message}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="-mr-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}