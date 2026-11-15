import type { PropsWithChildren } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TopBar from "@/layout/TopBar";
import TeamSelectionHeader from "@/features/teams/components/TeamSelectionHeader";
import { ProjectsHeader } from "@/features/projects/components/ProjectsHeader";
import CreateButton from "./CreateButton";
import { getProject } from "@/features/projects/api/projectApi";
import { queryKeys } from "@/common/query/queryKeys";
import type { Project } from "@/features/projects/types/project.types";
import type { UserRole } from "@/features/users/types/userRole";
import type { NullableTeamRole } from "@/features/teams/types/team.type";

const state = vi.hoisted(() => ({
  globalRole: "SUPER_ADMIN" as UserRole,
  teamRole: "OWNER" as NullableTeamRole,
  teamDeleted: false,
  teamLoaded: true,
  teamError: false,
}));
vi.mock("@/features/auth/hooks/useAuth", () => ({
  useAuth: () => ({ logout: vi.fn(), isLoggingOut: false }),
}));
vi.mock("@/features/users/api/userApi", () => ({
  getUserFromToken: () => ({ role: state.globalRole }),
}));
vi.mock("@/features/teams/hooks/useTeamMe", () => ({
  useTeamMe: (key: string) => ({
    data: key ? { role: state.teamRole } : undefined,
  }),
}));
vi.mock("@/features/teams/hooks/useTeam", () => ({
  useTeam: (key: string) => ({
    isError: state.teamError,
    data:
      key && state.teamLoaded
        ? { key, deletedAt: state.teamDeleted ? "2026-11-06" : null }
        : undefined,
  }),
}));
vi.mock("@/features/projects/api/projectApi", () => ({ getProject: vi.fn() }));
vi.mock("@/layout/UserMenu", () => ({
  default: () => <button>User menu</button>,
}));
vi.mock("@/features/notifications/components/NotificationCenter", () => ({
  default: () => <button>Notifications</button>,
}));
vi.mock("./AppBreadcrumbs", () => ({
  default: () => <nav aria-label="Breadcrumb" />,
}));
vi.mock("@/features/teams/components/CreateTeamModal", () => ({
  CreateTeamModal: () => null,
}));
vi.mock("@/features/projects/components/CreateProjectModal", () => ({
  CreateProjectModal: () => null,
}));
vi.mock("@/features/tasks/components/CreateTaskModal", () => ({
  CreateTaskModal: ({
    open,
    teamKey,
    projectKey,
  }: {
    open: boolean;
    teamKey: string;
    projectKey: string;
  }) =>
    open ? (
      <div
        role="dialog"
        aria-label="Create Task"
        data-scope={`${teamKey}/${projectKey}`}
      >
        Task form
      </div>
    ) : null,
}));
const project = {
  key: "PROJECT",
  teamKey: "TEAM",
  name: "Project",
  status: "ACTIVE",
  deletedAt: null,
  readOnly: false,
} as Project;
const clients: QueryClient[] = [];
beforeEach(() => {
  state.globalRole = "SUPER_ADMIN";
  state.teamRole = "OWNER";
  state.teamDeleted = false;
  state.teamLoaded = true;
  state.teamError = false;
  vi.mocked(getProject).mockReset().mockResolvedValue(project);
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});
function mount(path = "/teams/TEAM/projects/PROJECT", cachedProject?: Project) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  if (cachedProject)
    client.setQueryData(
      queryKeys.projects.detail("TEAM", "PROJECT"),
      cachedProject,
    );
  clients.push(client);
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  render(
    <Routes>
      <Route path="/teams" element={<TopBar />} />
      <Route path="/teams/:teamKey/projects" element={<TopBar />} />
      <Route path="/teams/:teamKey/projects/:projectKey" element={<TopBar />} />
    </Routes>,
    { wrapper },
  );
  return client;
}
async function menu() {
  await userEvent.click(screen.getByRole("button", { name: "Create" }));
  return {
    team: screen.getByRole("menuitem", { name: "Create team" }),
    project: screen.getByRole("menuitem", { name: "Create project" }),
    task: screen.getByRole("menuitem", { name: "Create task" }),
  };
}
async function loaded(client: QueryClient, status = "success") {
  await waitFor(() =>
    expect(
      client.getQueryState(queryKeys.projects.detail("TEAM", "PROJECT"))
        ?.status,
    ).toBe(status),
  );
}

describe("context-aware global creation", () => {
  it.each(["OWNER", "ADMIN"] as const)(
    "allows an active project's %s to open task creation with the current scope",
    async (role) => {
      state.teamRole = role;
      const client = mount();
      await loaded(client);
      const actions = await menu();
      expect(actions.task).not.toHaveAttribute("aria-disabled", "true");
      await userEvent.click(actions.task);
      await waitFor(() =>
        expect(
          screen.getByRole("dialog", { name: "Create Task" }),
        ).toHaveAttribute("data-scope", "TEAM/PROJECT"),
      );
    },
  );
  it.each([{ readOnly: true }, { deletedAt: "2026-11-06" }])(
    "blocks global task creation for archived/read-only project state %j",
    async (change) => {
      vi.mocked(getProject).mockResolvedValue({ ...project, ...change });
      const client = mount();
      await loaded(client);
      const actions = await menu();
      expect(actions.task).toHaveAttribute("aria-disabled", "true");
      expect(actions.project).not.toHaveAttribute("aria-disabled", "true");
      await userEvent.click(actions.task);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );
  it("blocks team-bound creation in an archived team while retaining independent team creation", async () => {
    state.teamDeleted = true;
    const client = mount();
    await loaded(client);
    const actions = await menu();
    expect(actions.project).toHaveAttribute("aria-disabled", "true");
    expect(actions.task).toHaveAttribute("aria-disabled", "true");
    expect(actions.team).not.toHaveAttribute("aria-disabled", "true");
  });
  it("waits for confirmed project context before enabling task creation", async () => {
    vi.mocked(getProject).mockImplementation(() => new Promise(() => {}));
    mount();
    const actions = await menu();
    expect(actions.task).toHaveAttribute("aria-disabled", "true");
  });
  it("does not enable task creation when the project read fails", async () => {
    vi.mocked(getProject).mockRejectedValue(new Error("Unavailable"));
    const client = mount();
    await loaded(client, "error");
    expect((await menu()).task).toHaveAttribute("aria-disabled", "true");
  });
  it("blocks task creation after a failed refresh even when old project data remains cached", async () => {
    vi.mocked(getProject).mockRejectedValue(
      new Error("Project no longer available"),
    );
    const client = mount("/teams/TEAM/projects/PROJECT", project);
    await loaded(client, "error");
    expect(
      client.getQueryData(queryKeys.projects.detail("TEAM", "PROJECT")),
    ).toEqual(project);
    expect((await menu()).task).toHaveAttribute("aria-disabled", "true");
  });
  it("blocks team-bound creation after a failed team read with cached data", async () => {
    state.teamError = true;
    const client = mount();
    await loaded(client);
    const actions = await menu();
    expect(actions.project).toHaveAttribute("aria-disabled", "true");
    expect(actions.task).toHaveAttribute("aria-disabled", "true");
    expect(actions.team).not.toHaveAttribute("aria-disabled", "true");
  });
  it("waits for team context before enabling project/task creation", async () => {
    state.teamLoaded = false;
    const client = mount();
    await loaded(client);
    const actions = await menu();
    expect(actions.project).toHaveAttribute("aria-disabled", "true");
    expect(actions.task).toHaveAttribute("aria-disabled", "true");
  });
  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "does not give a global %s team editing power without a team management role",
    async (role) => {
      state.globalRole = role;
      state.teamRole = "MEMBER";
      const client = mount();
      await loaded(client);
      const actions = await menu();
      expect(actions.team).not.toHaveAttribute("aria-disabled", "true");
      expect(actions.project).toHaveAttribute("aria-disabled", "true");
      expect(actions.task).toHaveAttribute("aria-disabled", "true");
    },
  );
  it("does not render an empty creation menu for a regular member", () => {
    state.globalRole = "USER";
    state.teamRole = "MEMBER";
    mount();
    expect(
      screen.queryByRole("button", { name: "Create" }),
    ).not.toBeInTheDocument();
  });
  it.each(["/teams", "/teams/TEAM/projects"])(
    "does not request an unscoped project on %s",
    async (path) => {
      mount(path);
      expect(getProject).not.toHaveBeenCalled();
      expect(
        screen.getByRole("link", { name: "TeamTaskManager" }),
      ).toHaveAttribute("href", "/teams");
      const actions = await menu();
      expect(actions.task).toHaveAttribute("aria-disabled", "true");
    },
  );
});

describe("explicit page creation labels", () => {
  it.each(["team", "project", "task"] as const)(
    "names and activates the shared %s action",
    async (entity) => {
      const create = vi.fn();
      render(<CreateButton entity={entity} onClick={create} />);
      await userEvent.click(
        screen.getByRole("button", { name: `Create ${entity}` }),
      );
      expect(create).toHaveBeenCalledOnce();
    },
  );
  it.each([true, false])(
    "preserves team/project header creation permissions (%s)",
    (allowed) => {
      render(
        <>
          <TeamSelectionHeader
            totalTeam={2}
            canCreateTeam={allowed}
            setOpen={vi.fn()}
          />
          <ProjectsHeader
            canCreateProject={allowed}
            onCreateProject={vi.fn()}
          />
        </>,
      );
      for (const entity of ["team", "project"])
        expect(
          Boolean(
            screen.queryByRole("button", {
              name: `Create ${entity}`,
            }),
          ),
        ).toBe(allowed);
    },
  );
});
