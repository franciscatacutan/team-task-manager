import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActivityFeed } from "./ActivityFeed";
import type { TeamActivity } from "@/features/teams/types/team.type";

const item: TeamActivity = {
  id: "event-1",
  message: "Updated a work item",
  type: "TASK_UPDATED",
  details: { fields: [], from: null, to: null, target: null },
  user: {
    id: "user-1",
    firstName: "Test",
    lastName: "User",
    email: "user@example.test",
  },
  project: { key: "PROJ-A", name: "Platform project" },
  task: { taskNumber: 7, name: "Build login screen" },
  createdAt: "2026-11-02T00:00:00Z",
};

function renderFeed(search: string, groupBy: "project" | "task") {
  return render(
    <ActivityFeed
      variant="team"
      data={{
        items: [item],
        isLoading: false,
        page: 0,
        totalPages: 1,
        totalElements: 1,
      }}
      controls={{
        search,
        groupBy,
        sort: "createdAt,desc",
        groupByOptions: [
          { value: "project", label: "Project" },
          { value: "task", label: "Task" },
        ],
        onSearchChange: vi.fn(),
        onGroupByChange: vi.fn(),
        onSortChange: vi.fn(),
        onPageChange: vi.fn(),
      }}
    />,
  );
}

describe("activity domain names", () => {
  it("renders and groups by the project name", () => {
    renderFeed("", "project");
    expect(
      screen.getByRole("heading", { name: "Platform project" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Build login screen")).toBeInTheDocument();
  });

  it("finds and groups a task by its name", () => {
    renderFeed("login", "task");
    expect(
      screen.getByRole("heading", { name: "Build login screen" }),
    ).toBeInTheDocument();
  });

  it("finds an activity by its project name", () => {
    renderFeed("platform", "project");
    expect(screen.getByText("Build login screen")).toBeInTheDocument();
  });
});
