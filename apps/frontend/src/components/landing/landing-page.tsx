"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, ShieldCheck } from "lucide-react";
import * as React from "react";

import { AuthDialog } from "@/components/auth/auth-dialog";
import { buildMarketingNav } from "@/components/auth/marketing-nav";
import { useSession } from "@/components/providers/session-provider";
import { Button } from "@/components/ui/button";
import { NavBar } from "@/components/ui/tubelight-navbar";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const HIGHLIGHTS = [
  {
    title: "One home for every version",
    body: "Keep your master CV and the tailored one per application side by side, instead of in Downloads with a timestamp you can't read.",
  },
  {
    title: "Sections you control",
    body: "Hide what a given role does not care about, reorder the rest, and pin Personal Information so it always sits on top.",
  },
  {
    title: "Better bullets, less rewriting",
    body: "Ask the AI engine to tighten a bullet in place. It rewrites the sentence, it does not invent achievements for you.",
  },
] as const;

export function LandingPage() {
  const router = useRouter();
  const { t, user, loading } = useSession();
  const [authOpen, setAuthOpen] = React.useState(false);
  const [authMode, setAuthMode] = React.useState<"login" | "register">("login");

  // The hero has separate Log in and Sign up buttons, so the mode has to be
  // chosen before the dialog mounts — `initialMode` is only read on open.
  function openAuth(mode: "login" | "register") {
    setAuthMode(mode);
    setAuthOpen(true);
  }

  // Someone who is already signed in has no business on the marketing page.
  React.useEffect(() => {
    if (!loading && user) {
      router.replace(user.role === "admin" ? "/admin/dashboard" : "/user/dashboard");
    }
  }, [loading, router, user]);

  const navItems = React.useMemo(() => buildMarketingNav(t), [t]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-28 sm:px-6 sm:pb-16">
        <header className="flex items-center justify-between py-5">
          <div className="flex items-center gap-2">
            <img src="/logo-icon.png" alt="HelpMyCV" className="h-6 w-6 object-contain shrink-0" />
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button size="sm" onClick={() => openAuth("login")}>
              <LogIn className="h-4 w-4" />
              {t("nav.login")}
            </Button>
          </div>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t("brand.name")}
          </p>
          <h1 className="mt-4 max-w-2xl text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {t("brand.tagline")}
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-muted-foreground">{t("brand.subtitle")}</p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={() => openAuth("login")}>
              {t("nav.login")}
            </Button>
            <Button size="lg" variant="outline" onClick={() => openAuth("register")}>
              {t("nav.register")}
            </Button>
          </div>

          {/* Small, on purpose: admins are not part of the audience here. */}
          <Link
            href="/admin"
            className="mt-8 inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {t("nav.adminLogin")}
          </Link>
        </section>

        <section className="grid gap-4 pb-8 sm:grid-cols-3">
          {HIGHLIGHTS.map((item) => (
            <div key={item.title} className="rounded-3xl border bg-card p-5 text-left">
              <h2 className="text-sm font-semibold text-foreground">{item.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </section>
      </div>

      <NavBar items={navItems} />

      <AuthDialog
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode={authMode}
      />
    </main>
  );
}
