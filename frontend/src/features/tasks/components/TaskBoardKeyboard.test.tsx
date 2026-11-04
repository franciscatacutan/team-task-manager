import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TaskBoard from "./TaskBoard";
import type { Task } from "../types/task.types";
import type { TaskStatus } from "../utils/task.constants";
const task = {
  taskNumber: 17,
  name: "Keyboard task",
  status: "TODO",
  priority: "MEDIUM",
  readOnly: false,
  deletedAt: null,
} as Task;
vi.mock("../hooks/useInfiniteTasks", () => ({
  useInfiniteTasks: (_team: string, _project: string, status: TaskStatus) => ({
    data: {
      pages: [
        {
          content: status === task.status ? [task] : [],
          totalElements: status === task.status ? 1 : 0,
        },
      ],
    },
    isLoading: false,
  }),
}));
beforeEach(() => {
  task.status = "TODO";
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
      const column = this.closest<HTMLElement>("[data-board-status]")?.dataset
        .boardStatus;
      const left = column === "IN_PROGRESS" ? 350 : 0;
      const top = this.closest("[data-task-number]") ? 75 : 0;
      const height = this.closest("[data-task-number]") ? 120 : 500;
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

it.each([true, false])(
  "opens details with Enter independently of movement permission (%s)",
  async (canMove) => {
    const open = vi.fn(),
      change = vi.fn();
    render(
      <TaskBoard
        teamKey="TEAM"
        projectKey="PROJECT"
        params={{ deletedFilter: "ACTIVE", status: ["TODO", "IN_PROGRESS"] }}
        canChangeTaskStatus={() => canMove}
        onOpenTask={open}
        onStatusChange={change}
      />,
    );
    const action = screen.getByRole("button", {
      name: "Open task #17: Keyboard task",
    });
    expect(action).toBeEnabled();
    const handle = screen.getByRole("button", {
      name: "Move task #17: Keyboard task",
    });
    expect(handle).toHaveProperty("disabled", !canMove);
    action.focus();
    await userEvent.keyboard("[Enter]");
    expect(open).toHaveBeenCalledExactlyOnceWith(task);
    expect(change).not.toHaveBeenCalled();
    expect(handle).not.toHaveAttribute("aria-pressed", "true");
  },
);

it.each([false, true])(
  "restores focus after a confirmed move unless the user focused another control (%s)",
  async (focusElsewhere) => {
    let resolve!: () => void;
    const change = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const tree = () => (
      <>
        <TaskBoard
          teamKey="TEAM"
          projectKey="PROJECT"
          params={{ deletedFilter: "ACTIVE", status: ["TODO", "IN_PROGRESS"] }}
          canChangeTaskStatus={() => true}
          onOpenTask={vi.fn()}
          onStatusChange={change}
        />
        <button>Another control</button>
      </>
    );
    const { rerender } = render(tree());
    const user = userEvent.setup();
    screen
      .getByRole("button", { name: "Move task #17: Keyboard task" })
      .focus();
    await user.keyboard("[Space][ArrowRight][Space]");
    expect(change).toHaveBeenCalledOnce();
    act(() => {
      task.status = "IN_PROGRESS";
      rerender(tree());
    });
    if (focusElsewhere)
      screen.getByRole("button", { name: "Another control" }).focus();
    await act(async () => {
      resolve();
    });
    await act(async () => {
      await new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      );
    });
    expect(
      screen.getByRole("button", {
        name: focusElsewhere
          ? "Another control"
          : "Move task #17: Keyboard task",
      }),
    ).toHaveFocus();
  },
);

it("waits until the rendered mutation state enables the moved handle", async () => {
  let resolve!: () => void;
  const change = vi.fn(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const tree = (pending: boolean) => (
    <TaskBoard
      teamKey="TEAM"
      projectKey="PROJECT"
      isUpdating={pending}
      params={{ deletedFilter: "ACTIVE", status: ["TODO", "IN_PROGRESS"] }}
      canChangeTaskStatus={() => !pending}
      onOpenTask={vi.fn()}
      onStatusChange={change}
    />
  );
  const { rerender } = render(tree(false));
  const user = userEvent.setup();
  screen.getByRole("button", { name: "Move task #17: Keyboard task" }).focus();
  await user.keyboard("[Space][ArrowRight][Space]");
  act(() => {
    task.status = "IN_PROGRESS";
    rerender(tree(true));
  });
  await act(async () => {
    resolve();
  });
  expect(
    screen.getByRole("button", { name: "Move task #17: Keyboard task" }),
  ).toBeDisabled();
  rerender(tree(false));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Move task #17: Keyboard task" }),
    ).toHaveFocus(),
  );
});
