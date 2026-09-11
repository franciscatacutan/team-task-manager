import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { Project } from "../types/project.types";
import ProjectCard from "./ProjectCard";

interface Props {
  projects: Project[];
  isLoading: boolean;
  openProject: (projectKey: string) => void;
  onCreateProject: () => void;
  onClearFilters: () => void;
  canCreateProject: boolean;
  hasActiveFilters: boolean;
}

export default function ProjectsBoard({
  projects,
  isLoading,
  openProject,
  onCreateProject,
  onClearFilters,
  canCreateProject,
  hasActiveFilters,
}: Props) {
  return (
    <>
      {isLoading ? (
        <div className="overflow-hidden p-4 rounded-2xl border border-border/60 bg-background shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                className="h-56 animate-pulse rounded-2xl border border-border/60 bg-muted/25"
              />
            ))}
          </div>
        </div>
      ) : projects.length > 0 ? (
        <div className="flex-1 overflow-y-auto p-4 rounded-2xl border border-border/60 bg-background shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.key}
                project={project}
                onClick={() => openProject(project.key)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/75 px-6 py-16 text-center">
          <h2 className="text-lg font-semibold text-foreground">
            {hasActiveFilters ? "No matching projects" : "No projects yet"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {hasActiveFilters
              ? "Try clearing the search or filters to see more projects."
              : "Create a project to start organizing this team's work."}
          </p>

          {hasActiveFilters ? (
            <Button
              variant="outline"
              className="mt-6 rounded-xl"
              onClick={onClearFilters}
            >
              Clear filters
            </Button>
          ) : canCreateProject ? (
            <Button className="mt-6 rounded-xl" onClick={onCreateProject}>
              <Plus className="h-4 w-4" />
              Create project
            </Button>
          ) : null}
        </div>
      )}
    </>
  );
}
