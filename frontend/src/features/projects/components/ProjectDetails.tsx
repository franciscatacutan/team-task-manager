import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useState } from "react";

import { useProject } from "../hooks/useProject";

import TaskBoard from "../../tasks/components/TaskBoard";
import TaskModal from "../../tasks/components/TaskModal";

import type { Task } from "../../tasks/types/task.types";
import {
  isTaskStatus,
  TASK_LIST_SORT_OPTIONS,
  type TaskStatus,
} from "../../tasks/utils/task.constants";

import ProjectHeader from "../../projects/components/ProjectHeader";
import { useDebounce } from "../../../common/hooks/useDebounce";
import TaskList from "../../tasks/components/TaskList";
import { useUpdateTaskStatus } from "../../tasks/hooks/useUpdateTaskStatus";
import { useTasks } from "../../tasks/hooks/useTasks";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../../components/ui/tabs";
import { BarChart3, Kanban, LayoutList, ListCheck } from "lucide-react";
import { CreateTaskModal } from "../../tasks/components/CreateTaskModal";
import ProjectActivity from "../../projects/components/ProjectActivity";
import ProjectInsightsDashboard from "../../projects/components/ProjectInsightsDashboard";
import ProjectObservabilityLogs from "../../projects/components/ProjectObservabilityLogs";
import { getProjectPermissions } from "../../projects/utils/projectPermissions";
import { useTeamMe } from "../../teams/hooks/useTeamMe";
import {
  DELETED_FILTER,
  type DeletedFilter,
} from "../../../common/types/deletedFilter.types";
import { getUserFromToken } from "../../users/api/userApi";
import { useProjectInsights } from "../hooks/useProjectInsights";
import { BASE_SORT_OPTIONS } from "@/common/constants/sort.constants";
import Toolbar from "@/common/components/toolbar/ToolBar";
import { TASK_STATUS_FILTER } from "@/features/tasks/constants/taksFilter.constants";
import type { SortField, SortOrder } from "@/common/types/sort.types";
import { Pagination } from "@/common/components/pagination/Pagination";
import type { WorkspaceOutletContext } from "@/layout/workspace/WorkspaceLayout";

export default function ProjectDetails() {
  const { teamKey, projectKey } = useParams<{
    teamKey: string;
    projectKey: string;
  }>();

  const navigate = useNavigate();

  // ---------------- STATE ----------------
  const [open, setOpen] = useState(false);

  const [view, setView] = useState<"board" | "list">("board");

  const getPaginationOptions = (type: "board" | "list") =>
    type === "board" ? [12, 24, 36] : [10, 20, 40];

  const [page, setPage] = useState(0);
  const [size, setSize] = useState<number>(getPaginationOptions("board")[0]);

  const [search, setSearch] = useState("");

  const [sortField, setSortField] = useState<SortField>("lastActivityAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [statusFilter, setStatusFilter] = useState<TaskStatus[]>([]);

  const [deletedFilter, setDeletedFilter] = useState<DeletedFilter>("ACTIVE");

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // ---------------- DERIVED ----------------

  const debouncedSearch = useDebounce(search, 400);
  const sort = `${sortField},${sortOrder}`;

  const sortOptions =
    view === "board" ? BASE_SORT_OPTIONS : TASK_LIST_SORT_OPTIONS;
  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter.length > 0 ||
    deletedFilter !== "ACTIVE";

  // ---------------- DATA ----------------

  const {
    data: project,
    isLoading,
    isError,
  } = useProject(teamKey || "", projectKey || "");

  const { team } = useOutletContext<WorkspaceOutletContext>();
  const isWorkspaceReadOnly = Boolean(team.deletedAt);
  const effectiveDeletedFilter: DeletedFilter = isWorkspaceReadOnly
    ? "ALL"
    : deletedFilter;
  const filterValues = {
    statusFilter,
    deletedFilter: effectiveDeletedFilter,
  };

  const {
    data: projectInsights,
    isLoading: isProjectInsightsLoading,
    isError: isProjectInsightsError,
  } = useProjectInsights(teamKey || "", projectKey || "");

  const { data: tasksData, isLoading: isTasksLoading } = useTasks(
    teamKey || "",
    projectKey || "",
    {
      page,
      size,
      search: debouncedSearch,
      sort,
      status: statusFilter,
      deletedFilter: effectiveDeletedFilter,
    },
  );

  const tasks = tasksData?.content ?? [];
  const totalPages = tasksData?.totalPages ?? 0;
  const totalElements = tasksData?.totalElements ?? 0;

  const updateStatus = useUpdateTaskStatus(teamKey || "", projectKey || "");

  // ---------------- HANDLERS ----------------

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const handleViewChange = (value: string) => {
    const nextView = value as "board" | "list";

    setView(nextView);
    setPage(0);
    setSize(getPaginationOptions(nextView)[0]);
  };

  const handleSort = (field: SortField) => {
    setSortField((prevField) => {
      if (prevField === field) {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
        return prevField;
      }

      setSortOrder("desc");
      return field;
    });

    setPage(0);
  };

  const handleToggleSortOrder = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    setPage(0);
  };

  const handleFilterChange = (key: string, value: string | string[]) => {
    setPage(0);

    if (key === "statusFilter") {
      const statuses = Array.isArray(value) ? value : value ? [value] : [];
      setStatusFilter(statuses.filter(isTaskStatus));
    }

    if (key === "deletedFilter") {
      setDeletedFilter(
        (typeof value === "string" && value
          ? value
          : "ACTIVE") as DeletedFilter,
      );
    }
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter([]);
    setDeletedFilter("ACTIVE");
    setPage(0);
  };

  function handleStatusChange(taskNumber: number, status: TaskStatus) {
    updateStatus.mutate({
      taskNumber,
      status,
    });
  }

  // ---------------- PERMISSIONS ----------------

  const user = getUserFromToken();
  const { data: teamMe } = useTeamMe(teamKey || "");

  const permissions = getProjectPermissions({
    globalRole: user?.role,
    teamRole: teamMe?.role,
    isReadOnly: isWorkspaceReadOnly,
  });

  // ------------------ FILTERS ------------------
  const filterConfig = permissions.canViewDeleteTask
    ? [...TASK_STATUS_FILTER, ...DELETED_FILTER]
    : TASK_STATUS_FILTER;

  const filters = {
    config: filterConfig,
    values: filterValues,
    onChange: handleFilterChange,
    onDeletedChange: setDeletedFilter,
    onClear: handleClearFilters,
  };

  if (!teamKey || !projectKey) {
    return (
      <ProjectDetailsState
        title="Invalid project"
        description="This project route is missing the team or project identifier."
      />
    );
  }

  if (isLoading) {
    return <ProjectDetailsSkeleton />;
  }

  if (isError || !project) {
    return (
      <ProjectDetailsState
        title="Project not found"
        description="The project may have been deleted, moved, or you may not have access to it."
      />
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-6 ">
      <ProjectHeader
        teamKey={teamKey}
        project={project}
        onCreateTask={() => setOpen(true)}
        onProjectDeleted={() => navigate(`/teams/${teamKey}/projects`)}
        permissions={permissions}
      />
      <CreateTaskModal
        teamKey={teamKey}
        projectKey={projectKey}
        open={open}
        onOpenChange={setOpen}
      />
      {(view == "board" || view == "list") && (
        <Toolbar
          search={{
            value: search,
            onChange: handleSearchChange,
          }}
          filters={filters}
          view={view}
          sort={{
            field: sortField,
            order: sortOrder,
            options: sortOptions,
            onFieldChange: handleSort,
            onToggleOrder: handleToggleSortOrder,
          }}
        />
      )}

      <Tabs
        value={view}
        onValueChange={handleViewChange}
        className="flex flex-col flex-1 min-h-0"
      >
        <TabsList className="inline-flex gap-1 rounded-xl border border-border/60 bg-background/70 p-1 shadow-sm">
          <TabsTrigger
            value="board"
            className=" flex items-center gap-2 px-3 py-1.5 text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground hover:bg-muted transition-all "
          >
            <Kanban className="h-4 w-4" />
            Board
          </TabsTrigger>

          <TabsTrigger
            value="list"
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground hover:bg-muted transition-all "
          >
            <LayoutList className="h-4 w-4" />
            List
          </TabsTrigger>

          <TabsTrigger
            value="activity"
            className=" flex items-center gap-2 px-3 py-1.5 text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground hover:bg-muted transition-all "
          >
            <ListCheck className="h-4 w-4" />
            Activity
          </TabsTrigger>

          {permissions.canManageProject && (
            <TabsTrigger
              value="insights"
              className=" flex items-center gap-2 px-3 py-1.5 text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground hover:bg-muted transition-all "
            >
              <BarChart3 className="h-4 w-4" />
              Insights
            </TabsTrigger>
          )}
        </TabsList>
        <div className="flex flex-col flex-1 min-h-0">
          <TabsContent
            value="board"
            className="flex flex-col flex-1 min-h-0 gap-3"
          >
            <TaskBoard
              teamKey={teamKey}
              projectKey={projectKey}
              params={{
                search: debouncedSearch,
                status: statusFilter[0],
                sort,
                deletedFilter: effectiveDeletedFilter,
              }}
              onStatusChange={handleStatusChange}
              onOpenTask={setSelectedTask}
            />
          </TabsContent>
          <TabsContent
            value="list"
            className="flex flex-col flex-1 min-h-0 gap-3"
          >
            <TaskList
              tasks={tasks}
              isLoading={isTasksLoading}
              teamKey={teamKey}
              projectKey={projectKey}
              onCreateTask={() => setOpen(true)}
              onClearFilters={handleClearFilters}
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={handleSort}
              canCreateTask={permissions.canCreateTask}
              hasActiveFilters={hasActiveFilters}
            />
          </TabsContent>
          <TabsContent
            value="activity"
            className="flex flex-col flex-1 min-h-0"
          >
            <ProjectActivity
              teamKey={teamKey}
              projectKey={projectKey}
              onOpenTask={(taskNumber) =>
                setSelectedTask({ taskNumber: taskNumber } as Task)
              }
            />
          </TabsContent>
          <TabsContent value="insights" className="flex flex-col min-h-0 gap-4">
            <ProjectInsightsDashboard
              insights={projectInsights}
              isLoading={isProjectInsightsLoading}
              isError={isProjectInsightsError}
            />
            <div className="pb-4">
              <ProjectObservabilityLogs
                teamKey={teamKey}
                projectKey={projectKey}
              />
            </div>
          </TabsContent>
        </div>
      </Tabs>
      {(view == "board" || view == "list") && totalPages > 1 && (
        <Pagination
          page={page}
          size={size}
          totalPages={totalPages}
          totalElements={totalElements}
          onPageChange={setPage}
          onSizeChange={(size) => {
            setPage(0);
            setSize(size);
          }}
          options={getPaginationOptions(view)}
        />
      )}
      {selectedTask && (
        <TaskModal
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onTaskDeleted={() => setSelectedTask(null)}
          taskNumber={selectedTask.taskNumber}
          teamKey={teamKey}
          projectKey={projectKey}
        />
      )}
    </div>
  );
}

function ProjectDetailsSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <header className="rounded-2xl border border-border/60 bg-background/95 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 space-y-3">
            <div className="h-8 w-72 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-full max-w-xl animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-2/3 max-w-md animate-pulse rounded-md bg-muted" />
          </div>

          <div className="h-10 w-28 animate-pulse rounded-xl bg-muted" />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-64 animate-pulse rounded-2xl border border-border/60 bg-muted/25"
          />
        ))}
      </div>
    </div>
  );
}

function ProjectDetailsState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/75 px-6 py-16 text-center">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
