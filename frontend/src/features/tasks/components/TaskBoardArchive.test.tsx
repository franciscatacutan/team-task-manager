import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Task } from "../types/task.types";
import type { TaskStatus } from "../utils/task.constants";
import TaskBoard from "./TaskBoard";

const legacy = {
  taskNumber: 2,
  name: "Earlier archived task",
  status: "DELETED",
  deletedAt: "2026-01-01",
  readOnly: true,
} as Task;
const current = {
  taskNumber: 1,
  name: "Archived task with preserved status",
  status: "TODO",
  deletedAt: "2026-01-01",
  readOnly: true,
} as Task;
vi.mock("./TaskCard", () => ({
  default: ({ task, onOpen }: { task: Task; onOpen: (task: Task) => void }) => (
    <button onClick={() => onOpen(task)}>{task.name}</button>
  ),
}));
vi.mock("../hooks/useInfiniteTasks", () => ({
  useInfiniteTasks: (_team: string, _project: string, status: TaskStatus) => {
    const content =
      status === "DELETED" ? [legacy] : status === "TODO" ? [current] : [];
    return {
      data: { pages: [{ content, totalElements: content.length }] },
      isLoading: false,
    };
  },
}));

describe("archived task board", () => {
  it("keeps both preserved-status and earlier DELETED records visible and openable", async () => {
    const open = vi.fn();
    render(
      <TaskBoard
        teamKey="TEAM"
        projectKey="PROJECT"
        params={{ deletedFilter: "DELETED" }}
        canChangeTaskStatus={() => false}
        onOpenTask={open}
        onStatusChange={vi.fn()}
      />,
    );
    expect(screen.getByText(current.name)).toBeInTheDocument();
    expect(screen.getByText("Previous status unavailable")).toBeInTheDocument();
    await userEvent.click(screen.getByText(legacy.name));
    expect(open).toHaveBeenCalledWith(legacy);
  });
  it("keeps the previous-status column out of the active workflow board", () => {
    render(
      <TaskBoard
        teamKey="TEAM"
        projectKey="PROJECT"
        params={{ deletedFilter: "ACTIVE" }}
        canChangeTaskStatus={() => false}
        onOpenTask={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );
    expect(
      screen.queryByText("Previous status unavailable"),
    ).not.toBeInTheDocument();
  });
  it("can filter specifically to archived records with unavailable previous status", () => {
    render(
      <TaskBoard
        teamKey="TEAM"
        projectKey="PROJECT"
        params={{ deletedFilter: "DELETED", status: ["DELETED"] }}
        canChangeTaskStatus={() => false}
        onOpenTask={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );
    expect(screen.getByText(legacy.name)).toBeInTheDocument();
    expect(screen.queryByText(current.name)).not.toBeInTheDocument();
  });
});
