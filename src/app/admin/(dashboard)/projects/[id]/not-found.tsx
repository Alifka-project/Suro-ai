import { FolderKanban } from "lucide-react";
import { EmptyState, LinkButton } from "@/components/admin/ui";

export default function ProjectNotFound() {
  return (
    <EmptyState
      icon={FolderKanban}
      title="Project not found"
      description="It may have been deleted, or the link is out of date."
      action={<LinkButton href="/admin/projects">Back to projects</LinkButton>}
    />
  );
}
