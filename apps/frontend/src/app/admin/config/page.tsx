import { AdminConfigPage } from "@/components/admin/admin-config-page";
import { AdminPortalLayout } from "@/components/portal/admin-portal-layout";

export default function AdminConfigRoute() {
  return (
    <AdminPortalLayout>
      <AdminConfigPage />
    </AdminPortalLayout>
  );
}
