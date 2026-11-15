import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import { getMyWork } from "@/features/tasks/api/taskApi";
import type { MyWorkItem } from "@/features/tasks/types/task.types";
import MyWorkPage from "./MyWorkPage";

vi.mock("@/features/auth/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ data: { id: "member" } }),
}));
vi.mock("@/features/tasks/api/taskApi", () => ({ getMyWork: vi.fn() }));

const assignment = {
  taskNumber: 1,
  name: "Write the release notes",
  status: "IN_PROGRESS",
  priority: "HIGH",
  plannedDueDay: "2026-11-12",
  teamKey: "CORE",
  teamName: "Core team",
  projectKey: "PORTAL",
  projectName: "Portal",
  assigned: true,
} satisfies MyWorkItem;

const support = {
  ...assignment,
  name: "Review the rollout",
  teamKey: "OPS",
  teamName: "Operations",
  projectKey: "RUNBOOK",
  projectName: "Runbook",
  assigned: false,
};

function Detail() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Back to My Work</button>;
}

function openMyWork() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/my-work"]}>
        <Routes>
          <Route path="/my-work" element={<MyWorkPage />} />
          <Route
            path="/teams/:team/projects/:project/tasks/:number"
            element={<Detail />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => vi.mocked(getMyWork).mockReset());

it("links matching task numbers to their own teams and restores the selected page", async () => {
  vi.mocked(getMyWork).mockImplementation(async (page) => ({
    content: [page === 0 ? assignment : support],
    page,
    size: 20,
    totalPages: 2,
    totalElements: 21,
    last: page === 1,
  }));
  const user = openMyWork();
  expect(
    await screen.findByRole("link", { name: /Write the release notes/ }),
  ).toHaveAttribute("href", "/teams/CORE/projects/PORTAL/tasks/1");
  expect(screen.getByText(/Assigned to you/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Next" }));
  const link = await screen.findByRole("link", { name: /Review the rollout/ });
  expect(link).toHaveAttribute("href", "/teams/OPS/projects/RUNBOOK/tasks/1");
  expect(screen.getByText(/^You’re supporting/)).toBeVisible();
  await user.click(link);
  await user.click(screen.getByRole("button", { name: "Back to My Work" }));
  expect(
    await screen.findByRole("link", { name: /Review the rollout/ }),
  ).toBeVisible();
});

it("retries a failed request and lets the user include closed work", async () => {
  vi.mocked(getMyWork)
    .mockRejectedValueOnce(new Error("Offline"))
    .mockImplementation(async (page, includeClosed) => ({
      content: includeClosed ? [{ ...assignment, status: "DONE" }] : [],
      page,
      size: 20,
      totalPages: includeClosed ? 1 : 0,
      totalElements: includeClosed ? 1 : 0,
      last: true,
    }));
  const user = openMyWork();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to load your work",
  );
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("No open tasks")).toBeVisible();
  await user.click(
    screen.getByRole("checkbox", { name: /Include completed and cancelled/ }),
  );
  expect(await screen.findByText("Done")).toBeVisible();
  expect(getMyWork).toHaveBeenLastCalledWith(0, true, expect.any(AbortSignal));
});
