import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TaskDetailsPage from "@/pages/TaskDetailsPage";
import TaskModal from "./TaskModal";
import { queryKeys } from "@/common/query/queryKeys";
import type { Task } from "../types/task.types";
import type { TaskPermissions } from "../utils/taskPermissions";

const state = vi.hoisted(() => ({
  number: 1,
  role: "USER",
  teamDeletedAt: null as string | null,
  getTask: vi.fn(),
  getMembership: vi.fn(),
  onClose: vi.fn(),
  onDeleted: vi.fn(),
}));
vi.mock("react-router", () => ({
  useParams: () => ({
    teamKey: "TEAM",
    projectKey: "PROJECT",
    taskNumber: String(state.number),
  }),
  useOutletContext: () => ({ team: { deletedAt: state.teamDeletedAt } }),
}));
vi.mock("@/features/auth/hooks/useAuth", () => ({
  useAuth: () => ({ user: { role: state.role } }),
}));
vi.mock("../api/taskApi", () => ({
  getTask: (...args: unknown[]) => state.getTask(...args),
}));
vi.mock("@/features/teams/hooks/useTeamMe", async () => {
  const { useQuery } = await import("@tanstack/react-query");
  return {
    useTeamMe: (key: string) =>
      useQuery({
        queryKey: ["membership", key],
        queryFn: () => state.getMembership(),
      }),
  };
});
vi.mock("./TaskHeader", () => ({
  default: ({
    task,
    permissions,
    onTaskDeleted,
  }: {
    task: Task;
    permissions: TaskPermissions;
    onTaskDeleted?: () => void;
  }) => (
    <>
      <div>{task.name}</div>
      <button disabled={!permissions.canEditTaskDetails}>Edit task</button>
      <button disabled={!permissions.canDeleteTask} onClick={onTaskDeleted}>
        Archive task
      </button>
    </>
  ),
}));
vi.mock("./TaskDescription", () => ({
  default: () => <div>Task description</div>,
}));
vi.mock("./TaskMetadata", () => ({
  default: ({ permissions }: { permissions: TaskPermissions }) => (
    <button disabled={!permissions.canChangeStatus}>Change status</button>
  ),
}));
vi.mock("./TaskActivity", () => ({ default: () => <div>Task history</div> }));
vi.mock("./TaskCommentForm", () => ({
  default: () => <textarea aria-label="Comment draft" />,
}));

const task: Task = {
  taskNumber: 1,
  name: "Shared task",
  status: "TODO",
  priority: "LOW",
  assignedUser: {
    id: "assignee",
    firstName: "A",
    lastName: "Person",
    email: "a@example.test",
  },
  supportUser: {
    id: "support",
    firstName: "S",
    lastName: "Person",
    email: "s@example.test",
  },
  createdAt: "2026-11-04",
  updatedAt: "2026-11-04",
  lastActivityAt: null,
};
const denied = (status: number) => ({
  isAxiosError: true,
  response: { status },
});
let client: QueryClient;
afterEach(() => client.clear());
beforeEach(() => {
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0, gcTime: Infinity },
    },
  });
  state.number = 1;
  state.role = "USER";
  state.teamDeletedAt = null;
  state.getTask.mockReset().mockResolvedValue(task);
  state.getMembership
    .mockReset()
    .mockResolvedValue({ userId: "owner", role: "OWNER" });
  state.onClose.mockReset();
  state.onDeleted.mockReset();
});
describe.each(["page", "dialog"] as const)("shared task %s", (view) => {
  const tree = (open = true) => (
    <QueryClientProvider client={client}>
      {view === "page" ? (
        <TaskDetailsPage />
      ) : (
        <TaskModal
          open={open}
          onClose={state.onClose}
          onTaskDeleted={state.onDeleted}
          teamKey="TEAM"
          projectKey="PROJECT"
          taskNumber={state.number}
          isWorkspaceReadOnly={Boolean(state.teamDeletedAt)}
        />
      )}
    </QueryClientProvider>
  );
  const loaded = async () => {
    await screen.findByText("Shared task");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit task" })).toBeEnabled(),
    );
  };

  it.each([
    ["USER", "OWNER", "owner", true, true],
    ["USER", "ADMIN", "admin", true, true],
    ["USER", "MEMBER", "assignee", false, true],
    ["USER", "MEMBER", "support", false, true],
    ["USER", "MEMBER", "other", false, false],
    ["ADMIN", null, "global", false, false],
    ["SUPER_ADMIN", null, "global", false, false],
  ] as const)(
    "preserves %s/%s/%s permissions",
    async (globalRole, role, userId, manage, participate) => {
      state.role = globalRole;
      state.getMembership.mockResolvedValue({ userId, role });
      render(tree());
      await screen.findByText("Shared task");
      await waitFor(() => expect(state.getMembership).toHaveBeenCalled());
      await waitFor(() =>
        expect(client.getQueryState(["membership", "TEAM"])?.status).toBe(
          "success",
        ),
      );
      expect(screen.getByRole("button", { name: "Edit task" })).toHaveProperty(
        "disabled",
        !manage,
      );
      expect(
        screen.getByRole("button", { name: "Change status" }),
      ).toHaveProperty("disabled", !participate);
      expect(
        Boolean(screen.queryByRole("textbox", { name: "Comment draft" })),
      ).toBe(participate);
      expect(screen.getByText("Task description")).toBeInTheDocument();
      expect(screen.getByText("Task history")).toBeInTheDocument();
    },
  );
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "does not request invalid task %s",
    (number) => {
      state.number = number;
      render(tree());
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid task");
      expect(state.getTask).not.toHaveBeenCalled();
      expect(state.getMembership).not.toHaveBeenCalled();
    },
  );
  it.each([403, 404])(
    "hides cached content on %s and offers a manual retry",
    async (status) => {
      client.setQueryData(queryKeys.tasks.detail("TEAM", "PROJECT", 1), task);
      state.getTask.mockRejectedValue(denied(status));
      render(tree());
      await screen.findByText("Task unavailable");
      expect(screen.queryByText("Shared task")).not.toBeInTheDocument();
      expect(screen.queryByText("Task history")).not.toBeInTheDocument();
      expect(state.getTask).toHaveBeenCalledTimes(1);
      state.getTask.mockResolvedValue(task);
      await userEvent.click(screen.getByRole("button", { name: "Retry" }));
      await loaded();
      expect(state.getTask).toHaveBeenCalledTimes(2);
    },
  );
  it("shows an initial failure and recovers on retry", async () => {
    state.getTask.mockRejectedValue(new Error("offline"));
    render(tree());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load task",
    );
    expect(state.getTask).toHaveBeenCalledTimes(4);
    state.getTask.mockResolvedValue(task);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await loaded();
  });
  it("retains cached content with a visible notice on a transient failure", async () => {
    client.setQueryData(queryKeys.tasks.detail("TEAM", "PROJECT", 1), task);
    state.getTask.mockRejectedValue(new Error("offline"));
    render(tree());
    await screen.findByText(
      "Showing the last loaded task while refresh is unavailable.",
    );
    expect(screen.getByText("Shared task")).toBeInTheDocument();
    expect(screen.getByText("Task history")).toBeInTheDocument();
  });
  it("disables cached management rights after a membership failure, then retries", async () => {
    client.setQueryData(["membership", "TEAM"], {
      userId: "owner",
      role: "OWNER",
    });
    state.getMembership.mockRejectedValue(new Error("offline"));
    render(tree());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load task permissions",
    );
    expect(screen.getByRole("button", { name: "Edit task" })).toBeDisabled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    state.getMembership.mockResolvedValue({ userId: "owner", role: "OWNER" });
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await loaded();
  });
  it("resets drafts and aborts the old request when the task identity changes", async () => {
    const { rerender } = render(tree());
    await loaded();
    await userEvent.type(screen.getByRole("textbox"), "Unsent comment");
    let signal: AbortSignal | undefined;
    state.getTask.mockImplementation(
      (_team, _project, _number, requestSignal: AbortSignal) => {
        signal = requestSignal;
        return new Promise(() => {});
      },
    );
    act(() => {
      void client.invalidateQueries({
        queryKey: queryKeys.tasks.detail("TEAM", "PROJECT", 1),
      });
    });
    await waitFor(() => expect(signal).toBeDefined());
    state.getTask.mockResolvedValue({
      ...task,
      taskNumber: 2,
      name: "Second task",
    });
    state.number = 2;
    rerender(tree());
    await screen.findByText("Second task");
    expect(signal?.aborted).toBe(true);
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.queryByText("Shared task")).not.toBeInTheDocument();
  });
  it("aborts a pending read on unmount", async () => {
    let signal: AbortSignal | undefined;
    state.getTask.mockImplementation(
      (_team, _project, _number, requestSignal: AbortSignal) => {
        signal = requestSignal;
        return new Promise(() => {});
      },
    );
    const { unmount } = render(tree());
    expect(screen.getByRole("status")).toHaveTextContent("Loading task");
    await waitFor(() => expect(signal).toBeDefined());
    unmount();
    expect(signal?.aborted).toBe(true);
  });
  if (view === "dialog") {
    it("does not fetch while closed", () => {
      render(tree(false));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(state.getTask).not.toHaveBeenCalled();
      expect(state.getMembership).not.toHaveBeenCalled();
    });
    it("has a separate accessible heading and forwards archive/close actions", async () => {
      render(tree());
      await loaded();
      expect(
        screen.getByRole("dialog", { name: "Task #1" }),
      ).toBeInTheDocument();
      expect(
        screen
          .getByRole("heading", { name: "Task #1" })
          .querySelector("button,input,textarea"),
      ).toBeNull();
      await userEvent.click(
        screen.getByRole("button", { name: "Archive task" }),
      );
      expect(state.onDeleted).toHaveBeenCalledTimes(1);
      await userEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(state.onClose).toHaveBeenCalledTimes(1);
    });
  }
});
