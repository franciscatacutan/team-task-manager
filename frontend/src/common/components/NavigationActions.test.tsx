import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";
import TeamCard from "@/features/teams/components/TeamCard";
import ProjectCard from "@/features/projects/components/ProjectCard";
import TeamsList from "@/features/teams/components/TeamsList";
import ProjectsList from "@/features/projects/components/ProjectsList";
import TaskList from "@/features/tasks/components/TaskList";
import TeamOverviewCard from "@/features/teams/components/TeamOverviewCard";
import { SortHeader } from "./toolbar/SortHeader";
import type { Team } from "@/features/teams/types/team.type";
import type { Project } from "@/features/projects/types/project.types";
import type { Task } from "@/features/tasks/types/task.types";
const owner = {
  firstName: "Test",
  lastName: "Owner",
  email: "owner@example.test",
  id: "owner",
};
const team = {
  key: "TEAM",
  name: "Team name",
  owner,
  createdAt: "2026-11-04",
  lastActivityAt: "2026-11-04",
} as Team;
const project = {
  key: "PROJECT",
  name: "Project name",
  createdBy: owner,
  status: "ACTIVE",
  createdAt: "2026-11-04",
  lastActivityAt: "2026-11-04",
} as Project;
const task = {
  taskNumber: 7,
  name: "Task name",
  status: "TODO",
  priority: "MEDIUM",
  createdAt: "2026-11-04",
  lastActivityAt: "2026-11-04",
} as Task;
const common = {
  isLoading: false,
  onCreateProject: vi.fn(),
  canCreateProject: false,
  canCreateTask: false,
  onClearFilters: vi.fn(),
  hasActiveFilters: false,
  sortField: "createdAt" as const,
  sortOrder: "desc" as const,
  onSort: vi.fn(),
};
function Location() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}
describe("native route actions", () => {
  it.each([
    "team-card",
    "team-list",
    "project-card",
    "project-list",
    "task-list",
    "overview",
  ])("opens %s with Enter and exposes a real href", async (kind) => {
    const callback = vi.fn();
    const node =
      kind === "team-card" ? (
        <TeamCard team={team} />
      ) : kind === "team-list" ? (
        <TeamsList {...common} teams={[team]} openTeam={callback} />
      ) : kind === "project-card" ? (
        <ProjectCard project={project} teamKey="TEAM" />
      ) : kind === "project-list" ? (
        <ProjectsList
          {...common}
          projects={[project]}
          teamKey="TEAM"
          openProject={callback}
        />
      ) : kind === "task-list" ? (
        <TaskList
          {...common}
          tasks={[task]}
          teamKey="TEAM"
          projectKey="PROJECT"
          onCreateTask={vi.fn()}
        />
      ) : (
        <TeamOverviewCard
          title="Overview projects"
          description="Projects"
          to="/teams/TEAM/projects"
        />
      );
    render(
      <MemoryRouter>
        {node}
        <Location />
      </MemoryRouter>,
    );
    const name = kind.startsWith("team")
      ? "Team name"
      : kind.startsWith("project")
        ? "Project name"
        : kind === "task-list"
          ? "Task name"
          : "Overview projects";
    const link = screen.getByRole("link", { name: new RegExp(name) });
    const href = kind.startsWith("team")
      ? "/teams/TEAM"
      : kind.startsWith("project")
        ? "/teams/TEAM/projects/PROJECT"
        : kind === "task-list"
          ? "/teams/TEAM/projects/PROJECT/tasks/7"
          : "/teams/TEAM/projects";
    expect(link).toHaveAttribute("href", href);
    link.focus();
    await userEvent.keyboard("[Enter]");
    expect(screen.getByTestId("path")).toHaveTextContent(href);
    expect(callback).not.toHaveBeenCalled();
  });
  it.each(["team", "project"])(
    "preserves supplemental %s row clicks without double navigation from its link",
    async (kind) => {
      const callback = vi.fn();
      render(
        <MemoryRouter>
          {kind === "team" ? (
            <TeamsList {...common} teams={[team]} openTeam={callback} />
          ) : (
            <ProjectsList
              {...common}
              projects={[project]}
              teamKey="TEAM"
              openProject={callback}
            />
          )}
        </MemoryRouter>,
      );
      const row = screen.getAllByRole("row")[1];
      await userEvent.click(row);
      expect(callback).toHaveBeenCalledOnce();
      await userEvent.click(screen.getByRole("link"));
      expect(callback).toHaveBeenCalledOnce();
    },
  );
});
it("sorts with both Enter and Space and exposes the confirmed sort direction", async () => {
  const sort = vi.fn();
  const tree = (order: "asc" | "desc") => (
    <table>
      <thead>
        <tr>
          <SortHeader
            label="Name"
            field="name"
            sortField="name"
            order={order}
            onSort={sort}
          />
        </tr>
      </thead>
    </table>
  );
  const { rerender } = render(tree("asc"));
  const user = userEvent.setup();
  await user.tab();
  expect(screen.getByRole("button", { name: "Sort by Name" })).toHaveFocus();
  await user.keyboard("[Enter][Space]");
  expect(sort).toHaveBeenCalledTimes(2);
  expect(sort).toHaveBeenCalledWith("name");
  expect(screen.getByRole("columnheader")).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  rerender(tree("desc"));
  expect(screen.getByRole("columnheader")).toHaveAttribute(
    "aria-sort",
    "descending",
  );
});
