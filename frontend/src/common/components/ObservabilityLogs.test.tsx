import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type {
  ObservabilityAuditLog,
  ObservabilitySystemEvent,
} from "../types/observability.types";
import TeamObservabilityLogs from "@/features/teams/components/TeamObservabilityLogs";
import ProjectObservabilityLogs from "@/features/projects/components/ProjectObservabilityLogs";
import {
  getTeamAuditLogs,
  getTeamSystemEvents,
} from "@/features/teams/api/teamApi";
import {
  getProjectAuditLogs,
  getProjectSystemEvents,
} from "@/features/projects/api/projectApi";

vi.mock("@/features/teams/api/teamApi", () => ({
  getTeamAuditLogs: vi.fn(),
  getTeamSystemEvents: vi.fn(),
}));
vi.mock("@/features/projects/api/projectApi", () => ({
  getProjectAuditLogs: vi.fn(),
  getProjectSystemEvents: vi.fn(),
}));
const page = (
  content: unknown[],
  number = 0,
  totalPages = content.length ? 1 : 0,
) => ({
  content,
  page: number,
  size: 10,
  totalPages,
  totalElements: content.length,
  last: true,
});
const auditRow = {
  id: "audit",
  teamId: "11000000-0000-4000-8000-000000000001",
  projectId: "22000000-0000-4000-8000-000000000002",
  taskId: "33000000-0000-4000-8000-000000000003",
  entityType: "TEAM",
  entityId: "11000000-0000-4000-8000-000000000001",
  action: "UPDATE",
  eventType: "TEAM_UPDATED",
  summary: "Audit record loaded",
  actor: {
    id: "44000000-0000-4000-8000-000000000004",
    firstName: "Audit",
    lastName: "Actor",
    email: "audit@example.test",
  },
  metadata: null,
  occurredAt: "2026-11-04T00:00:00Z",
} satisfies ObservabilityAuditLog;
const systemRow = {
  id: "system",
  teamId: "11000000-0000-4000-8000-000000000001",
  projectId: "22000000-0000-4000-8000-000000000002",
  taskId: "33000000-0000-4000-8000-000000000003",
  severity: "INFO",
  category: "TEAM",
  eventName: "TEAM_UPDATED",
  source: "TeamService",
  message: "System record loaded",
  actor: null,
  context: null,
  occurredAt: "2026-11-04T00:00:00Z",
} satisfies ObservabilitySystemEvent;
const denied = (status: number) => ({
  isAxiosError: true,
  response: { status },
});
const originalScroll = HTMLElement.prototype.scrollIntoView;
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterAll(() => {
  if (originalScroll) HTMLElement.prototype.scrollIntoView = originalScroll;
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  vi.resetAllMocks();
});
afterEach(() => client.clear());

describe.each([
  {
    scope: "team",
    audit: vi.mocked(getTeamAuditLogs),
    system: vi.mocked(getTeamSystemEvents),
    component: <TeamObservabilityLogs teamKey="TEAM" />,
  },
  {
    scope: "project",
    audit: vi.mocked(getProjectAuditLogs),
    system: vi.mocked(getProjectSystemEvents),
    component: <ProjectObservabilityLogs teamKey="TEAM" projectKey="PROJECT" />,
  },
])("$scope operational stream feedback", ({ audit, system, component }) => {
  function mount() {
    return render(
      <QueryClientProvider client={client}>{component}</QueryClientProvider>,
    );
  }
  it.each([
    { eventType: "TASK_UPDATED", label: "Updated" },
    { eventType: "TASK_DELETED", label: "Archived" },
    { eventType: "TASK_COMMENTED", label: "Comment" },
  ] as const)(
    "uses the supplied $eventType label without inferring it from the summary",
    async ({ eventType, label }) => {
      audit.mockResolvedValue(page([{ ...auditRow, eventType }]) as never);
      system.mockResolvedValue(
        page([{ ...systemRow, eventName: eventType }]) as never,
      );
      mount();
      await screen.findByText("Audit record loaded");
      expect(screen.getByText(label, { exact: true })).toBeVisible();
      await userEvent.click(screen.getByRole("tab", { name: "System Events" }));
      await screen.findByText("System record loaded");
      expect(screen.getByText(label, { exact: true })).toBeVisible();
    },
  );
  it("humanizes unknown system event names instead of inventing a comment label", async () => {
    audit.mockResolvedValue(page([]) as never);
    system.mockResolvedValue(
      page([{ ...systemRow, eventName: "DELIVERY_RETRY_SCHEDULED" }]) as never,
    );
    mount();
    await userEvent.click(screen.getByRole("tab", { name: "System Events" }));
    await screen.findByText("System record loaded");
    expect(screen.getByText("Delivery Retry Scheduled")).toBeVisible();
    expect(
      screen.queryByText("Comment", { exact: true }),
    ).not.toBeInTheDocument();
  });

  it("renders backend UUID context without treating it as public keys or task numbers", async () => {
    audit.mockResolvedValue(page([auditRow]) as never);
    system.mockResolvedValue(page([systemRow]) as never);
    mount();
    await screen.findByText("Audit record loaded");
    const assertContext = () => {
      for (const [label, id] of [
        ["Team", auditRow.teamId],
        ["Project", auditRow.projectId],
        ["Task", auditRow.taskId],
      ]) {
        expect(screen.getByText(`${label} ID: ${id}`)).toBeVisible();
      }
      expect(
        screen.queryByText(/Project key|Task number/i),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    };
    assertContext();
    expect(screen.getByText("Audit Actor")).toBeVisible();
    await userEvent.click(screen.getByRole("tab", { name: "System Events" }));
    await screen.findByText("System record loaded");
    assertContext();
    expect(screen.getByText("System")).toBeVisible();
  });

  it.each([
    { name: "all context absent", teamId: null, projectId: null, taskId: null },
    {
      name: "team only",
      teamId: "11000000-0000-4000-8000-000000000001",
      projectId: null,
      taskId: null,
    },
    {
      name: "task without project context",
      teamId: null,
      projectId: null,
      taskId: "33000000-0000-4000-8000-000000000003",
    },
  ])(
    "omits missing UUID context: $name",
    async ({ teamId, projectId, taskId }) => {
      const context = { teamId, projectId, taskId };
      audit.mockResolvedValue(page([{ ...auditRow, ...context }]) as never);
      system.mockResolvedValue(page([{ ...systemRow, ...context }]) as never);
      mount();
      await screen.findByText("Audit record loaded");
      const assertContext = () => {
        for (const [label, id] of [
          ["Team", teamId],
          ["Project", projectId],
          ["Task", taskId],
        ]) {
          if (id) expect(screen.getByText(`${label} ID: ${id}`)).toBeVisible();
          else
            expect(
              screen.queryByText(new RegExp(`^${label} ID:`)),
            ).not.toBeInTheDocument();
        }
        expect(screen.queryByText(/null|undefined/)).not.toBeInTheDocument();
      };
      assertContext();
      await userEvent.click(screen.getByRole("tab", { name: "System Events" }));
      await screen.findByText("System record loaded");
      assertContext();
    },
  );

  it("keeps independent stream pages and resets both when sort changes", async () => {
    audit.mockImplementation(
      async (...args) =>
        page([auditRow], (args.at(-1) as { page: number }).page, 2) as never,
    );
    system.mockImplementation(
      async (...args) =>
        page([systemRow], (args.at(-1) as { page: number }).page, 2) as never,
    );
    mount();
    const user = userEvent.setup();
    await screen.findByText("Audit record loaded");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page 2 of 2");
    expect(system.mock.calls.at(-1)?.at(-1)).toEqual({
      page: 0,
      size: 10,
      sort: "occurredAt,desc",
    });
    await user.click(screen.getByRole("tab", { name: "System Events" }));
    await screen.findByText("Page 1 of 2");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page 2 of 2");
    screen.getByRole("combobox", { name: "Sort operational logs" }).focus();
    await user.keyboard("{ArrowDown}");
    await user.click(
      await screen.findByRole("option", { name: "Oldest first" }),
    );
    await waitFor(() => {
      expect(audit.mock.calls.at(-1)?.at(-1)).toEqual({
        page: 0,
        size: 10,
        sort: "occurredAt,asc",
      });
      expect(system.mock.calls.at(-1)?.at(-1)).toEqual({
        page: 0,
        size: 10,
        sort: "occurredAt,asc",
      });
    });
    await screen.findByText("Page 1 of 2");
    await user.click(screen.getByRole("tab", { name: "Audit Logs" }));
    await screen.findByText("Page 1 of 2");
  });

  it("shows errors instead of empty histories and retries only the selected stream", async () => {
    audit
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(page([auditRow]) as never);
    system.mockResolvedValue(page([systemRow]) as never);
    mount();
    const user = userEvent.setup();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load audit logs.",
    );
    expect(screen.queryByText("No audit logs yet")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "System Events" }));
    expect(await screen.findByText("System record loaded")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Audit Logs" }));
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Audit record loaded")).toBeVisible();
    expect(audit).toHaveBeenCalledTimes(2);
    expect(system).toHaveBeenCalledTimes(1);
  });
  it("preserves successful audit data while system retry is pending and then recovers", async () => {
    let resolve!: (value: never) => void;
    audit.mockResolvedValue(page([auditRow]) as never);
    system.mockRejectedValueOnce(new Error("offline")).mockImplementationOnce(
      () =>
        new Promise<never>((yes) => {
          resolve = yes;
        }),
    );
    mount();
    const user = userEvent.setup();
    await screen.findByText("Audit record loaded");
    await user.click(screen.getByRole("tab", { name: "System Events" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load system events.",
    );
    expect(screen.queryByText("No system events")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("status", { name: "Loading logs" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Audit Logs" }));
    expect(screen.getByText("Audit record loaded")).toBeVisible();
    await act(async () => resolve(page([systemRow]) as never));
    await user.click(screen.getByRole("tab", { name: "System Events" }));
    expect(await screen.findByText("System record loaded")).toBeVisible();
    expect(audit).toHaveBeenCalledTimes(1);
    expect(system).toHaveBeenCalledTimes(2);
  });
  it.each([500, 403, 404])(
    "handles cached audit data after a %s refresh failure",
    async (status) => {
      audit
        .mockResolvedValueOnce(page([auditRow]) as never)
        .mockRejectedValue(denied(status));
      system.mockResolvedValue(page([]) as never);
      mount();
      await screen.findByText("Audit record loaded");
      await act(async () => {
        await client.refetchQueries({
          predicate: (query) =>
            String(query.queryKey[0]).includes("audit-logs"),
        });
      });
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Unable to load audit logs.",
      );
      if (status === 500) {
        expect(screen.getByText("Audit record loaded")).toBeVisible();
        expect(
          screen.getByText(/Showing the last loaded audit logs/),
        ).toBeVisible();
      } else
        expect(
          screen.queryByText("Audit record loaded"),
        ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Next" }),
      ).not.toBeInTheDocument();
    },
  );
  it("distinguishes a confirmed empty history from an unsuccessful request", async () => {
    audit.mockResolvedValue(page([]) as never);
    system.mockResolvedValue(page([]) as never);
    mount();
    expect(await screen.findByText("No audit logs yet")).toBeVisible();
    await userEvent.click(screen.getByRole("tab", { name: "System Events" }));
    expect(await screen.findByText("No system events")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("retries the failed page rather than resetting to the first page", async () => {
    audit
      .mockResolvedValueOnce(page([auditRow], 0, 2) as never)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(
        page([{ ...auditRow, summary: "Second page loaded" }], 1, 2) as never,
      );
    system.mockResolvedValue(page([]) as never);
    mount();
    const user = userEvent.setup();
    await screen.findByText("Audit record loaded");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Second page loaded")).toBeVisible();
    await waitFor(() => expect(screen.getByText("Page 2 of 2")).toBeVisible());
    expect(audit.mock.calls[2].at(-1)).toEqual({
      page: 1,
      size: 10,
      sort: "occurredAt,desc",
    });
  });
});
