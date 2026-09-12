import { CheckCircle2, Clock3, FolderKanban, Trash2 } from "lucide-react";

import EditableField from "../../../common/components/EditableField";
import { Button } from "../../../components/ui/button";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import { formatDate } from "../../../common/utils/dateFormatter";
import { useUpdateProject } from "../hooks/useUpdateProject";
import { useUpdateProjectStatus } from "../hooks/useUpdateProjectStatus";
import type { Project, ProjectStatus } from "../types/project.types";
import {
  ProjectStatusLabel,
  ProjectStatusStyles,
} from "../utils/project.constants";
import type { ProjectPermissions } from "../utils/projectPermissions";
import { DeleteProjectButton } from "./DeleteProjectButton";
import ProjectStatusSelector from "./ProjectStatusSelector";

interface Props {
  permissions: ProjectPermissions;
  teamKey: string;
  project: Project;
  onCreateTask: () => void;
  onProjectDeleted?: () => void;
}

export default function ProjectHeader({
  teamKey,
  project,
  permissions,
  onCreateTask,
  onProjectDeleted,
}: Props) {
  const updateProject = useUpdateProject(teamKey, project.key);
  const updateProjectStatus = useUpdateProjectStatus(teamKey);

  const owner = project.owner ?? project.createdBy;
  const ownerName = formatUserName(owner);
  const createdByName = formatUserName(project.createdBy);
  const completedByName = formatUserName(project.completedBy);
  const deletedByName = formatUserName(project.deletedBy);
  const isDeleted = Boolean(project.deletedAt);

  function handleStatusChange(projectKey: string, status: ProjectStatus) {
    updateProjectStatus.mutate({
      projectKey,
      status,
    });
  }

  return (
    <header className="rounded-xl border border-border/60 bg-background/95 p-4 shadow-sm shadow-slate-900/5">
      <div className="relative flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <FolderKanban className="mr-1.5 h-3.5 w-3.5" />
                Project
              </span>

              <div className="flex flex-wrap items-center gap-2">
                {permissions.canChangeProjectStatus ? (
                  <ProjectStatusSelector
                    value={project.status}
                    onChange={(status) =>
                      handleStatusChange(project.key, status)
                    }
                  />
                ) : (
                  <span className={ProjectStatusStyles[project.status]}>
                    {ProjectStatusLabel[project.status]}
                  </span>
                )}

                {isDeleted ? (
                  <span className="inline-flex items-center rounded-full border border-red-200 bg-red-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-red-700">
                    <Trash2 className="mr-1 h-3 w-3" />
                    Deleted
                  </span>
                ) : null}
              </div>
            </div>

            <EditableField
              displayClassName="w-full text-xl font-semibold leading-tight tracking-normal text-foreground sm:text-2xl"
              inputClassName="w-full text-xl font-semibold tracking-normal sm:text-2xl"
              value={project.name}
              maxLength={100}
              onSave={(value) => updateProject.mutate({ name: value })}
              disabled={!permissions.canEditProjectDetails}
            />

            <EditableField
              displayClassName="w-full text-sm leading-6 text-muted-foreground"
              inputClassName="w-full text-sm"
              placeholder="Add a concise project summary or goal"
              multiline
              value={project.description}
              maxLength={2000}
              onSave={(value) => updateProject.mutate({ description: value })}
              disabled={!permissions.canEditProjectDetails}
            />
          </div>

          <div className="flex shrink-0 items-center gap-3 pt-1">
            {permissions.canCreateTask && (
              <Button
                onClick={onCreateTask}
                className="h-9 rounded-lg px-3 text-sm font-medium shadow-sm transition-all hover:-translate-y-0.5"
              >
                Create Task
              </Button>
            )}

            {permissions.canDeleteProject && (
              <DeleteProjectButton
                teamKey={teamKey}
                projectKey={project.key}
                projectName={project.name}
                onProjectDeleted={onProjectDeleted}
              />
            )}
          </div>
        </div>

        <div className="grid gap-4 border-t border-border/50 pt-3 lg:grid-cols-[minmax(12rem,0.65fr)_minmax(0,2fr)] lg:items-start">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-8 w-8 border border-border/60">
              <AvatarFallback className="text-xs font-medium">
                {getInitials(owner)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Owner
              </p>
              <p className="truncate text-sm font-medium text-foreground">
                {ownerName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {owner.email}
              </p>
            </div>
          </div>

          <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
            <HeaderDetail
              label="Created"
              value={displayDate(project.createdAt)}
              helper={`by ${createdByName}`}
            />
            <HeaderDetail
              label="Planned"
              value={formatDateRange(
                project.plannedStartDate,
                project.plannedDueDate,
                "TBD",
                "TBD",
              )}
              helper="Target schedule"
            />
            <HeaderDetail
              label="Actual"
              value={formatDateRange(
                project.actualStartDate,
                project.actualCompletionDate,
                "Not started",
                project.actualStartDate ? "In progress" : "Not completed",
              )}
              helper="Execution dates"
            />
            {/* <HeaderDetail
              label="Status updated"
              value={displayDate(project.statusChangedAt, "No change yet")}
              helper={ProjectStatusLabel[project.status]}
              icon={Clock3}
            /> */}
            <HeaderDetail
              label="Last activity"
              value={displayDate(project.lastActivityAt)}
              helper={`Updated ${displayDate(project.updatedAt)}`}
            />
            {project.actualCompletionDate || project.completedBy ? (
              <HeaderDetail
                label="Completed"
                value={displayDate(project.actualCompletionDate, "No date")}
                helper={
                  completedByName ? `by ${completedByName}` : "Completion set"
                }
                icon={CheckCircle2}
              />
            ) : null}
            {isDeleted ? (
              <HeaderDetail
                label="Deleted"
                value={displayDate(project.deletedAt, "No date")}
                helper={deletedByName ? `by ${deletedByName}` : "Archived"}
                icon={Trash2}
              />
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

type ProjectUser = Project["createdBy"];
type HeaderIcon = typeof Clock3;

function formatUserName(user?: ProjectUser | null) {
  if (!user) return "Unknown user";

  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email;
}

function getInitials(user?: ProjectUser | null) {
  const first = user?.firstName?.[0] ?? "";
  const last = user?.lastName?.[0] ?? "";
  return `${first}${last}` || "?";
}

function displayDate(date?: string | null, fallback = "Not set") {
  return date ? formatDate(date) : fallback;
}

function formatDateRange(
  start?: string | null,
  end?: string | null,
  startFallback = "Not set",
  endFallback = "Not set",
) {
  return `${displayDate(start, startFallback)} to ${displayDate(
    end,
    endFallback,
  )}`;
}

function HeaderDetail({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper?: string;
  icon?: HeaderIcon;
}) {
  return (
    <div className="min-w-0 border-l border-border/60 pl-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        <span>{label}</span>
      </div>
      <p className="mt-0.5 truncate text-sm font-medium text-foreground">
        {value}
      </p>
      {helper ? (
        <p className="truncate text-xs text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  );
}
