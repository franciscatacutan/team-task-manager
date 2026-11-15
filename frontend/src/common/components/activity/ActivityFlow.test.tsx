import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeamActivity from "@/features/teams/components/TeamActivity";
import ProjectActivity from "@/features/projects/components/ProjectActivity";
import TaskActivity from "@/features/tasks/components/TaskActivity";
import { getTeamActivities } from "@/features/teams/api/teamApi";
import { getProjectActivities } from "@/features/projects/api/projectApi";
import { getTaskActivities } from "@/features/tasks/api/taskApi";
import type {
  ActivityQueryParams,
  ActivityRecord,
} from "@/common/types/activity.types";

vi.mock("@/features/teams/api/teamApi", () => ({ getTeamActivities: vi.fn() }));
vi.mock("@/features/projects/api/projectApi", () => ({
  getProjectActivities: vi.fn(),
}));
vi.mock("@/features/tasks/api/taskApi", () => ({ getTaskActivities: vi.fn() }));
let rows: ActivityRecord[];
const clients: QueryClient[] = [];
function page(params: ActivityQueryParams) {
  const search = params.search ?? "";
  const all = rows.filter(
    (row) =>
      row.message.toLowerCase().includes(search) ||
      row.user.email.includes(search),
  );
  const size = params.size ?? 20,
    index = params.page ?? 0;
  return {
    content: all.slice(index * size, (index + 1) * size),
    page: index,
    size,
    totalElements: all.length,
    totalPages: Math.ceil(all.length / size),
    last: (index + 1) * size >= all.length,
  };
}
function cache() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  return client;
}
function Location() {
  return <p data-testid="location">{useLocation().pathname}</p>;
}
beforeEach(() => {
  vi.resetAllMocks();
  rows = Array.from({ length: 25 }, (_, i) => ({
    id: `event-${i}`,
    message: `History row ${i}`,
    type: "TASK_COMMENTED",
    details: { fields: [], from: null, to: null, target: null },
    user: {
      id: "person",
      firstName: "Test",
      lastName: "Actor",
      email: i === 24 ? "mail-only@example.test" : "actor@example.test",
    },
    task: { id: "task", name: "Task", taskNumber: 7 },
    project: { id: "project", key: "PROJECT", name: "Project" },
    createdAt: "2026-11-04T00:00:00Z",
    targetPath: "/teams/TEAM/projects/PROJECT/tasks/7",
  }));
  vi.mocked(getTeamActivities).mockImplementation(async (_team, params) =>
    page(params),
  );
  vi.mocked(getProjectActivities).mockImplementation(
    async (_team, _project, params) => page(params),
  );
  vi.mocked(getTaskActivities).mockImplementation(
    async (_team, _project, _task, params) => page(params),
  );
});
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
});
function setup(variant: string) {
  const client = cache(),
    onOpenTask = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/teams/TEAM/activity"]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <Location />
                {variant === "team" ? (
                  <Routes>
                    <Route
                      path="/teams/:teamKey/activity"
                      element={<TeamActivity />}
                    />
                  </Routes>
                ) : variant === "project" ? (
                  <ProjectActivity
                    teamKey="TEAM"
                    projectKey="PROJECT"
                    onOpenTask={onOpenTask}
                  />
                ) : (
                  <TaskActivity
                    teamKey="TEAM"
                    projectKey="PROJECT"
                    taskNumber={7}
                  />
                )}
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { client, onOpenTask, user: userEvent.setup() };
}
describe("history queries and controls", () => {
  it.each(["team", "project", "task"])(
    "searches the complete %s history, resets page and preserves input focus",
    async (variant) => {
      const { user } = setup(variant);
      await screen.findByText("History row 0");
      await user.click(
        screen.getByRole("button", { name: "Next activity page" }),
      );
      await screen.findByText("History row 24");
      const input = screen.getByRole("textbox", { name: /Search .*activity/ });
      await user.type(input, "mail-only");
      expect(input).toHaveFocus();
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          "1 matching event · Page 1 of 1",
        ),
      );
      expect(screen.getByText("History row 24")).toBeInTheDocument();
      expect(screen.queryByText("History row 0")).not.toBeInTheDocument();
      expect(input).toHaveFocus();
      const calls =
        variant === "team"
          ? vi.mocked(getTeamActivities).mock.calls
          : variant === "project"
            ? vi.mocked(getProjectActivities).mock.calls
            : vi.mocked(getTaskActivities).mock.calls;
      expect(calls.at(-1)).toContainEqual({
        page: 0,
        size: 20,
        search: "mail-only",
        sort: "createdAt,desc",
      });
    },
  );
  it("uses the server-authorized route for team activity", async () => {
    const { user } = setup("team");
    await screen.findByText("History row 0");
    await user.click(
      screen.getAllByRole("button").find((el) => el.tagName === "ARTICLE")!,
    );
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/teams/TEAM/projects/PROJECT/tasks/7",
    );
  });
  it("opens a project task modal only for a navigable row", async () => {
    const { user, onOpenTask } = setup("project");
    await screen.findByText("History row 0");
    await user.click(
      screen.getAllByRole("button").find((el) => el.tagName === "ARTICLE")!,
    );
    expect(onOpenTask).toHaveBeenCalledWith(7);
  });
  it("does not display old-scope history or retain search/page state when a project changes", async () => {
    const client = cache(),
      user = userEvent.setup(),
      onOpen = vi.fn();
    const view = (key: string) => (
      <QueryClientProvider client={client}>
        <ProjectActivity teamKey="TEAM" projectKey={key} onOpenTask={onOpen} />
      </QueryClientProvider>
    );
    const result = render(view("PROJECT"));
    await screen.findByText("History row 0");
    await user.type(screen.getByRole("textbox"), "mail-only");
    await screen.findByText("History row 24");
    let resolve!: (value: ReturnType<typeof page>) => void;
    vi.mocked(getProjectActivities).mockReturnValueOnce(
      new Promise((yes) => {
        resolve = yes;
      }),
    );
    result.rerender(view("SECOND"));
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.queryByText("History row 24")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(getProjectActivities).toHaveBeenLastCalledWith(
        "TEAM",
        "SECOND",
        { page: 0, size: 20, search: "", sort: "createdAt,desc" },
        expect.any(AbortSignal),
      ),
    );
    await act(async () => resolve(page({})));
    await screen.findByText("History row 0");
  });
  it("keeps search and retry available when a history request fails", async () => {
    vi.mocked(getTaskActivities).mockRejectedValueOnce(
      new Error("unavailable"),
    );
    const { user } = setup("task");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load activity",
    );
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("History row 0");
  });
});
