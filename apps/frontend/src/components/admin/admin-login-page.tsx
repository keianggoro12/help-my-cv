"use client";

import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import * as React from "react";

import { AuthDialog } from "@/components/auth/auth-dialog";
import { useSession } from "@/components/providers/session-provider";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/**
 * Admin login.
 *
 * Separate from the user login by URL and by role, as the PRD asks: a normal
 * user account is rejected here rather than being quietly upgraded. Sign-up is
 * hidden — admins are provisioned, not self-registered.
 */
export function AdminLoginPage() {
  const router = useRouter();
  const { user, loading, t } = useSession();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!loading && user?.role === "admin") {
      router.replace("/admin/dashboard");
    }
  }, [loading, router, user]);

  // Already signed in as a normal user: say so instead of showing a form that
  // would reject the account they are currently using.
  const signedInAsUser = !loading && user?.role === "user";

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm rounded-3xl border bg-card p-8 text-center shadow-sm">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>

        <div className="mx-auto mt-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>

        <h1 className="mt-4 text-xl font-bold text-foreground">{t("nav.adminLogin")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.subtitle")}</p>

        {signedInAsUser ? (
          <>
            <p className="mt-6 rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {t("auth.adminCredentials")}
            </p>
            <Button className="mt-4 w-full" onClick={() => router.push("/user/dashboard")}>
              {t("sidebar.overview")}
            </Button>
          </>
        ) : (
          <Button className="mt-6 w-full" onClick={() => setOpen(true)}>
            {t("auth.loginCta")}
          </Button>
        )}
      </div>

      <AuthDialog
        open={open}
        onClose={() => setOpen(false)}
        initialMode="login"
        adminOnly
      />
    </main>
  );
}
