import type { PropsWithChildren } from "react";
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys as keys } from "./queryKeys";
import { setConfirmedData } from "./queryCache";
import { authStorage } from "@/features/auth/utils/authStorage";
import { useUpdateUserProfile } from "@/features/users/hooks/useUpdateUserProfile";
import { useUpdateUserRole } from "@/features/users/hooks/useUpdateUserRole";
import { useUser } from "@/features/users/hooks/useUser";
import { useUsers } from "@/features/users/hooks/useUsers";
import * as users from "@/features/users/api/userApi";
import type { User } from "@/features/users/types/userType";
import { useUpdateTask } from "@/features/tasks/hooks/useUpdateTask";
import { useUpdateTaskStatus } from "@/features/tasks/hooks/useUpdateTaskStatus";
import { useAssignUser } from "@/features/tasks/hooks/useAssignUser";
import { useAssignSupportUser } from "@/features/tasks/hooks/useAssignSupportUser";
import { useCreateTaskComment } from "@/features/tasks/hooks/useCreateTaskComment";
import { useCreateTask } from "@/features/tasks/hooks/useCreateTask";
import { useDeleteTask } from "@/features/tasks/hooks/useDeleteTask";
import { useTask } from "@/features/tasks/hooks/useTask";
import { useTasks } from "@/features/tasks/hooks/useTasks";
import { useInfiniteTasks } from "@/features/tasks/hooks/useInfiniteTasks";
import * as tasks from "@/features/tasks/api/taskApi";
import type { Task } from "@/features/tasks/types/task.types";
import type { CreateTaskInput } from "@/features/tasks/types/createTaskSchema";
import { useProjectActivity } from "@/features/projects/hooks/useProjectActivities";
import { useProjectInsights } from "@/features/projects/hooks/useProjectInsights";
import { useProject } from "@/features/projects/hooks/useProject";
import { useUpdateProject } from "@/features/projects/hooks/useUpdateProject";
import { useDeleteProject } from "@/features/projects/hooks/useDeleteProject";
import * as projects from "@/features/projects/api/projectApi";
import type { Project } from "@/features/projects/types/project.types";
import { useTeamMembers } from "@/features/teams/hooks/useTeamMembers";
import { useTeamMe } from "@/features/teams/hooks/useTeamMe";
import { useUpdateMemberRole } from "@/features/teams/hooks/useUpdateMemberRole";
import { useTransferOwnership } from "@/features/teams/hooks/useTransferOwnership";
import { useDeleteTeam } from "@/features/teams/hooks/UseDeleteTeam";
import * as teams from "@/features/teams/api/teamApi";
import * as members from "@/features/teams/api/teamMemberApi";
import type { Team, TeamMember } from "@/features/teams/types/team.type";
import { useLogin } from "@/features/auth/hooks/useLogin";
import { useRegister } from "@/features/auth/hooks/useRegister";
import * as auth from "@/features/auth/api/auth.api";
import AppBreadcrumbs from "@/common/components/AppBreadcrumbs";

vi.mock("@/features/users/api/userApi", () => ({
  getUser: vi.fn(),
  getUsers: vi.fn(),
  updateUserProfile: vi.fn(),
  updateUserRole: vi.fn(),
}));
vi.mock("@/features/tasks/api/taskApi", () => ({
  getTask: vi.fn(),
  getTasks: vi.fn(),
  updateTask: vi.fn(),
  updateTaskStatus: vi.fn(),
  assignUser: vi.fn(),
  assignSupportUser: vi.fn(),
  createTaskComment: vi.fn(),
  createTask: vi.fn(),
  deleteTask: vi.fn(),
}));
vi.mock("@/features/projects/api/projectApi", () => ({
  getProject: vi.fn(),
  getProjectActivities: vi.fn(),
  getProjectInsights: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
}));
vi.mock("@/features/teams/api/teamApi", () => ({
  getTeam: vi.fn(),
  getTeamMe: vi.fn(),
  transferTeam: vi.fn(),
  deleteTeam: vi.fn(),
}));
vi.mock("@/features/teams/api/teamMemberApi", () => ({
  getTeamMembers: vi.fn(),
  updateMemberRole: vi.fn(),
}));
vi.mock("@/features/auth/api/auth.api", () => ({
  login: vi.fn(),
  register: vi.fn(),
}));

const original: User = {
  id: "person",
  firstName: "Old",
  lastName: "Name",
  email: "person@example.test",
  role: "USER",
};
const updated: User = {
  ...original,
  firstName: "Server",
  lastName: "Confirmed",
};
const initialTask = {
  taskNumber: 7,
  name: "Old task",
  status: "TODO",
  priority: "LOW",
  assignedUser: original,
  supportUser: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  lastActivityAt: null,
} satisfies Task;
const confirmedTask: Task = {
  ...initialTask,
  name: "Server task",
  priority: "CRITICAL",
  status: "IN_PROGRESS",
  assignedUser: updated,
  supportUser: null,
};
const project: Project = {
  key: "PROJECT",
  teamKey: "TEAM",
  name: "Old project",
  status: "ACTIVE",
  createdBy: original,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  lastActivityAt: "2026-01-01",
};
const changedProject = { ...project, name: "Server project" };
const filters = { page: 0, size: 10, deletedFilter: "ACTIVE" as const };
const historyFilters = { page: 0, size: 10 };
const page = <T,>(content: T[]) => ({
  content,
  page: 0,
  size: 10,
  totalElements: content.length,
  totalPages: 1,
  first: true,
  last: true,
});
const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  clients.push(client);
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.resetAllMocks();
  authStorage.endLogout();
  authStorage.setToken("test-session");
});
afterEach(async () => {
  onlineManager.setOnline(true);
  for (const client of clients.splice(0)) {
    await client.cancelQueries();
    client.clear();
  }
  vi.restoreAllMocks();
  authStorage.clearToken();
  authStorage.endLogout();
});

describe("profile cache consistency", () => {
  it("updates actual profile/list/member observers from the server and preserves another current user", async () => {
    const { client, wrapper } = setup();
    const admin = { ...original, id: "admin", role: "ADMIN" as const };
    client.setQueryData(keys.session.current, admin);
    client.setQueryData(keys.users.detail(original.id), original);
    client.setQueryData(keys.users.list(filters), page([original]));
    client.setQueryData(
      keys.teams.memberList("TEAM", historyFilters),
      page([{ ...original, teamRole: "MEMBER", globalRole: "USER" }]),
    );
    vi.mocked(users.updateUserProfile).mockResolvedValue(updated);
    vi.mocked(users.getUser).mockResolvedValue(updated);
    vi.mocked(users.getUsers).mockResolvedValue(page([updated]));
    vi.mocked(members.getTeamMembers).mockResolvedValue(
      page([
        {
          ...updated,
          teamRole: "MEMBER",
          globalRole: "USER",
          joinedAt: "2026-01-01",
        },
      ]),
    );
    const { result } = renderHook(
      () => ({
        save: useUpdateUserProfile(original.id),
        profile: useUser(original.id),
        list: useUsers(filters),
        members: useTeamMembers("TEAM", historyFilters),
      }),
      { wrapper },
    );
    await act(async () => {
      await result.current.save.mutateAsync({ firstName: "Untrusted draft" });
    });
    await waitFor(() => expect(result.current.profile.data).toEqual(updated));
    expect(result.current.list.data?.content[0]).toEqual(updated);
    expect(result.current.members.data?.content[0].firstName).toBe("Server");
    expect(client.getQueryData(keys.session.current)).toEqual(admin);
    expect(client.getQueryState(keys.session.current)?.isInvalidated).toBe(
      false,
    );
    expect(users.getUser).toHaveBeenCalledWith(original.id);
  });
  it("updates the matching current-user summary with the confirmed response", async () => {
    const { client, wrapper } = setup();
    client.setQueryData(keys.session.current, original);
    vi.mocked(users.updateUserProfile).mockResolvedValue(updated);
    const { result } = renderHook(() => useUpdateUserProfile(original.id), {
      wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync({ firstName: "Draft" });
    });
    expect(client.getQueryData(keys.session.current)).toEqual(updated);
    expect(client.getQueryState(keys.session.current)?.isInvalidated).toBe(
      true,
    );
  });
  it("refetches committed profile state after a later request in the existing edit sequence fails", async () => {
    const { client, wrapper } = setup();
    client.setQueryData(keys.users.detail(original.id), original);
    vi.mocked(users.updateUserProfile).mockRejectedValue(
      new Error("Email conflict after name save"),
    );
    vi.mocked(users.getUser).mockResolvedValue(updated);
    const { result } = renderHook(
      () => ({
        save: useUpdateUserProfile(original.id),
        profile: useUser(original.id),
      }),
      { wrapper },
    );
    await act(async () => {
      await expect(
        result.current.save.mutateAsync({
          firstName: "Server",
          email: "taken@example.test",
        }),
      ).rejects.toThrow("Email conflict");
    });
    await waitFor(() => expect(result.current.profile.data).toEqual(updated));
    expect(result.current.save.isError).toBe(true);
  });
  it("does not invent a role change while the server request is pending", async () => {
    const { client, wrapper } = setup();
    client.setQueryData(keys.users.detail(original.id), original);
    const response = deferred<void>();
    vi.mocked(users.updateUserRole).mockReturnValue(response.promise);
    const promoted = { ...original, role: "ADMIN" as const };
    vi.mocked(users.getUser).mockResolvedValue(promoted);
    const { result } = renderHook(
      () => ({
        save: useUpdateUserRole(original.id),
        profile: useUser(original.id),
      }),
      { wrapper },
    );
    let saving!: Promise<void>;
    act(() => {
      saving = result.current.save.mutateAsync("ADMIN");
    });
    await waitFor(() => expect(users.updateUserRole).toHaveBeenCalledOnce());
    expect(result.current.profile.data?.role).toBe("USER");
    await act(async () => {
      response.resolve();
      await saving;
    });
    await waitFor(() =>
      expect(result.current.profile.data?.role).toBe("ADMIN"),
    );
  });
});

describe("task/project observers", () => {
  it.each(["details", "status", "assignee", "support"])(
    "refreshes list, both board columns, project history and insights after %s changes",
    async (operation) => {
      const { client, wrapper } = setup();
      let current: Task = initialTask;
      vi.mocked(tasks.getTask).mockImplementation(async () => current);
      vi.mocked(tasks.getTasks).mockImplementation(
        async (_team, _project, params) =>
          page(
            !params.status || params.status.includes(current.status)
              ? [current]
              : [],
          ),
      );
      vi.mocked(projects.getProjectActivities).mockResolvedValue(page([]));
      vi.mocked(projects.getProjectInsights).mockResolvedValue({
        teamKey: "TEAM",
        projectKey: "PROJECT",
        status: "ACTIVE",
        generatedAt: "2026-01-01",
        tasks: {
          total: 1,
          todo: 1,
          inProgress: 0,
          inReview: 0,
          onHold: 0,
          done: 0,
          cancelled: 0,
          overdue: 0,
          highPriority: 0,
          criticalPriority: 0,
        },
        flow: {
          completedLast7Days: 0,
          completionRatePercent: 0,
          averageCycleTimeHours: 0,
        },
        activity: {
          activityEventsLast7Days: 0,
          auditEventsLast7Days: 0,
          systemEventsLast7Days: 0,
        },
        health: { overdue: false, daysUntilDue: 1, completedOnTime: false },
      });
      const save = async () => {
        current = confirmedTask;
        return current;
      };
      vi.mocked(tasks.updateTask).mockImplementation(save);
      vi.mocked(tasks.updateTaskStatus).mockImplementation(save);
      vi.mocked(tasks.assignUser).mockImplementation(save);
      vi.mocked(tasks.assignSupportUser).mockImplementation(save);
      const untouched = keys.tasks.list("OTHER", "PROJECT", filters);
      client.setQueryData(untouched, page([]));
      const { result } = renderHook(
        () => ({
          details: useUpdateTask("TEAM", "PROJECT", 7),
          status: useUpdateTaskStatus("TEAM", "PROJECT"),
          assignee: useAssignUser("TEAM", "PROJECT", 7),
          support: useAssignSupportUser("TEAM", "PROJECT", 7),
          task: useTask("TEAM", "PROJECT", 7),
          list: useTasks("TEAM", "PROJECT", filters),
          todo: useInfiniteTasks("TEAM", "PROJECT", "TODO", filters),
          progress: useInfiniteTasks("TEAM", "PROJECT", "IN_PROGRESS", filters),
          history: useProjectActivity("TEAM", "PROJECT", historyFilters),
          insights: useProjectInsights("TEAM", "PROJECT"),
        }),
        { wrapper },
      );
      await waitFor(() =>
        expect(result.current.list.data?.content[0].name).toBe("Old task"),
      );
      await act(async () => {
        if (operation === "details")
          await result.current.details.mutateAsync({ priority: "CRITICAL" });
        if (operation === "status")
          await result.current.status.mutateAsync({
            taskNumber: 7,
            status: "IN_PROGRESS",
          });
        if (operation === "assignee")
          await result.current.assignee.mutateAsync("person");
        if (operation === "support")
          await result.current.support.mutateAsync(null);
      });
      await waitFor(() =>
        expect(result.current.task.data).toEqual(confirmedTask),
      );
      expect(result.current.list.data?.content[0]).toEqual(confirmedTask);
      expect(result.current.todo.data?.pages[0].content).toEqual([]);
      expect(result.current.progress.data?.pages[0].content).toEqual([
        confirmedTask,
      ]);
      expect(projects.getProjectActivities).toHaveBeenCalledTimes(2);
      expect(projects.getProjectInsights).toHaveBeenCalledTimes(2);
      expect(client.getQueryState(untouched)?.isInvalidated).toBe(false);
      expect(
        client.getQueryData(["projectActivity", "TEAM", "PROJECT"]),
      ).toBeUndefined();
    },
  );
  it.each(["comment", "create"])(
    "refreshes the mounted project history after %s",
    async (operation) => {
      const { wrapper } = setup();
      vi.mocked(projects.getProjectActivities).mockResolvedValue(page([]));
      vi.mocked(tasks.createTaskComment).mockResolvedValue({
        id: "activity",
      } as Awaited<ReturnType<typeof tasks.createTaskComment>>);
      vi.mocked(tasks.createTask).mockResolvedValue(confirmedTask);
      const { result } = renderHook(
        () => ({
          comment: useCreateTaskComment("TEAM", "PROJECT", 7),
          create: useCreateTask("TEAM", "PROJECT"),
          history: useProjectActivity("TEAM", "PROJECT", historyFilters),
        }),
        { wrapper },
      );
      await waitFor(() => expect(result.current.history.isSuccess).toBe(true));
      await act(async () => {
        if (operation === "comment")
          await result.current.comment.mutateAsync("Hello");
        else
          await result.current.create.mutateAsync({
            name: "New",
          } as CreateTaskInput);
      });
      expect(projects.getProjectActivities).toHaveBeenCalledTimes(2);
    },
  );
  it("keeps a save pending until mounted views refresh", async () => {
    const { client, wrapper } = setup();
    const refresh = deferred<Project>();
    client.setQueryData(keys.projects.detail("TEAM", "PROJECT"), project);
    vi.mocked(projects.updateProject).mockResolvedValue(changedProject);
    vi.mocked(projects.getProject).mockReturnValue(refresh.promise);
    const { result } = renderHook(
      () => ({
        save: useUpdateProject("TEAM", "PROJECT"),
        detail: useProject("TEAM", "PROJECT"),
      }),
      { wrapper },
    );
    let saving!: Promise<Project>;
    act(() => {
      saving = result.current.save.mutateAsync({ name: "Draft" });
    });
    await waitFor(() => expect(projects.getProject).toHaveBeenCalledOnce());
    expect(result.current.save.isPending).toBe(true);
    expect(result.current.detail.data?.name).toBe("Server project");
    await act(async () => {
      refresh.resolve(changedProject);
      await saving;
    });
    await waitFor(() => expect(result.current.save.isSuccess).toBe(true));
  });
  it("does not misreport a committed write as failed if its refresh fails", async () => {
    const { client, wrapper } = setup();
    client.setQueryData(keys.projects.detail("TEAM", "PROJECT"), project);
    vi.mocked(projects.updateProject).mockResolvedValue(changedProject);
    vi.mocked(projects.getProject).mockRejectedValue(new Error("Read offline"));
    const { result } = renderHook(
      () => ({
        save: useUpdateProject("TEAM", "PROJECT"),
        detail: useProject("TEAM", "PROJECT"),
      }),
      { wrapper },
    );
    await act(async () => {
      await expect(
        result.current.save.mutateAsync({ name: "Draft" }),
      ).resolves.toEqual(changedProject);
    });
    await waitFor(() => expect(result.current.save.isSuccess).toBe(true));
    expect(result.current.detail.isError).toBe(true);
    expect(result.current.detail.data).toEqual(changedProject);
    expect(projects.updateProject).toHaveBeenCalledOnce();
  });
  it("cancels an older detail read so its late result cannot overwrite the saved response", async () => {
    const { client, wrapper } = setup();
    const oldRead = deferred<Task>();
    const key = keys.tasks.detail("TEAM", "PROJECT", 7);
    client.setQueryData(key, initialTask);
    const reading = client
      .fetchQuery({
        queryKey: key,
        queryFn: () => oldRead.promise,
        staleTime: 0,
      })
      .catch(() => undefined);
    vi.mocked(tasks.updateTask).mockResolvedValue(confirmedTask);
    const { result } = renderHook(() => useUpdateTask("TEAM", "PROJECT", 7), {
      wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync({ name: "Draft" });
      oldRead.resolve(initialTask);
      await reading;
    });
    expect(client.getQueryData(key)).toEqual(confirmedTask);
  });
});

describe("permission and archive refresh scopes", () => {
  it.each(["role", "ownership"])(
    "refetches current team permissions after %s changes without inventing privileges",
    async (operation) => {
      const { client, wrapper } = setup();
      client.setQueryData(keys.teams.me("TEAM"), {
        userId: "owner",
        role: "OWNER",
      });
      const response = deferred<TeamMember>();
      vi.mocked(teams.transferTeam).mockReturnValue(response.promise);
      vi.mocked(members.updateMemberRole).mockReturnValue(response.promise);
      vi.mocked(teams.getTeamMe).mockResolvedValue({
        userId: "owner",
        role: "ADMIN",
      });
      const { result } = renderHook(
        () => ({
          role: useUpdateMemberRole("TEAM"),
          ownership: useTransferOwnership("TEAM"),
          me: useTeamMe("TEAM"),
        }),
        { wrapper },
      );
      let saving!: Promise<TeamMember>;
      act(() => {
        saving =
          operation === "role"
            ? result.current.role.mutateAsync({
                memberId: "person",
                role: "ADMIN",
              })
            : result.current.ownership.mutateAsync("person");
      });
      await waitFor(() =>
        expect(
          operation === "role" ? members.updateMemberRole : teams.transferTeam,
        ).toHaveBeenCalledOnce(),
      );
      expect(result.current.me.data?.role).toBe("OWNER");
      await act(async () => {
        response.resolve({
          ...original,
          teamRole: "OWNER",
          globalRole: "USER",
          joinedAt: "2026-01-01",
        });
        await saving;
      });
      await waitFor(() => expect(result.current.me.data?.role).toBe("ADMIN"));
      expect(teams.getTeamMe).toHaveBeenCalledOnce();
    },
  );
  it.each(["task", "project", "team"])(
    "refreshes descendants after %s archiving without invalidating another workspace",
    async (level) => {
      const { client, wrapper } = setup();
      const affected = [
        keys.tasks.list("TEAM", "PROJECT", filters),
        keys.tasks.board("TEAM", "PROJECT", "TODO", filters),
        keys.tasks.detail("TEAM", "PROJECT", 7),
        keys.tasks.activity("TEAM", "PROJECT", 7, historyFilters),
        keys.projects.activity("TEAM", "PROJECT", historyFilters),
      ];
      const other = [
        keys.tasks.list("OTHER", "PROJECT", filters),
        keys.tasks.board("OTHER", "PROJECT", "TODO", filters),
        keys.tasks.detail("OTHER", "PROJECT", 7),
        keys.projects.detail("OTHER", "PROJECT"),
        keys.projects.activity("OTHER", "PROJECT", historyFilters),
      ];
      [...affected, ...other].forEach((key) => client.setQueryData(key, {}));
      vi.mocked(tasks.deleteTask).mockResolvedValue();
      vi.mocked(projects.deleteProject).mockResolvedValue(undefined);
      vi.mocked(teams.deleteTeam).mockResolvedValue();
      const { result } = renderHook(
        () => ({
          task: useDeleteTask("TEAM", "PROJECT"),
          project: useDeleteProject("TEAM"),
          team: useDeleteTeam(),
        }),
        { wrapper },
      );
      await act(async () => {
        if (level === "task") await result.current.task.mutateAsync(7);
        if (level === "project")
          await result.current.project.mutateAsync("PROJECT");
        if (level === "team") await result.current.team.mutateAsync("TEAM");
      });
      for (const key of affected)
        expect(
          client.getQueryState(key)?.isInvalidated,
          JSON.stringify(key),
        ).toBe(true);
      for (const key of other)
        expect(
          client.getQueryState(key)?.isInvalidated,
          JSON.stringify(key),
        ).toBe(false);
    },
  );
});

describe("cache races and workspace identity", () => {
  it.each(["success", "failure"])(
    "ignores late mutation cache callbacks after a different login (%s)",
    async (outcome) => {
      const { client, wrapper } = setup();
      const response = deferred<Task>();
      vi.mocked(tasks.updateTask).mockReturnValue(response.promise);
      const invalidate = vi.spyOn(client, "invalidateQueries");
      const { result } = renderHook(() => useUpdateTask("TEAM", "PROJECT", 7), {
        wrapper,
      });
      let saving!: Promise<Task | undefined>;
      act(() => {
        saving = result.current
          .mutateAsync({ name: "Draft" })
          .catch(() => undefined);
      });
      await waitFor(() => expect(tasks.updateTask).toHaveBeenCalledOnce());
      authStorage.setToken("new-login");
      client.clear();
      client.setQueryData(keys.session.current, {
        ...original,
        id: "different-user",
      });
      await act(async () => {
        if (outcome === "success") response.resolve(confirmedTask);
        else response.reject(new Error("Late offline response"));
        await saving;
      });
      expect(
        client.getQueryData(keys.tasks.detail("TEAM", "PROJECT", 7)),
      ).toBeUndefined();
      expect(invalidate).not.toHaveBeenCalled();
      expect(client.getQueryData<User>(keys.session.current)?.id).toBe(
        "different-user",
      );
    },
  );
  it("also fences a confirmed response if the login changes during cancellation", async () => {
    const { client } = setup();
    const cancellation = deferred<void>();
    vi.spyOn(client, "cancelQueries").mockReturnValueOnce(cancellation.promise);
    const writing = setConfirmedData(
      client,
      keys.users.detail(original.id),
      updated,
    );
    authStorage.clearToken();
    cancellation.resolve();
    await writing;
    expect(client.getQueryData(keys.users.detail(original.id))).toBeUndefined();
  });
  it.each(["login", "register"])(
    "clears a previous account's cache on confirmed %s",
    async (operation) => {
      const { client, wrapper } = setup();
      client.setQueryData(keys.tasks.detail("TEAM", "PROJECT", 7), initialTask);
      const response = {
        token: "new-token",
        expiresInSeconds: 900,
        user: {
          userId: "new-user",
          firstName: "New",
          lastName: "User",
          email: "new@example.test",
          role: "USER" as const,
        },
      };
      vi.mocked(auth.login).mockResolvedValue(response);
      vi.mocked(auth.register).mockResolvedValue(response);
      const { result } = renderHook(
        () => ({ login: useLogin(), register: useRegister() }),
        { wrapper },
      );
      await act(async () => {
        if (operation === "login")
          await result.current.login.mutateAsync({
            email: "new@example.test",
            password: "Password1!",
          });
        else
          await result.current.register.mutateAsync({
            firstName: "New",
            lastName: "User",
            email: "new@example.test",
            password: "Password1!",
          });
      });
      expect(
        client.getQueryData(keys.tasks.detail("TEAM", "PROJECT", 7)),
      ).toBeUndefined();
      expect(client.getQueryData<User>(keys.session.current)?.id).toBe(
        "new-user",
      );
    },
  );
  it("keeps page placeholders within a project and removes them when the workspace changes", async () => {
    const { client, wrapper } = setup();
    const never = deferred<ReturnType<typeof page<Task>>>();
    vi.mocked(tasks.getTasks).mockReturnValue(never.promise);
    client.setQueryData(
      keys.tasks.list("TEAM", "PROJECT", filters),
      page([initialTask]),
    );
    const { result, rerender } = renderHook(
      ({ teamKey, projectKey, pageNumber }) =>
        useTasks(teamKey, projectKey, { ...filters, page: pageNumber }),
      {
        wrapper,
        initialProps: { teamKey: "TEAM", projectKey: "PROJECT", pageNumber: 0 },
      },
    );
    expect(result.current.data?.content[0]).toEqual(initialTask);
    rerender({ teamKey: "TEAM", projectKey: "PROJECT", pageNumber: 1 });
    expect(result.current.isPlaceholderData).toBe(true);
    rerender({ teamKey: "OTHER", projectKey: "PROJECT", pageNumber: 0 });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPlaceholderData).toBe(false);
  });
  it("shares one numeric task cache entry between the breadcrumb and detail screen", async () => {
    const { client, wrapper: Wrapper } = setup();
    vi.mocked(teams.getTeam).mockResolvedValue({
      key: "TEAM",
      name: "Team",
    } as Team);
    vi.mocked(projects.getProject).mockResolvedValue(project);
    vi.mocked(tasks.getTask).mockResolvedValue(initialTask);
    function Detail() {
      const { data } = useTask("TEAM", "PROJECT", 7);
      return <p>Detail: {data?.name}</p>;
    }
    render(
      <Wrapper>
        <MemoryRouter initialEntries={["/teams/TEAM/projects/PROJECT/tasks/7"]}>
          <Routes>
            <Route
              path="/teams/:teamKey/projects/:projectKey/tasks/:taskNumber"
              element={
                <>
                  <AppBreadcrumbs />
                  <Detail />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </Wrapper>,
    );
    await screen.findByText("Detail: Old task");
    expect(tasks.getTask).toHaveBeenCalledOnce();
    expect(
      client.getQueryData(keys.tasks.detail("TEAM", "PROJECT", 7)),
    ).toEqual(initialTask);
    expect(
      client.getQueryData(["task", "TEAM", "PROJECT", "7"]),
    ).toBeUndefined();
  });
});

it("refetches actual task state after a write response is lost without retrying the write", async () => {
  const { client, wrapper } = setup();
  client.setQueryData(keys.tasks.detail("TEAM", "PROJECT", 7), initialTask);
  vi.mocked(tasks.updateTaskStatus).mockRejectedValue(
    new Error("Response lost after commit"),
  );
  vi.mocked(tasks.getTask).mockResolvedValue(confirmedTask);
  const { result } = renderHook(
    () => ({
      save: useUpdateTaskStatus("TEAM", "PROJECT"),
      detail: useTask("TEAM", "PROJECT", 7),
    }),
    { wrapper },
  );
  await act(async () => {
    await expect(
      result.current.save.mutateAsync({ taskNumber: 7, status: "IN_PROGRESS" }),
    ).rejects.toThrow("Response lost");
  });
  await waitFor(() =>
    expect(result.current.detail.data).toEqual(confirmedTask),
  );
  expect(tasks.updateTaskStatus).toHaveBeenCalledOnce();
});

it("keeps an in-flight save tied to the original entity after navigation", async () => {
  const { client, wrapper } = setup();
  const response = deferred<Task>();
  vi.mocked(tasks.updateTask).mockReturnValue(response.promise);
  const next = { ...initialTask, taskNumber: 9, name: "Other workspace" };
  const nextKey = keys.tasks.detail("OTHER", "NEXT", 9);
  client.setQueryData(nextKey, next);
  const { result, rerender } = renderHook(
    ({ team, project, task }) => useUpdateTask(team, project, task),
    { wrapper, initialProps: { team: "TEAM", project: "PROJECT", task: 7 } },
  );
  let saving!: Promise<Task>;
  act(() => {
    saving = result.current.mutateAsync({ name: "Original save" });
  });
  await waitFor(() => expect(tasks.updateTask).toHaveBeenCalledOnce());
  rerender({ team: "OTHER", project: "NEXT", task: 9 });
  await act(async () => {
    response.resolve(confirmedTask);
    await saving;
  });
  expect(client.getQueryData(nextKey)).toEqual(next);
  expect(client.getQueryState(nextKey)?.isInvalidated).toBe(false);
  expect(client.getQueryData(keys.tasks.detail("TEAM", "PROJECT", 7))).toEqual(
    confirmedTask,
  );
});

it("keeps an offline queued request tied to its original workspace", async () => {
  onlineManager.setOnline(false);
  const { wrapper } = setup();
  vi.mocked(tasks.updateTask).mockResolvedValue(confirmedTask);
  const { result, rerender } = renderHook(
    ({ team }) => useUpdateTask(team, "PROJECT", 7),
    { wrapper, initialProps: { team: "TEAM" } },
  );
  let saving!: Promise<Task>;
  act(() => {
    saving = result.current.mutateAsync({ name: "Queued save" });
  });
  await waitFor(() => expect(result.current.isPaused).toBe(true));
  rerender({ team: "OTHER" });
  await act(async () => {
    onlineManager.setOnline(true);
    await saving;
  });
  expect(tasks.updateTask).toHaveBeenCalledExactlyOnceWith(
    "TEAM",
    "PROJECT",
    7,
    { name: "Queued save" },
  );
});

it("does not send an offline queued write as a different logged-in account", async () => {
  onlineManager.setOnline(false);
  const { wrapper } = setup();
  const { result } = renderHook(() => useUpdateTask("TEAM", "PROJECT", 7), {
    wrapper,
  });
  let saving!: Promise<Task | undefined>;
  act(() => {
    saving = result.current
      .mutateAsync({ name: "Queued save" })
      .catch(() => undefined);
  });
  await waitFor(() => expect(result.current.isPaused).toBe(true));
  authStorage.setToken("new-account");
  await act(async () => {
    onlineManager.setOnline(true);
    await saving;
  });
  expect(tasks.updateTask).not.toHaveBeenCalled();
});
