import { fireEvent, render, screen } from "@testing-library/react";
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

it("shows a failed activity read with a retry instead of an empty feed", () => {
  const retry = vi.fn();
  render(
    <ActivityFeed
      variant="team"
      data={{
        items: [],
        isLoading: false,
        isError: true,
        onRetry: retry,
        page: 0,
        totalPages: 0,
        totalElements: 0,
      }}
      controls={{
        search: "",
        sort: "createdAt,desc",
        groupBy: "date",
        groupByOptions: [],
        onSearchChange: vi.fn(),
        onGroupByChange: vi.fn(),
        onSortChange: vi.fn(),
        onPageChange: vi.fn(),
      }}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("activity");
  expect(screen.queryByText("No team activity yet")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledOnce();
});

function feed(
  items: TeamActivity[],
  groupBy: "person" | "project" | "task" | "date",
  extras = {},
) {
  const onOpenTask = vi.fn();
  const result = render(
    <ActivityFeed
      variant="team"
      data={{
        items,
        isLoading: false,
        page: 0,
        totalPages: 1,
        totalElements: items.length,
        ...extras,
      }}
      controls={{
        search: "",
        sort: "createdAt,desc",
        groupBy,
        groupByOptions: [{ value: groupBy, label: groupBy }],
        onSearchChange: vi.fn(),
        onSortChange: vi.fn(),
        onGroupByChange: vi.fn(),
        onPageChange: vi.fn(),
      }}
      behavior={{ onOpenTask }}
    />,
  );
  return { ...result, onOpenTask };
}

it("keeps groups in the first event's chronology rather than alphabetic order", () => {
  feed(
    [
      {
        ...item,
        id: "recent",
        user: { ...item.user, id: "ada", firstName: "Ada", lastName: "Person" },
      },
      {
        ...item,
        id: "older",
        user: { ...item.user, id: "zed", firstName: "Zed", lastName: "Person" },
        createdAt: "2026-11-01T00:00:00Z",
      },
    ],
    "person",
  );
  expect(
    screen.getAllByRole("heading", { level: 3 }).map((el) => el.textContent),
  ).toEqual(["Ada Person", "Zed Person"]);
  expect(
    screen.getByText("Grouped on this page. Search covers the full history."),
  ).toBeInTheDocument();
});

it.each(["person", "project", "task"] as const)(
  "keeps separate %s identities with duplicate display names",
  (groupBy) => {
    const a = {
      ...item,
      project: { id: "p1", key: "P1", name: "Same" },
      task: { id: "t1", taskNumber: 1, name: "Same" },
      user: { ...item.user, id: "u1", firstName: "Same", lastName: "Person" },
    };
    const b = {
      ...a,
      id: "second",
      project: { ...a.project, id: "p2", key: "P2" },
      task: { ...a.task, id: "t2" },
      user: { ...a.user, id: "u2", email: "second@example.test" },
    };
    feed([a, b], groupBy);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
  },
);

it("keeps controls mounted while loading and reports matches rather than a false empty history", () => {
  feed([], "date", { isLoading: true });
  expect(
    screen.getByRole("textbox", { name: "Search team activity..." }),
  ).toBeInTheDocument();
  expect(screen.getByText("Loading activity...")).toBeInTheDocument();
});

it("does not make a row interactive when the server supplies no authorized destination", () => {
  const { onOpenTask } = feed([{ ...item, targetPath: null }], "date");
  fireEvent.click(screen.getByText("Build login screen"));
  expect(onOpenTask).not.toHaveBeenCalled();
});

it("expands long text without accidentally opening its task, while the row supports keyboard opening", () => {
  const { onOpenTask, container } = feed(
    [
      {
        ...item,
        message: "Long history ".repeat(30),
        targetPath: "/teams/TEAM/projects/PROJECT/tasks/7",
      },
    ],
    "date",
  );
  const more = screen.getByRole("button", { name: "Show more" });
  fireEvent.click(more);
  expect(onOpenTask).not.toHaveBeenCalled();
  fireEvent.keyDown(more, { key: "Enter" });
  expect(onOpenTask).not.toHaveBeenCalled();
  fireEvent.keyDown(container.querySelector("article")!, { key: "Enter" });
  expect(onOpenTask).toHaveBeenCalledOnce();
});
