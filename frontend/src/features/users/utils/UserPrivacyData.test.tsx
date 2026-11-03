import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/common/query/queryKeys";
import { useUser } from "../hooks/useUser";
import { getUser } from "../api/userApi";
import { useTeams } from "@/features/teams/hooks/useTeams";
import { getTeams } from "@/features/teams/api/teamApi";
vi.mock("../api/userApi", () => ({ getUser: vi.fn() }));
vi.mock("@/features/teams/api/teamApi", () => ({ getTeams: vi.fn() }));
const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0, staleTime: Infinity } },
  });
  clients.push(client);
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
beforeEach(() => vi.resetAllMocks());
afterEach(async () => {
  for (const client of clients.splice(0)) {
    await client.cancelQueries();
    client.clear();
  }
});
describe("profile data boundaries", () => {
  it.each([403, 404])(
    "does not retry profile access rejection %s",
    async (status) => {
      const { wrapper } = setup();
      vi.mocked(getUser).mockRejectedValue({
        isAxiosError: true,
        response: { status },
      });
      const { result } = renderHook(() => useUser("target"), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(getUser).toHaveBeenCalledExactlyOnceWith("target");
    },
  );
  it("still retries transient profile failures", async () => {
    const { wrapper } = setup();
    const limited = {
      id: "target",
      firstName: "Team",
      lastName: "Mate",
      email: "team@example.test",
    };
    vi.mocked(getUser)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(limited);
    const { result } = renderHook(() => useUser("target"), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(limited));
    expect(getUser).toHaveBeenCalledTimes(2);
  });
  it("keeps pagination placeholders only for the same profile's team list", () => {
    const { client, wrapper } = setup();
    const params = {
      memberId: "first",
      page: 0,
      size: 10,
      deletedFilter: "ACTIVE" as const,
    };
    const cached = {
      content: [{ key: "FIRST", name: "First profile team" }],
      page: 0,
      last: false,
    };
    client.setQueryData(queryKeys.teams.list(params), cached);
    vi.mocked(getTeams).mockReturnValue(new Promise(() => {}));
    const { result, rerender } = renderHook(
      ({ memberId, page }) => useTeams({ ...params, memberId, page }),
      { wrapper, initialProps: { memberId: "first", page: 0 } },
    );
    expect(result.current.data).toEqual(cached);
    rerender({ memberId: "first", page: 1 });
    expect(result.current.isPlaceholderData).toBe(true);
    rerender({ memberId: "second", page: 0 });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPlaceholderData).toBe(false);
  });
  it("does not fetch profile team lists before profile access is established", () => {
    const { wrapper } = setup();
    renderHook(
      () => useTeams({ memberId: "target", deletedFilter: "ACTIVE" }, false),
      { wrapper },
    );
    expect(getTeams).not.toHaveBeenCalled();
  });
});
