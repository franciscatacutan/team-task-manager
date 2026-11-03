import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { useAddMembers } from "../hooks/useAddMembers";
import { useRemoveMembers } from "../hooks/useRemoveMembers";
import { addMembers, removeMembers } from "../api/teamMemberApi";
vi.mock("../api/teamMemberApi", () => ({
  addMembers: vi.fn(),
  removeMembers: vi.fn(),
}));

describe("membership cache refresh", () => {
  it.each(["result", "transport"])(
    "refreshes membership-dependent keys after a %s outcome",
    async (outcome) => {
      vi.mocked(addMembers).mockResolvedValue({
        success: [],
        failed: [
          { userId: "user", reason: "Already a member", code: "CONFLICT" },
        ],
      });
      vi.mocked(removeMembers).mockRejectedValue(
        new Error("connection dropped after processing"),
      );
      const client = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
      });
      const keys = [
        ["teams", 0],
        ["team", "TEAM"],
        ["team-me", "TEAM"],
        ["teamMembers", "TEAM", 0],
        ["allTeamMembers", "TEAM"],
        ["availableUsers", "TEAM"],
        ["teamActivity", "TEAM", 0],
        ["team-audit-logs", "TEAM"],
        ["team-insights", "TEAM"],
        ["user", "user"],
      ];
      const unaffected = [
        ["teamMembers", "OTHER"],
        ["user", "other-user"],
      ];
      [...keys, ...unaffected].forEach((key) => client.setQueryData(key, {}));
      const wrapper = ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
      const { result } = renderHook(
        () => ({
          add: useAddMembers("TEAM"),
          remove: useRemoveMembers("TEAM"),
        }),
        { wrapper },
      );
      act(() => {
        if (outcome === "result")
          result.current.add.mutate({
            members: [{ userId: "user", role: "MEMBER" }],
          });
        else result.current.remove.mutate({ userIds: ["user"] });
      });
      await waitFor(() =>
        expect(
          outcome === "result"
            ? result.current.add.isSuccess
            : result.current.remove.isError,
        ).toBe(true),
      );
      keys.forEach((key) =>
        expect(
          client.getQueryState(key)?.isInvalidated,
          JSON.stringify(key),
        ).toBe(true),
      );
      unaffected.forEach((key) =>
        expect(
          client.getQueryState(key)?.isInvalidated,
          JSON.stringify(key),
        ).toBe(false),
      );
      client.clear();
    },
  );
});
