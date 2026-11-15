import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "../types/project.types";
import type { ProjectPermissions } from "../utils/projectPermissions";
import type { Task } from "../../tasks/types/task.types";
import ProjectDetails from "./ProjectDetails";

const state = vi.hoisted(() => ({
  project: undefined as Project | undefined,
  teamDeletedAt: null as string | null,
  boardPermission: undefined as undefined | ((task: Task) => boolean),
  taskFilter: "",
  taskParams: {} as Record<string, unknown>,
  boardParams: {} as Record<string, unknown>,
  tasksError: false,
  tasksTotalPages: 10,
  tasksPlaceholder: false,
  retryTasks: vi.fn(),
}));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useParams: () => ({ teamKey: "TEAM", projectKey: "PROJECT" }),
  useOutletContext: () => ({ team: { deletedAt: state.teamDeletedAt } }),
}));
vi.mock("../hooks/useProject", () => ({
  useProject: () => ({ data: state.project, isLoading: false, isError: false }),
}));
vi.mock("../hooks/useProjectInsights", () => ({
  useProjectInsights: () => ({}),
}));
vi.mock("../../teams/hooks/useTeamMe", () => ({
  useTeamMe: () => ({ data: { role: "OWNER", userId: "owner" } }),
}));
vi.mock("../../users/api/userApi", () => ({
  getUserFromToken: () => ({ role: "USER" }),
}));
vi.mock("../../tasks/hooks/useUpdateTaskStatus", () => ({
  useUpdateTaskStatus: () => ({ mutate: vi.fn() }),
}));
vi.mock("../../tasks/hooks/useTasks", () => ({
  useTasks: (
    _team: string,
    _project: string,
    params: { deletedFilter: string; page: number },
  ) => {
    state.taskFilter = params.deletedFilter;
    state.taskParams = params;
    return {
      data: {
        content: [],
        page: params.page,
        totalPages: state.tasksTotalPages,
      },
      isError: state.tasksError,
      isPlaceholderData: state.tasksPlaceholder,
      refetch: state.retryTasks,
    };
  },
}));
vi.mock("../../tasks/components/TaskBoard", () => ({
  default: ({
    canChangeTaskStatus,
    params,
  }: {
    canChangeTaskStatus: (task: Task) => boolean;
    params: Record<string, unknown>;
  }) => {
    state.boardPermission = canChangeTaskStatus;
    state.boardParams = params;
    return <div>Task board</div>;
  },
}));
vi.mock("../../projects/components/ProjectHeader", () => ({
  default: ({ permissions }: { permissions: ProjectPermissions }) => (
    <>
      <button disabled={!permissions.canEditProjectDetails}>
        Edit project
      </button>
      <button disabled={!permissions.canChangeProjectStatus}>
        Change project status
      </button>
      <button disabled={!permissions.canCreateTask}>Create task</button>
    </>
  ),
}));
vi.mock("../../tasks/components/CreateTaskModal", () => ({
  CreateTaskModal: () => null,
}));
vi.mock("../../tasks/components/TaskModal", () => ({ default: () => null }));
vi.mock("../../tasks/components/TaskList", () => ({
  default: () => <Link to="/tasks/1">Open task</Link>,
}));
vi.mock("../../projects/components/ProjectActivity", () => ({
  default: () => null,
}));
vi.mock("../../projects/components/ProjectInsightsDashboard", () => ({
  default: ({ overdueTasksPath }: { overdueTasksPath: string }) => (
    <Link to={overdueTasksPath}>View overdue tasks</Link>
  ),
}));
vi.mock("../../projects/components/ProjectObservabilityLogs", () => ({
  default: () => null,
}));
vi.mock("@/common/components/toolbar/ToolBar", () => ({ default: () => null }));

function TaskPage() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Back</button>;
}

function renderProject(path = "/project") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/project" element={<ProjectDetails />} />
        <Route path="/tasks/1" element={<TaskPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("project archive context", () => {
  beforeEach(() => {
    state.project = {
      key: "PROJECT",
      name: "Project",
      status: "ACTIVE",
      teamKey: "TEAM",
      createdBy: {
        firstName: "Test",
        lastName: "Owner",
        email: "owner@example.test",
      },
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      lastActivityAt: "2026-01-01",
    };
    state.teamDeletedAt = null;
    state.boardPermission = undefined;
    state.tasksError = false;
    state.tasksTotalPages = 10;
    state.tasksPlaceholder = false;
    state.retryTasks.mockClear();
  });
  it.each(["project", "parent", "team"])(
    "makes an archived %s read-only and shows archived children",
    (level) => {
      if (level === "project") state.project!.deletedAt = "2026-01-01";
      if (level === "parent") state.project!.readOnly = true;
      if (level === "team") state.teamDeletedAt = "2026-01-01";
      renderProject();
      for (const name of [
        "Edit project",
        "Change project status",
        "Create task",
      ])
        expect(screen.getByRole("button", { name })).toBeDisabled();
      expect(state.taskFilter).toBe("ALL");
      expect(state.boardPermission?.({ status: "TODO" } as Task)).toBe(false);
    },
  );
  it("allows active work but disables dragging archived tasks in an active project", () => {
    renderProject();
    expect(screen.getByRole("button", { name: "Create task" })).toBeEnabled();
    expect(state.taskFilter).toBe("ACTIVE");
    expect(state.boardPermission?.({ status: "TODO" } as Task)).toBe(true);
    expect(
      state.boardPermission?.({
        status: "TODO",
        deletedAt: "2026-01-01",
      } as Task),
    ).toBe(false);
    expect(
      state.boardPermission?.({ status: "TODO", readOnly: true } as Task),
    ).toBe(false);
  });

  it("restores List search, filters, sorting and pagination when returning from a task", () => {
    renderProject(
      "/project?view=list&q=%231&status=TODO&visibility=ALL&sort=priority&order=asc&page=1&size=20&assigneeId=00000000-0000-4000-8000-000000000001&priority=HIGH&priority=CRITICAL&overdue=true",
    );
    const expected = {
      page: 1,
      size: 20,
      search: "#1",
      status: ["TODO"],
      priority: ["HIGH", "CRITICAL"],
      assigneeId: "00000000-0000-4000-8000-000000000001",
      overdue: true,
      deletedFilter: "ALL",
      sort: "priority,asc",
    };
    expect(state.taskParams).toEqual(expected);
    fireEvent.click(screen.getByRole("link", { name: "Open task" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("tab", { name: "List" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(state.taskParams).toEqual(expected);
  });

  it("passes project filters to board columns and starts the Insights drill-down clean", () => {
    const { unmount } = renderProject(
      "/project?priority=HIGH&overdue=true&assigneeId=invalid",
    );
    expect(state.boardParams).toMatchObject({
      priority: ["HIGH"],
      overdue: true,
    });
    expect(state.boardParams).not.toHaveProperty("assigneeId");
    unmount();

    renderProject(
      "/project?view=insights&q=old&priority=LOW&visibility=DELETED&page=3",
    );
    fireEvent.click(screen.getByRole("link", { name: "View overdue tasks" }));
    expect(screen.getByRole("tab", { name: "List" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(state.taskParams).toEqual({
      page: 0,
      size: 10,
      search: "",
      sort: "lastActivityAt,desc",
      status: [],
      deletedFilter: "ACTIVE",
      overdue: true,
    });
  });

  it.each([
    { page: 1, totalPages: 1, expectedPage: 0 },
    { page: 4, totalPages: 3, expectedPage: 2 },
    { page: 4, totalPages: 0, expectedPage: 0 },
  ])(
    "returns an out-of-range List page to the last valid page and keeps its filters",
    async ({ page, totalPages, expectedPage }) => {
      state.tasksTotalPages = totalPages;
      renderProject(
        `/project?view=list&q=Release&status=TODO&sort=priority&order=asc&page=${page}&size=20`,
      );
      await waitFor(() => expect(state.taskParams.page).toBe(expectedPage));
      expect(state.taskParams).toMatchObject({
        search: "Release",
        status: ["TODO"],
        sort: "priority,asc",
        size: 20,
      });
      expect(screen.getByRole("tab", { name: "List" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    },
  );

  it("waits for confirmed page data before changing the page", () => {
    state.tasksTotalPages = 1;
    state.tasksPlaceholder = true;
    renderProject("/project?view=list&page=2");
    expect(state.taskParams.page).toBe(2);
  });

  it("shows failed task-list reads with a retry instead of an empty list", () => {
    state.tasksError = true;
    renderProject();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "List" }), {
      button: 0,
      ctrlKey: false,
    });
    expect(screen.getByRole("alert")).toHaveTextContent("tasks");
    expect(screen.queryByText("Open task")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(state.retryTasks).toHaveBeenCalledOnce();
  });
});
