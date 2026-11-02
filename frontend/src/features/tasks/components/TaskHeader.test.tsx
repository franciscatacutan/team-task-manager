import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/api/apiClients";
import TaskHeader from "./TaskHeader";
import type { Task } from "../types/task.types";
import type { TaskPermissions } from "../utils/taskPermissions";

vi.mock("@/api/apiClients", () => ({ apiClient: { patch: vi.fn() } }));
vi.mock("./DeleteTaskButton", () => ({ default: () => null }));

const task: Task = {
  taskNumber: 7, name: "Original name", status: "TODO", priority: "MEDIUM",
  createdAt: "2026-11-02T00:00:00Z", updatedAt: "2026-11-02T00:00:00Z",
  lastActivityAt: "2026-11-02T00:00:00Z",
};
const permissions: TaskPermissions = {
  canEditTaskDetails: true, canDeleteTask: false, canViewDeleteTask: false,
  canChangeStatus: false, canChangePriority: false, canAssign: false,
  canChangeSchedule: false, canComment: false,
};

describe("task name editing", () => {
  beforeEach(() => vi.mocked(apiClient.patch).mockResolvedValue({ data: { ...task, name: "Renamed name" } }));

  it("sends the backend name field when saving a name", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(<QueryClientProvider client={client}>
      <TaskHeader teamKey="TEAM-A" projectKey="PROJ-A" task={task} permissions={permissions} />
    </QueryClientProvider>);
    await user.click(screen.getByText("Original name"));
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "Renamed name");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith(
      "/teams/TEAM-A/projects/PROJ-A/tasks/7", { name: "Renamed name" },
    ));
    client.clear();
  });

  it("does not allow read-only users to edit", async () => {
    const client = new QueryClient();
    render(<QueryClientProvider client={client}>
      <TaskHeader teamKey="TEAM-A" projectKey="PROJ-A" task={task}
        permissions={{ ...permissions, canEditTaskDetails: false }} />
    </QueryClientProvider>);
    await userEvent.click(screen.getByText("Original name"));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(apiClient.patch).not.toHaveBeenCalled();
    client.clear();
  });
});
