import { AdminResumesPage } from "@/components/admin/admin-resumes-page";
import { AdminPortalLayout } from "@/components/portal/admin-portal-layout";

export default function AdminResumesRoute() {
  return (
    <AdminPortalLayout>
      <AdminResumesPage />
    </AdminPortalLayout>
  );
}
