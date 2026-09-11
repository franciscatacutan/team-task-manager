import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Home } from "lucide-react";

import { cn } from "@/lib/utils";
import { getTeam } from "@/features/teams/api/teamApi";
import { getProject } from "@/features/projects/api/projectApi";
import { getTask } from "@/features/tasks/api/taskApi";
import { getUser } from "@/features/users/api/userApi";

type BreadcrumbItem = {
  label: string;
  to?: string;
  loading?: boolean;
};

const workspaceSectionLabels: Record<string, string> = {
  projects: "Projects",
  members: "Members",
  activity: "Activity",
  insights: "Insights",
};

export default function AppBreadcrumbs() {
  const { pathname } = useLocation();
  const { teamKey, projectId, taskId, userId } = useParams<{
    teamKey?: string;
    projectId?: string;
    taskId?: string;
    userId?: string;
  }>();

  const segments = pathname.split("/").filter(Boolean);
  const isWorkspaceRoute = segments[0] === "teams" && !!teamKey;
  const section = isWorkspaceRoute ? segments[2] : undefined;

  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ["team", teamKey],
    queryFn: () => getTeam(teamKey!),
    enabled: !!teamKey,
  });

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", teamKey, projectId],
    queryFn: () => getProject(teamKey!, projectId!),
    enabled: !!teamKey && !!projectId,
  });

  const { data: task, isLoading: taskLoading } = useQuery({
    queryKey: ["task", teamKey, projectId, taskId],
    queryFn: () => getTask(teamKey!, projectId!, taskId!),
    enabled: !!teamKey && !!projectId && !!taskId,
  });

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => getUser(userId!),
    enabled: !!userId && segments[0] === "users",
  });

  const items = buildBreadcrumbItems({
    pathname,
    segments,
    teamKey,
    projectId,
    taskId,
    userId,
    teamName: team?.name,
    projectName: project?.name,
    taskLabel: task
      ? `#${task.taskNumber} ${task.title}`
      : taskId
        ? `Task ${shortId(taskId)}`
        : undefined,
    userName: user ? `${user.firstName} ${user.lastName}` : undefined,
    loading: {
      team: teamLoading,
      project: projectLoading,
      task: taskLoading,
      user: userLoading,
    },
    section,
  });

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="hidden min-w-0 items-center md:flex"
    >
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li
              key={`${item.label}-${item.to ?? "current"}-${index}`}
              className="flex min-w-0 items-center gap-1"
            >
              {index > 0 && (
                <ChevronRight
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
                />
              )}

              <BreadcrumbContent item={item} isLast={isLast} index={index} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function BreadcrumbContent({
  item,
  isLast,
  index,
}: {
  item: BreadcrumbItem;
  isLast: boolean;
  index: number;
}) {
  if (item.loading) {
    return (
      <span
        className={cn(
          "h-5 animate-pulse rounded-md bg-muted",
          index === 0 ? "w-16" : "w-24",
        )}
      />
    );
  }

  if (isLast || !item.to) {
    return (
      <span
        aria-current={isLast ? "page" : undefined}
        className="max-w-[18rem] truncate rounded-md px-2 py-1 font-medium text-foreground"
        title={item.label}
      >
        {item.label}
      </span>
    );
  }

  return (
    <Link
      to={item.to}
      className="inline-flex max-w-[12rem] items-center gap-1.5 truncate rounded-md px-2 py-1 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={item.label}
    >
      {index === 0 && <Home className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function buildBreadcrumbItems({
  pathname,
  segments,
  teamKey,
  projectId,
  taskId,
  userId,
  teamName,
  projectName,
  taskLabel,
  userName,
  loading,
  section,
}: {
  pathname: string;
  segments: string[];
  teamKey?: string;
  projectId?: string;
  taskId?: string;
  userId?: string;
  teamName?: string;
  projectName?: string;
  taskLabel?: string;
  userName?: string;
  loading: {
    team: boolean;
    project: boolean;
    task: boolean;
    user: boolean;
  };
  section?: string;
}): BreadcrumbItem[] {
  if (pathname === "/teams") {
    return [{ label: "Teams" }];
  }

  if (segments[0] === "profile") {
    return [{ label: "Profile" }];
  }

  if (segments[0] === "settings") {
    return [{ label: "Settings" }];
  }

  if (segments[0] === "users") {
    return [
      { label: "Users", to: userId ? "/users" : undefined },
      ...(userId
        ? [
            {
              label: userName ?? `User ${shortId(userId)}`,
              loading: loading.user,
            },
          ]
        : []),
    ];
  }

  if (segments[0] !== "teams" || !teamKey) {
    return [];
  }

  const items: BreadcrumbItem[] = [
    { label: "Teams", to: "/teams" },
    {
      label: teamName ?? `Team ${shortId(teamKey)}`,
      to: section ? `/teams/${teamKey}` : undefined,
      loading: loading.team,
    },
  ];

  if (!section) return items;

  const sectionLabel = workspaceSectionLabels[section] ?? toTitleCase(section);

  items.push({
    label: sectionLabel,
    to: projectId ? `/teams/${teamKey}/${section}` : undefined,
  });

  if (projectId) {
    items.push({
      label: projectName ?? `Project ${shortId(projectId)}`,
      to: taskId ? `/teams/${teamKey}/projects/${projectId}` : undefined,
      loading: loading.project,
    });
  }

  if (taskId) {
    items.push({
      label: taskLabel ?? `Task ${shortId(taskId)}`,
      loading: loading.task,
    });
  }

  return items;
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function toTitleCase(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
