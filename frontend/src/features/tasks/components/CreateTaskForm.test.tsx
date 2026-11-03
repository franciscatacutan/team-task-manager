import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreateTaskForm } from "./CreateTaskForm";
import { createTask } from "../api/taskApi";
vi.mock("../api/taskApi", () => ({ createTask: vi.fn() }));
vi.mock("../../teams/components/TeamMemberSelector", () => ({
  default: ({
    placeholder,
    onChange,
  }: {
    placeholder: string;
    onChange: (id: string | null) => void;
  }) => (
    <button
      type="button"
      onClick={() => onChange("00000000-0000-4000-8000-000000000001")}
    >
      {placeholder}
    </button>
  ),
}));
vi.mock("../../../common/components/PrioritySelector", () => ({
  default: ({ onChange }: { onChange: (value: string) => void }) => (
    <button type="button" onClick={() => onChange("CRITICAL")}>
      Choose Critical
    </button>
  ),
}));
vi.mock("../../../common/components/DatePicker", () => ({
  default: ({ onChange }: { onChange: (value: Date) => void }) => (
    <button
      type="button"
      onClick={() => onChange(new Date("2026-11-01T00:00:00Z"))}
    >
      Choose date
    </button>
  ),
}));
describe("task creation form submission", () => {
  it("submits a trimmed one-character name and Critical priority through the real resolver/mutation", async () => {
    vi.mocked(createTask).mockResolvedValue({ taskNumber: 7 } as Awaited<
      ReturnType<typeof createTask>
    >);
    const success = vi.fn();
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <CreateTaskForm
          teamKey="TEAM"
          projectKey="PROJECT"
          onSuccess={success}
        />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    expect(screen.getByRole("button", { name: "Create Task" })).toBeDisabled();
    await user.type(screen.getByPlaceholderText("Enter task name..."), " X ");
    await user.click(screen.getByRole("button", { name: "Choose Critical" }));
    await user.click(screen.getByRole("button", { name: "Select assignee" }));
    for (const date of screen.getAllByRole("button", { name: "Choose date" }))
      await user.click(date);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create Task" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Create Task" }));
    await waitFor(() =>
      expect(createTask).toHaveBeenCalledExactlyOnceWith(
        "TEAM",
        "PROJECT",
        expect.objectContaining({
          name: "X",
          priority: "CRITICAL",
          assigneeId: "00000000-0000-4000-8000-000000000001",
        }),
      ),
    );
    expect(success).toHaveBeenCalledOnce();
  });
});
