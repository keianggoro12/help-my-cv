import { Suspense } from "react";

import { ResumeBuilderPage } from "@/components/resume/resume-builder-page";

export default function ResumeBuilderRoute() {
  // useSearchParams needs a Suspense boundary; the page itself is static.
  return (
    <Suspense fallback={null}>
      <ResumeBuilderPage />
    </Suspense>
  );
}
