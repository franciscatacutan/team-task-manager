import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "../types/task.types";
import type { TaskPermissions } from "../utils/taskPermissions";
import TaskDetailsPage from "./TaskDetails";
import TaskModal from "./TaskModal";

const state = vi.hoisted(() => ({
  task: undefined as Task | undefined,
  teamDeletedAt: null as string | null,
  loading: false,
}));
vi.mock("react-router", () => ({
  useParams: () => ({
    teamKey: "TEAM",
    projectKey: "PROJECT",
    taskNumber: "1",
  }),
  useOutletContext: () => ({ team: { deletedAt: state.teamDeletedAt } }),
}));
vi.mock("../hooks/useTask", () => ({
  useTask: () => ({ data: state.task, isLoading: state.loading }),
}));
vi.mock("../../teams/hooks/useTeamMe", () => ({
  useTeamMe: () => ({ data: { userId: "owner", role: "OWNER" } }),
}));
vi.mock("../../users/api/userApi", () => ({
  getUserFromToken: () => ({ role: "USER" }),
}));
vi.mock("./TaskHeader", () => ({
  default: ({ permissions }: { permissions: TaskPermissions }) => (
    <button disabled={!permissions.canEditTaskDetails}>Edit task</button>
  ),
}));
vi.mock("./TaskDescription", () => ({
  default: ({ permissions }: { permissions: TaskPermissions }) => (
    <button disabled={!permissions.canEditTaskDetails}>Edit description</button>
  ),
}));
vi.mock("./TaskMetadata", () => ({
  default: ({ permissions }: { permissions: TaskPermissions }) => (
    <>
      <button disabled={!permissions.canChangeStatus}>Change status</button>
      <button disabled={!permissions.canAssign}>Assign user</button>
      <button disabled={!permissions.canChangeSchedule}>Change schedule</button>
    </>
  ),
}));
vi.mock("./TaskActivity", () => ({ default: () => <div>Task history</div> }));
vi.mock("./TaskCommentForm", () => ({
  default: () => <textarea aria-label="Comment" />,
}));

describe.each(["page", "modal"] as const)("task archive %s", (view) => {
  const renderView = () =>
    render(
      view === "page" ? (
        <TaskDetailsPage />
      ) : (
        <TaskModal
          open
          onClose={vi.fn()}
          taskNumber={1}
          teamKey="TEAM"
          projectKey="PROJECT"
          onTaskDeleted={vi.fn()}
        />
      ),
    );
  beforeEach(() => {
    state.task = {
      taskNumber: 1,
      name: "Task",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      assignedUser: {
        id: "owner",
        firstName: "Test",
        lastName: "Owner",
        email: "owner@example.test",
      },
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      lastActivityAt: "2026-01-01",
      readOnly: false,
    };
    state.teamDeletedAt = null;
    state.loading = false;
  });

  it.each(["task", "parent", "team"])(
    "retains history and disables edits for an archived %s",
    (level) => {
      if (level === "task") state.task!.deletedAt = "2026-01-01";
      if (level === "parent") state.task!.readOnly = true;
      if (level === "team") state.teamDeletedAt = "2026-01-01";
      renderView();
      for (const name of [
        "Edit task",
        "Edit description",
        "Change status",
        "Assign user",
        "Change schedule",
      ])
        expect(screen.getByRole("button", { name })).toBeDisabled();
      expect(
        screen.queryByRole("textbox", { name: "Comment" }),
      ).not.toBeInTheDocument();
      expect(screen.getByText("Task history")).toBeInTheDocument();
    },
  );

  it("keeps active tasks editable for a team owner", () => {
    renderView();
    expect(screen.getByRole("button", { name: "Edit task" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Change status" })).toBeEnabled();
    expect(
      screen.getByRole("textbox", { name: "Comment" }),
    ).toBeInTheDocument();
  });

  it("shows an unavailable state when a read fails instead of loading forever", () => {
    state.task = undefined;
    renderView();
    expect(screen.getByRole("alert")).toHaveTextContent(/may not.*access/i);
    expect(screen.queryByText("Loading task...")).not.toBeInTheDocument();
  });

  it("shows loading while the request is pending", () => {
    state.task = undefined;
    state.loading = true;
    renderView();
    expect(screen.getByText("Loading task...")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

it("allows the unavailable task dialog to be closed", async () => {
  state.task = undefined;
  state.loading = false;
  const onClose = vi.fn();
  render(
    <TaskModal
      open
      onClose={onClose}
      taskNumber={1}
      teamKey="TEAM"
      projectKey="PROJECT"
      onTaskDeleted={vi.fn()}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(onClose).toHaveBeenCalled();
});
