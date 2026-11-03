import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TaskBoard from "./TaskBoard";
import type { Task } from "../types/task.types";
import type { TaskStatus } from "../utils/task.constants";
const task = {
  taskNumber: 17,
  name: "Keyboard task",
  status: "TODO",
  readOnly: false,
  deletedAt: null,
} as Task;
vi.mock("./TaskCard", () => ({
  default: ({ task }: { task: Task }) => <span>{task.name}</span>,
}));
vi.mock("../hooks/useInfiniteTasks", () => ({
  useInfiniteTasks: (_team: string, _project: string, status: TaskStatus) => ({
    data: {
      pages: [
        {
          content: status === "TODO" ? [task] : [],
          totalElements: status === "TODO" ? 1 : 0,
        },
      ],
    },
    isLoading: false,
  }),
}));
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const column = this.dataset.boardStatus;
      const left = column === "IN_PROGRESS" ? 350 : 0;
      const top = this.dataset.taskNumber ? 75 : 0;
      const height = this.dataset.taskNumber ? 120 : 500;
      return {
        x: left,
        y: top,
        left,
        top,
        right: left + 300,
        bottom: top + height,
        width: 300,
        height,
        toJSON: () => ({}),
      };
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("board keyboard movement", () => {
  it("moves a task into an empty adjacent column with Space, ArrowRight, Space", async () => {
    const change = vi.fn();
    render(
      <TaskBoard
        teamKey="TEAM"
        projectKey="PROJECT"
        params={{ deletedFilter: "ACTIVE", status: ["TODO", "IN_PROGRESS"] }}
        canChangeTaskStatus={() => true}
        onOpenTask={vi.fn()}
        onStatusChange={change}
      />,
    );
    const user = userEvent.setup();
    const card = screen.getByRole("button", {
      name: "Move task #17: Keyboard task",
    });
    card.focus();
    await user.keyboard("[Space]");
    await waitFor(() => expect(card).toHaveAttribute("aria-pressed", "true"));
    await user.keyboard("[ArrowRight]");
    await user.keyboard("[Space]");
    expect(change).toHaveBeenCalledExactlyOnceWith(17, "IN_PROGRESS");
  });
  it("cancels keyboard dragging without a mutation", async () => {
    const change = vi.fn();
    render(
      <TaskBoard
        teamKey="TEAM"
        projectKey="PROJECT"
        params={{ deletedFilter: "ACTIVE", status: ["TODO", "IN_PROGRESS"] }}
        canChangeTaskStatus={() => true}
        onOpenTask={vi.fn()}
        onStatusChange={change}
      />,
    );
    const user = userEvent.setup();
    const card = screen.getByRole("button", {
      name: "Move task #17: Keyboard task",
    });
    card.focus();
    await user.keyboard("[Space][Escape]");
    expect(change).not.toHaveBeenCalled();
    expect(card).not.toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("Keyboard task")).toHaveLength(1);
  });
});
