import type { PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { authStorage } from "@/features/auth/utils/authStorage";
import { queryKeys } from "@/common/query/queryKeys";
import { useUpdateTaskStatus } from "./useUpdateTaskStatus";
import { getTask, updateTaskStatus } from "../api/taskApi";
import type { Task } from "../types/task.types";

vi.mock("../api/taskApi", () => ({
  getTask: vi.fn(),
  updateTaskStatus: vi.fn(),
}));
const confirmed = {
  taskNumber: 17,
  status: "IN_PROGRESS",
  name: "Confirmed",
} as Task;
let client: QueryClient;
beforeEach(() => {
  vi.resetAllMocks();
  authStorage.endLogout();
  authStorage.setToken("test");
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  client.clear();
  authStorage.clearToken();
  authStorage.endLogout();
});
function mount() {
  return renderHook(() => useUpdateTaskStatus("TEAM", "PROJECT"), {
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}
it("does not replay a status change already confirmed by the server", async () => {
  vi.mocked(getTask).mockResolvedValue(confirmed);
  const { result } = mount();
  await act(async () =>
    result.current.mutateAsync({
      taskNumber: 17,
      status: "IN_PROGRESS",
      checkCurrent: true,
    }),
  );
  expect(getTask).toHaveBeenCalledExactlyOnceWith("TEAM", "PROJECT", 17);
  expect(updateTaskStatus).not.toHaveBeenCalled();
  expect(
    client.getQueryData(queryKeys.tasks.detail("TEAM", "PROJECT", 17)),
  ).toEqual(confirmed);
});
it("retries against current server state and keeps normal moves to one PATCH", async () => {
  vi.mocked(getTask).mockResolvedValue({ ...confirmed, status: "TODO" });
  vi.mocked(updateTaskStatus).mockResolvedValue(confirmed);
  const { result } = mount();
  await act(async () =>
    result.current.mutateAsync({
      taskNumber: 17,
      status: "IN_PROGRESS",
      checkCurrent: true,
    }),
  );
  expect(updateTaskStatus).toHaveBeenCalledExactlyOnceWith(
    "TEAM",
    "PROJECT",
    17,
    "IN_PROGRESS",
  );
  vi.mocked(getTask).mockClear();
  await act(async () =>
    result.current.mutateAsync({ taskNumber: 17, status: "IN_PROGRESS" }),
  );
  expect(getTask).not.toHaveBeenCalled();
});
it.each(["account", "logout"])(
  "does not write or cache after %s changes during the retry read",
  async (kind) => {
    vi.mocked(getTask).mockImplementation(async () => {
      if (kind === "account") authStorage.setToken("other");
      else authStorage.beginLogout();
      return { ...confirmed, status: "TODO" };
    });
    const { result } = mount();
    await act(async () => {
      await expect(
        result.current.mutateAsync({
          taskNumber: 17,
          status: "IN_PROGRESS",
          checkCurrent: true,
        }),
      ).rejects.toThrow();
    });
    expect(updateTaskStatus).not.toHaveBeenCalled();
    expect(
      client.getQueryData(queryKeys.tasks.detail("TEAM", "PROJECT", 17)),
    ).toBeUndefined();
  },
);
it("does not write when the retry's current-state read fails", async () => {
  vi.mocked(getTask).mockRejectedValue(new Error("Forbidden"));
  const { result } = mount();
  await act(async () => {
    await expect(
      result.current.mutateAsync({
        taskNumber: 17,
        status: "IN_PROGRESS",
        checkCurrent: true,
      }),
    ).rejects.toThrow("Forbidden");
  });
  expect(updateTaskStatus).not.toHaveBeenCalled();
});
