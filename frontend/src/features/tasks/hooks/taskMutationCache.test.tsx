import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTask, updateTaskStatus } from "../api/taskApi";
import { useCreateTask } from "./useCreateTask";
import { useUpdateTaskStatus } from "./useUpdateTaskStatus";
import type { CreateTaskInput } from "../types/createTaskSchema";
vi.mock("../api/taskApi", () => ({
  createTask: vi.fn(),
  updateTaskStatus: vi.fn(),
}));
beforeEach(() => vi.resetAllMocks());
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
describe("scoped task mutation cache", () => {
  it("invalidates the actual project list and board keys after creation", async () => {
    const { client, wrapper } = setup();
    const list = ["tasks", "TEAM", "PROJECT", { page: 0 }];
    const board = ["tasks", "infinite", "TEAM", "PROJECT", "TODO"];
    client.setQueryData(list, { content: [] });
    client.setQueryData(board, { pages: [] });
    client.setQueryData(["tasks", "OTHER", "PROJECT"], {});
    vi.mocked(createTask).mockResolvedValue({ taskNumber: 7 } as Awaited<
      ReturnType<typeof createTask>
    >);
    const { result } = renderHook(() => useCreateTask("TEAM", "PROJECT"), {
      wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync({ name: "X" } as CreateTaskInput);
    });
    expect(client.getQueryState(list)?.isInvalidated).toBe(true);
    expect(client.getQueryState(board)?.isInvalidated).toBe(true);
    expect(
      client.getQueryState(["tasks", "OTHER", "PROJECT"])?.isInvalidated,
    ).toBe(false);
  });
  it("uses the confirmed status response without creating the old phantom cache entry", async () => {
    const { client, wrapper } = setup();
    const task = {
      taskNumber: 7,
      status: "IN_PROGRESS",
      name: "Confirmed",
    } as Awaited<ReturnType<typeof updateTaskStatus>>;
    client.setQueryData(["tasks", "TEAM", "PROJECT", { page: 0 }], {
      content: [],
    });
    vi.mocked(updateTaskStatus).mockResolvedValue(task);
    const { result } = renderHook(
      () => useUpdateTaskStatus("TEAM", "PROJECT"),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync({
        taskNumber: 7,
        status: "IN_PROGRESS",
      });
    });
    expect(client.getQueryData(["task", "TEAM", "PROJECT", 7])).toEqual(task);
    expect(client.getQueryData(["tasks", "PROJECT"])).toBeUndefined();
    expect(
      client.getQueryState(["tasks", "TEAM", "PROJECT", { page: 0 }])
        ?.isInvalidated,
    ).toBe(true);
  });
  it("preserves confirmed detail and refetches on failure", async () => {
    const { client, wrapper } = setup();
    const task = { taskNumber: 7, status: "TODO" };
    client.setQueryData(["task", "TEAM", "PROJECT", 7], task);
    vi.mocked(updateTaskStatus).mockRejectedValue(new Error("Forbidden"));
    const { result } = renderHook(
      () => useUpdateTaskStatus("TEAM", "PROJECT"),
      { wrapper },
    );
    await act(async () => {
      await expect(
        result.current.mutateAsync({ taskNumber: 7, status: "IN_PROGRESS" }),
      ).rejects.toThrow("Forbidden");
    });
    expect(client.getQueryData(["task", "TEAM", "PROJECT", 7])).toEqual(task);
    expect(
      client.getQueryState(["task", "TEAM", "PROJECT", 7])?.isInvalidated,
    ).toBe(true);
  });
});
