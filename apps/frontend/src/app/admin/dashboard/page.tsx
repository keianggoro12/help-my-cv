import { AdminDashboardPage } from "@/components/admin/admin-dashboard-page";
import { AdminPortalLayout } from "@/components/portal/admin-portal-layout";

export default function AdminDashboardRoute() {
  return (
    <AdminPortalLayout>
      <AdminDashboardPage />
    </AdminPortalLayout>
  );
}
