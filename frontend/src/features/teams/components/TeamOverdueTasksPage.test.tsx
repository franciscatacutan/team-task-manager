import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import { getTeamOverdueTasks } from "../api/teamApi";
import type { TeamOverdueTask } from "../types/teamInsights.types";
import TeamOverdueTasksPage from "./TeamOverdueTasksPage";

vi.mock("../api/teamApi", () => ({ getTeamOverdueTasks: vi.fn() }));

const portal = {
  taskNumber: 1,
  name: "Review access",
  projectKey: "PORTAL",
  projectName: "Portal",
  plannedDueDay: "2026-11-12",
  priority: "HIGH",
  status: "IN_PROGRESS",
} satisfies TeamOverdueTask;
const release = {
  ...portal,
  projectKey: "RELEASE",
  projectName: "Release",
  name: "Verify rollback",
};

function TaskDetails() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Back to overdue tasks</button>;
}

function openOverdue() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/teams/CORE/insights/overdue"]}>
        <Routes>
          <Route path="/teams/:teamKey">
            <Route path="insights/overdue" element={<TeamOverdueTasksPage />} />
            <Route
              path="projects/:projectKey/tasks/:taskNumber"
              element={<TaskDetails />}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => vi.mocked(getTeamOverdueTasks).mockReset());

it("uses each project’s task route and restores the page after opening a task", async () => {
  vi.mocked(getTeamOverdueTasks).mockImplementation(async (_, page) => ({
    content: [page === 0 ? portal : release],
    page,
    size: 20,
    totalPages: 2,
    totalElements: 21,
    last: page === 1,
  }));
  const user = openOverdue();
  expect(
    await screen.findByRole("link", { name: /Review access/ }),
  ).toHaveAttribute("href", "/teams/CORE/projects/PORTAL/tasks/1");
  expect(screen.getByText("Showing 1–20 of 21")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Next" }));
  const task = await screen.findByRole("link", { name: /Verify rollback/ });
  expect(task).toHaveAttribute("href", "/teams/CORE/projects/RELEASE/tasks/1");
  expect(screen.getByText("Release")).toBeVisible();
  expect(screen.getByText("Showing 21–21 of 21")).toBeVisible();
  await user.click(task);
  await user.click(
    screen.getByRole("button", { name: "Back to overdue tasks" }),
  );
  expect(
    await screen.findByRole("link", { name: /Verify rollback/ }),
  ).toBeVisible();
});

it("offers retry for a failed list request and shows an empty result after success", async () => {
  vi.mocked(getTeamOverdueTasks)
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce({
      content: [],
      page: 0,
      size: 20,
      totalPages: 0,
      totalElements: 0,
      last: true,
    });
  const user = openOverdue();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to load overdue tasks",
  );
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("No overdue tasks.")).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Back to Team Insights" }),
  ).toHaveAttribute("href", "/teams/CORE/insights");
});
