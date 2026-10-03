"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { useSession } from "@/components/providers/session-provider";

/**
 * Client-side route guard.
 *
 * Waits for `loading` before redirecting: without that, a hard refresh on a
 * protected page would read the not-yet-restored session as "signed out" and
 * bounce the user to the login page, which is exactly the bug that bit the
 * Jastip admin layout when `/api/me` and `/api/auth/me` disagreed.
 */
export function useRequireAuth(role: "user" | "admin"): { ready: boolean } {
  const { user, loading } = useSession();
  const router = useRouter();

  React.useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      router.replace(role === "admin" ? "/admin" : "/");
      return;
    }
    if (user.role !== role) {
      // Signed in, but on the wrong side of the app.
      router.replace(user.role === "admin" ? "/admin/dashboard" : "/user/dashboard");
    }
  }, [loading, role, router, user]);

  return { ready: !loading && !!user && user.role === role };
}
