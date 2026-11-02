import { describe, expect, it, vi } from "vitest";
import { apiClient } from "@/api/apiClients";
import { updateTask } from "./taskApi";

vi.mock("@/api/apiClients", () => ({ apiClient: { patch: vi.fn() } }));

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
