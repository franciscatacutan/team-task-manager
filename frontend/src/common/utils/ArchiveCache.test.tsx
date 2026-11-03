import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { useDeleteTask } from "@/features/tasks/hooks/useDeleteTask";
import { useDeleteProject } from "@/features/projects/hooks/useDeleteProject";
import { useDeleteTeam } from "@/features/teams/hooks/UseDeleteTeam";

vi.mock("@/features/tasks/api/taskApi", () => ({
  deleteTask: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/projects/api/projectApi", () => ({
  deleteProject: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/teams/api/teamApi", () => ({
  deleteTeam: vi.fn().mockResolvedValue(undefined),
}));

describe("archive cache consistency", () => {
  const keys = [
    ["teams", { page: 0 }],
    ["team", "TEAM"],
    ["projects", "TEAM", {}],
    ["project", "TEAM", "PROJECT"],
    ["tasks", "TEAM", "PROJECT", {}],
    ["tasks", "infinite", "TEAM", "PROJECT", "TODO"],
    ["task", "TEAM", "PROJECT", 1],
    ["taskActivities", "TEAM", "PROJECT", 1, 0],
    ["projectActivities", "TEAM", "PROJECT", 0],
    ["teamActivity", "TEAM", 0],
    ["project-insights", "TEAM", "PROJECT"],
    ["team-insights", "TEAM"],
    ["team-audit-logs", "TEAM", 0],
    ["project-audit-logs", "TEAM", "PROJECT", 0],
  ];
  function setup() {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    for (const key of keys) client.setQueryData(key, { readOnly: false });
    return {
      client,
      wrapper: ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    };
  }
  it.each(["task", "project", "team"] as const)(
    "invalidates the actual detail and child keys after %s archiving",
    async (level) => {
      const { client, wrapper } = setup();
      const { result } = renderHook(
        () => ({
          task: useDeleteTask("TEAM", "PROJECT"),
          project: useDeleteProject("TEAM"),
          team: useDeleteTeam(),
        }),
        { wrapper },
      );
      act(() => {
        if (level === "task") result.current.task.mutate(1);
        if (level === "project") result.current.project.mutate("PROJECT");
        if (level === "team") result.current.team.mutate("TEAM");
      });
      await waitFor(() => expect(result.current[level].isSuccess).toBe(true));
      const expected =
        level === "team"
          ? keys
          : keys.filter((key) =>
              [
                "tasks",
                "task",
                "taskActivities",
                "projectActivities",
                "project-insights",
                "team-insights",
                "teamActivity",
                "team-audit-logs",
                "project-audit-logs",
                ...(level === "project" ? ["projects", "project"] : []),
              ].includes(key[0] as string),
            );
      for (const key of expected)
        expect(
          client.getQueryState(key)?.isInvalidated,
          JSON.stringify(key),
        ).toBe(true);
      client.clear();
    },
  );
});
