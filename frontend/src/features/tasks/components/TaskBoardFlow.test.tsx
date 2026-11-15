import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DragEndEvent } from "@dnd-kit/core";
import type { Task } from "../types/task.types";
import TaskBoard from "./TaskBoard";
const state = vi.hoisted(() => ({
  end: undefined as ((event: DragEndEvent) => void) | undefined,
  error: false,
  nextPageError: false,
  retry: vi.fn(),
  more: vi.fn(),
}));
vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    DndContext: ({
      children,
      onDragEnd,
    }: {
      children: React.ReactNode;
      onDragEnd: (event: DragEndEvent) => void;
    }) => {
      state.end = onDragEnd;
      return <>{children}</>;
    },
  };
});
vi.mock("./TaskCard", () => ({
  default: ({ task }: { task: Task }) => <span>{task.name}</span>,
}));
vi.mock("../hooks/useInfiniteTasks", () => ({
  useInfiniteTasks: () => ({
    data: state.error
      ? undefined
      : { pages: [{ content: [], totalElements: 0 }] },
    isLoading: false,
    isError: state.error,
    isFetchNextPageError: state.nextPageError,
    refetch: state.retry,
    fetchNextPage: state.more,
    hasNextPage: !state.error,
  }),
}));
const task = {
  taskNumber: 17,
  name: "A task",
  status: "TODO",
  readOnly: false,
  deletedAt: null,
} as Task;
beforeEach(() => {
  state.error = false;
  state.nextPageError = false;
  vi.clearAllMocks();
});
function mount(canChange = true) {
  const change = vi.fn();
  render(
    <TaskBoard
      teamKey="TEAM"
      projectKey="PROJECT"
      params={{
        deletedFilter: "ACTIVE",
        status: ["TODO", "IN_PROGRESS", "TODO"],
      }}
      canChangeTaskStatus={() => canChange}
      onOpenTask={vi.fn()}
      onStatusChange={change}
    />,
  );
  return change;
}
function drop(
  source: Task,
  destination: string,
  overId: number | string = destination,
) {
  act(() =>
    state.end?.({
      activatorEvent: new MouseEvent("pointerdown"),
      active: { id: source.taskNumber, data: { current: { task: source } } },
      over: { id: overId, data: { current: { status: destination } } },
    } as unknown as DragEndEvent),
  );
}
describe("board workflow", () => {
  it("renders every selected status once", () => {
    mount();
    expect(screen.getAllByText("To Do")).toHaveLength(1);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
  });
  it("resolves a numeric card drop to its owning status column", () => {
    const change = mount();
    drop(task, "IN_PROGRESS", 99);
    expect(change).toHaveBeenCalledExactlyOnceWith(17, "IN_PROGRESS");
  });
  it("does not send same-column, invalid or disallowed transitions", () => {
    const change = mount();
    drop(task, "TODO", 99);
    drop(task, "unknown");
    drop({ ...task, status: "DONE" }, "TODO");
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Cannot move from Done to To Do",
    );
  });
  it.each([
    { ...task, readOnly: true },
    { ...task, deletedAt: "2026-01-01" },
    { ...task, status: "CANCELLED" } as Task,
  ])("blocks read-only, archived or terminal tasks", (source) => {
    const change = mount();
    drop(source, "IN_PROGRESS");
    expect(change).not.toHaveBeenCalled();
  });
  it("blocks movement without permission", () => {
    const change = mount(false);
    drop(task, "IN_PROGRESS");
    expect(change).not.toHaveBeenCalled();
  });
  it("provides a retry instead of showing failed queries as empty columns", async () => {
    state.error = true;
    mount();
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.queryByText(/No tasks in/)).not.toBeInTheDocument();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Retry tasks" })[0],
    );
    expect(state.retry).toHaveBeenCalledOnce();
  });
  it("provides explicit pagination for keyboard users", async () => {
    mount();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Load more tasks" })[0],
    );
    expect(state.more).toHaveBeenCalledOnce();
  });
});

it("retries a failed next page through its pagination operation", async () => {
  state.error = true;
  state.nextPageError = true;
  mount();
  await userEvent.click(
    screen.getAllByRole("button", { name: "Retry tasks" })[0],
  );
  expect(state.more).toHaveBeenCalledOnce();
  expect(state.retry).not.toHaveBeenCalled();
});
