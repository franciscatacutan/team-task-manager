import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/api/apiClients";
import { getTeamInsights } from "@/features/teams/api/teamApi";
import { getProjectInsights } from "@/features/projects/api/projectApi";
import TeamInsightsDashboard from "@/features/teams/components/TeamInsightsDashboard";
import ProjectInsightsDashboard from "@/features/projects/components/ProjectInsightsDashboard";
import type { TeamInsights } from "@/features/teams/types/teamInsights.types";
import type { ProjectInsights } from "@/features/projects/types/projectInsights.types";
vi.mock("@/api/apiClients", () => ({ apiClient: { get: vi.fn() } }));
afterEach(() => vi.resetAllMocks());
const tasks = {
  total: 20,
  todo: 6,
  inProgress: 4,
  inReview: 2,
  onHold: 1,
  done: 6,
  cancelled: 1,
  overdue: 1,
  highPriority: 2,
  criticalPriority: 1,
};
const flow = {
  completedLast7Days: 3,
  completionRatePercent: 30,
  averageCycleTimeHours: 24.5,
};
const activity = {
  activityEventsLast7Days: 5,
  auditEventsLast7Days: 4,
  systemEventsLast7Days: 2,
};
const team = {
  teamId: "11000000-0000-4000-8000-000000000001",
  generatedAt: "2026-11-05T00:00:00Z",
  tasks,
  flow,
  activity,
  membership: { total: 5, owners: 1, admins: 1, members: 3 },
  projects: {
    total: 5,
    active: 3,
    onHold: 1,
    completed: 1,
    completedLast7Days: 1,
    completionRatePercent: 20,
  },
  health: {
    openTasks: 13,
    overdueTasks: 1,
    openTasksPerMember: 2.6,
    activeProjectsPerMember: 0.6,
  },
} satisfies TeamInsights;
const project = {
  teamId: team.teamId,
  projectId: "22000000-0000-4000-8000-000000000002",
  generatedAt: team.generatedAt,
  status: "ACTIVE",
  plannedStartDate: null,
  plannedDueDate: null,
  actualStartDate: null,
  actualCompletionDate: null,
  tasks,
  flow,
  activity,
  health: { overdue: false, daysUntilDue: 0, completedOnTime: false },
} satisfies ProjectInsights;

describe("KPI response contracts", () => {
  it("renders a backend-shaped team summary fetched through its public route key", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: team });
    const result = await getTeamInsights("DELIVERY");
    expect(apiClient.get).toHaveBeenCalledExactlyOnceWith(
      "/teams/DELIVERY/insights/summary",
    );
    expect(result.teamId).toBe(team.teamId);
    render(<TeamInsightsDashboard insights={result} />);
    expect(screen.getByRole("heading", { name: "Team KPIs" })).toBeVisible();
    expect(screen.getAllByText("30%")[0]).toBeVisible();
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  });
  it("renders a backend-shaped project summary while routes keep public team/project keys", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: project });
    const result = await getProjectInsights("DELIVERY", "PORTAL");
    expect(apiClient.get).toHaveBeenCalledExactlyOnceWith(
      "/teams/DELIVERY/projects/PORTAL/insights/summary",
    );
    expect(result.projectId).toBe(project.projectId);
    render(<ProjectInsightsDashboard insights={result} />);
    expect(screen.getByRole("heading", { name: "Project KPIs" })).toBeVisible();
    expect(screen.getByText("20 total project tasks")).toBeVisible();
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  });
  it("handles an empty project summary without missing-value or divide-by-zero output", () => {
    const emptyTasks = {
      total: 0,
      todo: 0,
      inProgress: 0,
      inReview: 0,
      onHold: 0,
      done: 0,
      cancelled: 0,
      overdue: 0,
      highPriority: 0,
      criticalPriority: 0,
    };
    render(
      <ProjectInsightsDashboard
        insights={{
          ...project,
          tasks: emptyTasks,
          flow: {
            completedLast7Days: 0,
            completionRatePercent: 0,
            averageCycleTimeHours: 0,
          },
        }}
      />,
    );
    expect(screen.getByText("0 total project tasks")).toBeVisible();
    expect(screen.getAllByText("0%")[0]).toBeVisible();
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  });
});
