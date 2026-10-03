import { AdminLoginPage } from "@/components/admin/admin-login-page";

/**
 * Admin login, deliberately outside any admin layout.
 *
 * `app/admin/layout.tsx` used to wrap this page as well as the dashboard, which
 * meant the login screen rendered inside the auth guard that redirects
 * unauthenticated visitors to /admin — i.e. to itself. That redirect never
 * resolved, and after a successful sign-in the guarded shell and the login
 * form were both on screen. Each guarded admin page now mounts
 * `AdminPortalLayout` itself; this route stays layout-free.
 */
export default function AdminLoginRoute() {
  return <AdminLoginPage />;
}
