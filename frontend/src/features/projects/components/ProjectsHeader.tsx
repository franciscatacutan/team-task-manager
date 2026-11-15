import { FolderKanban } from "lucide-react";

import CreateButton from "@/common/components/CreateButton";

interface Props {
  onCreateProject: () => void;
  canCreateProject: boolean;
}

export function ProjectsHeader({ onCreateProject, canCreateProject }: Props) {
  return (
    <section className="rounded-2xl border border-border/60 bg-linear-to-br from-background via-background to-muted/20 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <FolderKanban className="h-3.5 w-3.5" />
            Project workspace
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Projects
          </h1>
          <p className="text-sm text-muted-foreground">
            Review and organize the projects owned by this team.
          </p>
        </div>

        {canCreateProject && (
          <CreateButton entity="project" onClick={onCreateProject} />
        )}
      </div>
    </section>
  );
}
