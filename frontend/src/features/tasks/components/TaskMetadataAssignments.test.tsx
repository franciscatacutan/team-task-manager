import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TaskMetadata from "./TaskMetadata";
import type { Task } from "../types/task.types";
import type { TaskPermissions } from "../utils/taskPermissions";
import { assignSupportUser } from "../api/taskApi";
vi.mock("../api/taskApi", () => ({
  assignSupportUser: vi.fn(),
  assignUser: vi.fn(),
  updateTask: vi.fn(),
  updateTaskStatus: vi.fn(),
}));
vi.mock("../../teams/components/TeamMemberSelector", () => ({
  default: ({
    placeholder,
    onChange,
    allowClear,
    disabled,
  }: {
    placeholder: string;
    onChange: (id: string | null) => void;
    allowClear?: boolean;
    disabled?: boolean;
  }) => (
    <button
      disabled={disabled}
      onClick={() => onChange(allowClear ? null : "another-member")}
    >
      {placeholder}
    </button>
  ),
}));
const task = {
  taskNumber: 7,
  name: "X",
  status: "TODO",
  priority: "CRITICAL",
  assignedUser: {
    id: "assignee",
    firstName: "Alice",
    lastName: "Member",
    email: "a@example.test",
  },
  supportUser: {
    id: "support",
    firstName: "Bob",
    lastName: "Member",
    email: "b@example.test",
  },
} as Task;
const permissions: TaskPermissions = {
  canEditTaskDetails: false,
  canDeleteTask: false,
  canViewDeleteTask: false,
  canChangeStatus: false,
  canChangePriority: false,
  canAssign: true,
  canChangeSchedule: false,
  canComment: false,
};
function mount(value = task, access = permissions) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TaskMetadata
        task={value}
        permissions={access}
        teamKey="TEAM"
        projectKey="PROJECT"
      />
    </QueryClientProvider>,
  );
}
beforeEach(() => vi.resetAllMocks());
describe("task metadata support removal", () => {
  it("sends a null support relationship from the clear choice", async () => {
    vi.mocked(assignSupportUser).mockResolvedValue({
      ...task,
      supportUser: null,
    });
    mount();
    await userEvent.click(
      screen.getByRole("button", { name: "Select support" }),
    );
    await waitFor(() =>
      expect(assignSupportUser).toHaveBeenCalledExactlyOnceWith(
        "TEAM",
        "PROJECT",
        7,
        null,
      ),
    );
  });
  it("surfaces API rejection instead of silently failing", async () => {
    vi.mocked(assignSupportUser).mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: "Team is archived" } },
    });
    mount();
    await userEvent.click(
      screen.getByRole("button", { name: "Select support" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Team is archived",
    );
  });
  it("does not mutate an already empty support relationship", async () => {
    mount({ ...task, supportUser: null });
    await userEvent.click(
      screen.getByRole("button", { name: "Select support" }),
    );
    expect(assignSupportUser).not.toHaveBeenCalled();
  });
  it("renders read-only assignments without editing controls", () => {
    mount(task, { ...permissions, canAssign: false });
    expect(
      screen.queryByRole("button", { name: "Select support" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Bob Member")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });
});
