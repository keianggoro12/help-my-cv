"use client";

/**
 * Front-page auth dialog.
 *
 * One dialog with two modes rather than two dialogs, so switching between
 * login and sign-up does not tear down and rebuild the scrim, and so the
 * "don't have an account?" link can swap the mode in place.
 *
 * The dialog is a sibling of the page, not a child of the form, so pressing
 * Enter inside an input submits the form instead of falling through to
 * whatever the page has focused behind the scrim.
 */

import { useRouter } from "next/navigation";
import * as React from "react";

import { useSession } from "@/components/providers/session-provider";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { DEMO_CREDENTIALS, register, signIn, type AuthError } from "@/lib/auth-store";

type Mode = "login" | "register";

interface AuthDialogProps {
  open: boolean;
  onClose: () => void;
  /** Landing mode. The admin login page reuses this with `login` forced. */
  initialMode?: Mode;
  /** Set when an admin account is needed; hides sign-up and role copy. */
  adminOnly?: boolean;
}

const ERROR_MESSAGES: Record<AuthError, string> = {
  invalidCredentials: "auth.invalidCredentials",
  adminCredentials: "auth.adminCredentials",
  emailTaken: "auth.emailTaken",
  passwordMismatch: "auth.passwordMismatch",
} as const;

export function AuthDialog({ open, onClose, initialMode = "login", adminOnly = false }: AuthDialogProps) {
  const router = useRouter();
  const { t } = useSession();
  const { toast } = useToast();

  const [mode, setMode] = React.useState<Mode>(initialMode);
  const [error, setError] = React.useState<AuthError | null>(null);
  const [pending, setPending] = React.useState(false);

  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  // Reopen always lands on a clean form rather than the last error.
  React.useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError(null);
      setPending(false);
    }
  }, [open, initialMode]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const resultPromise =
      mode === "login"
        ? signIn({ email, password }, adminOnly ? "admin" : "user")
        : register({ name, phone, email, password, confirmPassword });

    resultPromise.then((result) => {
      setPending(false);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast({
        type: "success",
        title: mode === "login" ? t("auth.loginSuccess") : t("auth.registerSuccess"),
        message: mode === "login" ? t("auth.welcomeBack", { name: result.user.name }) : t("auth.accountCreated"),
      });

      onClose();
      router.push(result.user.role === "admin" ? "/admin/dashboard" : "/user/dashboard");
    });
  }

  const errorText = error
    ? t(ERROR_MESSAGES[error] as Parameters<typeof t>[0])
    : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === "login" ? t("auth.loginTitle") : t("auth.registerTitle")}
      description={mode === "login" ? t("auth.loginSubtitle") : t("auth.registerSubtitle")}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "register" ? (
          <>
            <div className="space-y-2">
              <FieldLabel htmlFor="auth-name" required>
                {t("auth.name")}
              </FieldLabel>
              <Input
                id="auth-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
              />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="auth-phone" required>
                {t("auth.phone")}
              </FieldLabel>
              <Input
                id="auth-phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                required
              />
            </div>
          </>
        ) : null}

        <div className="space-y-2">
          <FieldLabel htmlFor="auth-email" required>
            {t("auth.email")}
          </FieldLabel>
          <Input
            id="auth-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="auth-password" required>
            {t("auth.password")}
          </FieldLabel>
          <Input
            id="auth-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
        </div>

        {mode === "register" ? (
          <div className="space-y-2">
            <FieldLabel htmlFor="auth-confirm" required>
              {t("auth.confirmPassword")}
            </FieldLabel>
            <Input
              id="auth-confirm"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
        ) : null}

        {errorText ? (
          <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorText}
          </p>
        ) : null}

        {mode === "login" ? (
          <p className="text-xs text-muted-foreground">
            {t("auth.demoHint", {
              email: adminOnly ? DEMO_CREDENTIALS.admin.email : DEMO_CREDENTIALS.user.email,
              password: adminOnly ? DEMO_CREDENTIALS.admin.password : DEMO_CREDENTIALS.user.password,
            })}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {mode === "login" ? t("auth.loginCta") : t("auth.registerCta")}
        </Button>
      </form>

      {!adminOnly ? (
        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
          }}
          className="mt-4 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {mode === "login" ? t("auth.switchToRegister") : t("auth.switchToLogin")}
        </button>
      ) : null}
    </Dialog>
  );
}
