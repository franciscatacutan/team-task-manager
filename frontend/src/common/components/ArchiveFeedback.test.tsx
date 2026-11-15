import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useState } from "react";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router";
import { queryKeys } from "@/common/query/queryKeys";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeleteTaskButton from "@/features/tasks/components/DeleteTaskButton";
import { DeleteProjectButton } from "@/features/projects/components/DeleteProjectButton";
import { DeleteTeam } from "@/features/teams/components/DeleteTeamModal";
import { deleteTask } from "@/features/tasks/api/taskApi";
import { deleteProject } from "@/features/projects/api/projectApi";
import { deleteTeam } from "@/features/teams/api/teamApi";
import { authStorage } from "@/features/auth/utils/authStorage";
vi.mock("@/features/tasks/api/taskApi", () => ({ deleteTask: vi.fn() }));
vi.mock("@/features/projects/api/projectApi", () => ({
  deleteProject: vi.fn(),
}));
vi.mock("@/features/teams/api/teamApi", () => ({ deleteTeam: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  authStorage.endLogout();
  authStorage.setToken("current");
});
describe("archive confirmation feedback", () => {
  it.each(["task", "project", "team"] as const)(
    "keeps %s failure visible and supports a confirmed retry",
    async (level) => {
      const api =
        level === "task"
          ? vi.mocked(deleteTask)
          : level === "project"
            ? vi.mocked(deleteProject)
            : vi.mocked(deleteTeam);
      api
        .mockRejectedValueOnce({
          isAxiosError: true,
          response: { data: { message: "Archive was rejected" } },
        })
        .mockResolvedValueOnce(undefined);
      const client = new QueryClient();
      const success = vi.fn();
      render(
        <QueryClientProvider client={client}>
          <MemoryRouter>
            {level === "task" ? (
              <DeleteTaskButton
                teamKey="TEAM"
                projectKey="PROJECT"
                taskNumber={7}
                taskName="Task"
                onTaskDeleted={success}
              />
            ) : level === "project" ? (
              <DeleteProjectButton
                teamKey="TEAM"
                projectKey="PROJECT"
                projectName="Project"
                onProjectDeleted={success}
              />
            ) : (
              <DeleteTeam
                teamKey="TEAM"
                teamName="Team"
                onTeamDeleted={success}
              />
            )}
          </MemoryRouter>
        </QueryClientProvider>,
      );
      const user = userEvent.setup();
      await user.click(
        screen.getByRole("button", { name: `Archive ${level}` }),
      );
      await user.click(screen.getByRole("button", { name: "Archive" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Archive was rejected",
      );
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(success).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: "Archive" }));
      await waitFor(() => expect(success).toHaveBeenCalledOnce());
      expect(api).toHaveBeenCalledTimes(2);
      client.clear();
    },
  );
  it("explains project recovery before archiving and lets the user cancel", async () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DeleteProjectButton
            teamKey="TEAM"
            projectKey="PROJECT"
            projectName="Website launch"
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Archive project" }));
    const dialog = screen.getByRole("alertdialog", { name: "Archive project" });
    expect(dialog).toHaveTextContent(
      /Website launch.*tasks will become read-only/,
    );
    expect(dialog).toHaveTextContent(
      /database operator and a backup from before archiving/,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(deleteProject).not.toHaveBeenCalled();
    client.clear();
  });

  it("returns from a standalone task before the archive refresh removes its button", async () => {
    let readOnly = false;
    const detailKey = queryKeys.tasks.detail("TEAM", "PROJECT", 7);
    const client = new QueryClient();
    vi.mocked(deleteTask).mockImplementation(async () => {
      readOnly = true;
    });
    const readTask = async () => ({ readOnly });
    function TaskPage() {
      const task = useQuery({ queryKey: detailKey, queryFn: readTask });
      return task.data && !task.data.readOnly ? (
        <DeleteTaskButton
          teamKey="TEAM"
          projectKey="PROJECT"
          taskNumber={7}
          taskName="Task"
        />
      ) : (
        <p>Read-only task</p>
      );
    }
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/teams/TEAM/projects/PROJECT/tasks/7"]}>
          <Routes>
            <Route
              path="/teams/TEAM/projects/PROJECT/tasks/7"
              element={<TaskPage />}
            />
            <Route
              path="/teams/TEAM/projects/PROJECT"
              element={<h1>Project</h1>}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Archive task" }),
    );
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(
      await screen.findByRole("heading", { name: "Project" }),
    ).toBeVisible();
    expect(deleteTask).toHaveBeenCalledExactlyOnceWith("TEAM", "PROJECT", 7);
    client.clear();
  });

  it("closes the archived task dialog without resetting the project tab or filters", async () => {
    vi.mocked(deleteTask).mockResolvedValueOnce(undefined);
    const client = new QueryClient();
    function ProjectPage() {
      const [showTask, setShowTask] = useState(true);
      const location = useLocation();
      return (
        <>
          <output aria-label="Project URL">{location.search}</output>
          {showTask && (
            <DeleteTaskButton
              teamKey="TEAM"
              projectKey="PROJECT"
              taskNumber={7}
              taskName="Task"
              onTaskDeleted={() => setShowTask(false)}
            />
          )}
        </>
      );
    }
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter
          initialEntries={[
            "/teams/TEAM/projects/PROJECT?view=activity&q=release",
          ]}
        >
          <ProjectPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Archive task" }));
    await user.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Project URL")).toHaveTextContent(
      "?view=activity&q=release",
    );
    client.clear();
  });

  it("returns to Projects before the confirmed archive refresh can hide its button", async () => {
    let readOnly = false;
    const detailKey = queryKeys.projects.detail("TEAM", "PROJECT");
    const client = new QueryClient();
    vi.mocked(deleteProject).mockImplementation(async () => {
      readOnly = true;
    });
    const readProject = async () => ({ readOnly });
    function ProjectPage() {
      const project = useQuery({ queryKey: detailKey, queryFn: readProject });
      return project.data && !project.data.readOnly ? (
        <DeleteProjectButton
          teamKey="TEAM"
          projectKey="PROJECT"
          projectName="Project"
        />
      ) : (
        <p>Read-only project</p>
      );
    }
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/teams/TEAM/projects/PROJECT"]}>
          <Routes>
            <Route
              path="/teams/TEAM/projects/PROJECT"
              element={<ProjectPage />}
            />
            <Route path="/teams/TEAM/projects" element={<h1>Projects</h1>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Archive project" }),
    );
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(
      await screen.findByRole("heading", { name: "Projects" }),
    ).toBeVisible();
    expect(deleteProject).toHaveBeenCalledExactlyOnceWith("TEAM", "PROJECT");
    client.clear();
  });

  it("keeps the current page when an archive succeeds after leaving the project", async () => {
    let finish!: () => void;
    vi.mocked(deleteProject).mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const client = new QueryClient();
    const archived = vi.fn();
    const view = render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/teams/TEAM/projects/PROJECT"]}>
          <DeleteProjectButton
            teamKey="TEAM"
            projectKey="PROJECT"
            projectName="Project"
            onProjectDeleted={archived}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Archive project" }));
    await user.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(deleteProject).toHaveBeenCalledOnce());
    view.rerender(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Link to="/my-work">My Work</Link>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await act(async () => finish());
    expect(archived).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "My Work" })).toBeVisible();
    client.clear();
  });

  it("keeps pending confirmation open while waiting for the server", async () => {
    let finish!: () => void;
    vi.mocked(deleteTeam).mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DeleteTeam teamKey="TEAM" teamName="Team" />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Archive team" }));
    await user.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled(),
    );
    await user.keyboard("[Escape]");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await act(async () => finish());
    client.clear();
  });
});
