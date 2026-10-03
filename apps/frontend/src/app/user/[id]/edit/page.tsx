import { EditorPage } from "@/components/editor/editor-page";

export default async function EditResumePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditorPage resumeId={id} />;
}
