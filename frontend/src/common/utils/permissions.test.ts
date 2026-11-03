import { describe, expect, it } from "vitest";
import { getTeamPermissions } from "../../features/teams/utils/teamPermissions";
import { getProjectPermissions } from "../../features/projects/utils/projectPermissions";
import { getTaskPermissions } from "../../features/tasks/utils/taskPermissions";

describe("global viewing and team-scoped editing", () => {
  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "allows global %s to create teams",
    (globalRole) => {
      expect(getTeamPermissions({ globalRole }).canCreateTeam).toBe(true);
    },
  );

  it("does not grant team creation to an ordinary owner or member", () => {
    expect(
      getTeamPermissions({ globalRole: "USER", teamRole: "OWNER" })
        .canCreateTeam,
    ).toBe(false);
    expect(
      getTeamPermissions({ globalRole: "USER", teamRole: "MEMBER" })
        .canCreateTeam,
    ).toBe(false);
  });

  it("allows an owner without a global admin role to govern their team", () => {
    const permissions = getTeamPermissions({
      globalRole: "USER",
      teamRole: "OWNER",
    });
    expect(permissions.canEditTeamDetails).toBe(true);
    expect(permissions.canDeleteTeam).toBe(true);
    expect(permissions.canTransferOwnership).toBe(true);
    expect(permissions.canChangeRole).toBe(true);
  });

  it("limits team admins to regular membership and project/task management", () => {
    const permissions = getTeamPermissions({
      globalRole: "USER",
      teamRole: "ADMIN",
    });
    expect(permissions.canAddMember).toBe(true);
    expect(permissions.canRemoveMember).toBe(true);
    expect(permissions.canCreateProject).toBe(true);
    expect(permissions.canCreateTask).toBe(true);
    expect(permissions.canEditTeamDetails).toBe(false);
    expect(permissions.canDeleteTeam).toBe(false);
    expect(permissions.canTransferOwnership).toBe(false);
    expect(permissions.canChangeRole).toBe(false);
  });

  it("keeps a global admin outside the team read-only", () => {
    const team = getTeamPermissions({ globalRole: "ADMIN", teamRole: null });
    expect(team.canAccessTeam).toBe(true);
    expect(team.canViewDeleteTeam).toBe(true);
    expect(team.canEditTeamDetails).toBe(false);
    expect(team.canDeleteTeam).toBe(false);
    expect(team.canTransferOwnership).toBe(false);
    expect(team.canChangeRole).toBe(false);
    expect(team.canAddMember).toBe(false);
    expect(team.canRemoveMember).toBe(false);
  });

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "does not grant project/task editing to nonmember %s",
    (globalRole) => {
      const project = getProjectPermissions({ globalRole, teamRole: null });
      expect(project.canManageProject).toBe(true);
      expect(project.canViewDeleteProject).toBe(true);
      expect(project.canChangeProjectStatus).toBe(false);
      expect(project.canEditProjectDetails).toBe(false);
      expect(project.canCreateTask).toBe(false);
      const task = getTaskPermissions({ globalRole, teamRole: null });
      expect(task.canViewDeleteTask).toBe(true);
      expect(task.canEditTaskDetails).toBe(false);
      expect(task.canChangeStatus).toBe(false);
      expect(task.canComment).toBe(false);
    },
  );

  it("limits a nonmember super admin to ownership and admin-role recovery", () => {
    const team = getTeamPermissions({
      globalRole: "SUPER_ADMIN",
      teamRole: null,
    });
    expect(team.canTransferOwnership).toBe(true);
    expect(team.canChangeRole).toBe(true);
    expect(team.canEditTeamDetails).toBe(false);
    expect(team.canDeleteTeam).toBe(false);
    expect(team.canAddMember).toBe(false);
    expect(team.canRemoveMember).toBe(false);
    expect(team.canCreateProject).toBe(false);
    expect(team.canCreateTask).toBe(false);
  });

  it("does not recover ownership or roles on an archived team", () => {
    const team = getTeamPermissions({
      globalRole: "SUPER_ADMIN",
      teamRole: null,
      isReadOnly: true,
    });
    expect(team.canTransferOwnership).toBe(false);
    expect(team.canChangeRole).toBe(false);
  });

  it("does not confuse absent user IDs with an assignment", () => {
    const task = getTaskPermissions({ globalRole: "USER", teamRole: "MEMBER" });
    expect(task.canChangeStatus).toBe(false);
    expect(task.canComment).toBe(false);
  });

  it("requires current membership even when an assignment ID matches", () => {
    const task = getTaskPermissions({
      globalRole: "ADMIN",
      teamRole: null,
      userId: "former-member",
      assigneeId: "former-member",
    });
    expect(task.canChangeStatus).toBe(false);
    expect(task.canComment).toBe(false);
  });

  it.each(["OWNER", "ADMIN"] as const)(
    "allows team %s to manage project/task work",
    (teamRole) => {
      expect(
        getProjectPermissions({ globalRole: "USER", teamRole })
          .canChangeProjectStatus,
      ).toBe(true);
      expect(
        getTaskPermissions({ globalRole: "USER", teamRole }).canEditTaskDetails,
      ).toBe(true);
    },
  );

  it.each(["assigneeId", "supportId"] as const)(
    "allows a member's %s participation without granting manager edits",
    (assignment) => {
      const permissions = getTaskPermissions({
        globalRole: "USER",
        teamRole: "MEMBER",
        userId: "member-1",
        [assignment]: "member-1",
      });
      expect(permissions.canChangeStatus).toBe(true);
      expect(permissions.canComment).toBe(true);
      expect(permissions.canEditTaskDetails).toBe(false);
      expect(permissions.canAssign).toBe(false);
    },
  );

  it("keeps archived teams read-only for owners and team admins", () => {
    for (const teamRole of ["OWNER", "ADMIN"] as const) {
      const team = getTeamPermissions({
        globalRole: "USER",
        teamRole,
        isReadOnly: true,
      });
      expect(team.canEditTeamDetails).toBe(false);
      expect(team.canDeleteTeam).toBe(false);
      expect(team.canChangeRole).toBe(false);
      expect(team.canTransferOwnership).toBe(false);
      expect(
        getProjectPermissions({
          globalRole: "USER",
          teamRole,
          isReadOnly: true,
        }).canChangeProjectStatus,
      ).toBe(false);
      expect(
        getTaskPermissions({ globalRole: "USER", teamRole, isReadOnly: true })
          .canComment,
      ).toBe(false);
    }
  });
});
