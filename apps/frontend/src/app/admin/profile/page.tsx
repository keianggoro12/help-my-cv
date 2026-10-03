import { AdminPortalLayout } from "@/components/portal/admin-portal-layout";
import { ProfilePage } from "@/components/profile/profile-page";

export default function AdminProfileRoute() {
  return (
    <AdminPortalLayout>
      <ProfilePage />
    </AdminPortalLayout>
  );
}