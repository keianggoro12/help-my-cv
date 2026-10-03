import { AdminUsersPage } from "@/components/admin/admin-users-page";
import { AdminPortalLayout } from "@/components/portal/admin-portal-layout";

export default function AdminUsersRoute() {
  return (
    <AdminPortalLayout>
      <AdminUsersPage />
    </AdminPortalLayout>
  );
}
