import { fireEvent, render, screen } from "@testing-library/react";
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
  tasksError: false,
  retryTasks: vi.fn(),
}));
vi.mock("react-router", () => ({
  useParams: () => ({ teamKey: "TEAM", projectKey: "PROJECT" }),
  useNavigate: () => vi.fn(),
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
    params: { deletedFilter: string },
  ) => {
    state.taskFilter = params.deletedFilter;
    return {
      data: { content: [] },
      isError: state.tasksError,
      refetch: state.retryTasks,
    };
  },
}));
vi.mock("../../tasks/components/TaskBoard", () => ({
  default: ({
    canChangeTaskStatus,
  }: {
    canChangeTaskStatus: (task: Task) => boolean;
  }) => {
    state.boardPermission = canChangeTaskStatus;
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
  default: () => <div>Task list</div>,
}));
vi.mock("../../projects/components/ProjectActivity", () => ({
  default: () => null,
}));
vi.mock("../../projects/components/ProjectInsightsDashboard", () => ({
  default: () => null,
}));
vi.mock("../../projects/components/ProjectObservabilityLogs", () => ({
  default: () => null,
}));
vi.mock("@/common/components/toolbar/ToolBar", () => ({ default: () => null }));

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
    state.retryTasks.mockClear();
  });
  it.each(["project", "parent", "team"])(
    "makes an archived %s read-only and shows archived children",
    (level) => {
      if (level === "project") state.project!.deletedAt = "2026-01-01";
      if (level === "parent") state.project!.readOnly = true;
      if (level === "team") state.teamDeletedAt = "2026-01-01";
      render(<ProjectDetails />);
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
    render(<ProjectDetails />);
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

  it("shows failed task-list reads with a retry instead of an empty list", () => {
    state.tasksError = true;
    render(<ProjectDetails />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "List" }), {
      button: 0,
      ctrlKey: false,
    });
    expect(screen.getByRole("alert")).toHaveTextContent("tasks");
    expect(screen.queryByText("Task list")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(state.retryTasks).toHaveBeenCalledOnce();
  });
});
