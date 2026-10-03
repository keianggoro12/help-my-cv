import type { ReactNode } from "react";

import { UserPortalLayout } from "@/components/portal/user-portal-layout";

export default function UserLayout({ children }: { children: ReactNode }) {
  return <UserPortalLayout>{children}</UserPortalLayout>;
}
