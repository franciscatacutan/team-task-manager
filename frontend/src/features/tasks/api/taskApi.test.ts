import { describe, expect, it, vi } from "vitest";
import { apiClient } from "@/api/apiClients";
import { updateTask, assignSupportUser, getTasks } from "./taskApi";

vi.mock("@/api/apiClients", () => ({
  apiClient: { patch: vi.fn(), delete: vi.fn(), get: vi.fn() },
}));

describe("task update contract", () => {
  it("preserves partial updates without introducing an empty name", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({
      data: { name: "Existing task" },
    });
    await updateTask("TEAM-A", "PROJ-A", 7, {
      description: "Updated description",
      priority: "HIGH",
    });
    expect(apiClient.patch).toHaveBeenCalledWith(
      "/teams/TEAM-A/projects/PROJ-A/tasks/7",
      {
        description: "Updated description",
        priority: "HIGH",
      },
    );
  });
});

describe("task assignment and filter API", () => {
  it("clears support through DELETE and returns the updated task", async () => {
    const task = { taskNumber: 7, supportUser: null };
    vi.mocked(apiClient.delete).mockResolvedValue({ data: task });
    await expect(assignSupportUser("TEAM", "PROJECT", 7, null)).resolves.toBe(
      task,
    );
    expect(apiClient.delete).toHaveBeenCalledWith(
      "/teams/TEAM/projects/PROJECT/tasks/7/support",
    );
  });
  it("retains the support assignment PATCH route", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
    await assignSupportUser("TEAM", "PROJECT", 7, "member");
    expect(apiClient.patch).toHaveBeenLastCalledWith(
      "/teams/TEAM/projects/PROJECT/tasks/7/support/member",
    );
  });
  it("sends all selected statuses and priorities as repeated parameters", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { content: [] } });
    await getTasks("TEAM", "PROJECT", {
      status: ["TODO", "IN_PROGRESS"],
      priority: ["HIGH", "CRITICAL"],
      deletedFilter: "ACTIVE",
    });
    expect(apiClient.get).toHaveBeenLastCalledWith(
      "/teams/TEAM/projects/PROJECT/tasks",
      {
        params: {
          status: ["TODO", "IN_PROGRESS"],
          priority: ["HIGH", "CRITICAL"],
          deletedFilter: "ACTIVE",
        },
        paramsSerializer: { indexes: null },
      },
    );
  });
});
