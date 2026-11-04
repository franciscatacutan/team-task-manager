import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
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
