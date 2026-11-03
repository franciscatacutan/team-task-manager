import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, it } from "vitest";
import { createTaskSchema } from "./createTaskSchema";
import { TASK_PRIORITIES } from "../constants/task.constants";

const input = {
  name: "Task",
  priority: "LOW",
  assigneeId: "00000000-0000-4000-8000-000000000001",
  plannedStartDate: "2026-11-01T00:00:00Z",
  plannedDueDate: "2026-11-02T00:00:00Z",
};
describe("task creation contract", () => {
  it.each(TASK_PRIORITIES)("accepts %s priority", (priority) => {
    expect(createTaskSchema.parse({ ...input, priority }).priority).toBe(
      priority,
    );
  });
  it.each(["X", "x".repeat(100)])(
    "accepts and trims names within the approved range",
    (name) => {
      expect(
        createTaskSchema.parse({ ...input, name: `  ${name}  ` }).name,
      ).toBe(name);
    },
  );
  it.each(["   ", "x".repeat(101)])(
    "rejects blank or oversized names",
    (name) => {
      expect(createTaskSchema.safeParse({ ...input, name }).success).toBe(
        false,
      );
    },
  );
  it("rejects an invalid priority, invalid members and the same assignee/support", () => {
    for (const changes of [
      { priority: "URGENT" },
      { assigneeId: "bad" },
      { supportId: input.assigneeId },
    ]) {
      expect(createTaskSchema.safeParse({ ...input, ...changes }).success).toBe(
        false,
      );
    }
  });
  it("rejects malformed or reversed dates", () => {
    expect(
      createTaskSchema.safeParse({ ...input, plannedStartDate: "invalid" })
        .success,
    ).toBe(false);
    expect(
      createTaskSchema.safeParse({
        ...input,
        plannedDueDate: "2026-10-01T00:00:00Z",
      }).success,
    ).toBe(false);
  });
});

describe("React Hook Form resolver compatibility", () => {
  it("returns the normalized name and validates multiple fields", async () => {
    const resolve = zodResolver(createTaskSchema);
    const options = { fields: {}, shouldUseNativeValidation: false };
    const valid = await resolve(
      { ...input, name: " X ", priority: "CRITICAL" },
      undefined,
      options,
    );
    expect(valid.errors).toEqual({});
    expect(valid.values).toEqual({ ...input, name: "X", priority: "CRITICAL" });
    const invalid = await resolve(
      {
        ...input,
        name: " ",
        priority: "HIGH",
        assigneeId: "",
        plannedDueDate: "2026-10-01T00:00:00Z",
      },
      undefined,
      options,
    );
    expect(invalid.values).toEqual({});
    expect(invalid.errors.name?.message).toBe("Name is required");
    expect(invalid.errors.assigneeId?.message).toBe("Select a valid assignee");
    expect(invalid.errors.plannedDueDate?.message).toBe(
      "Due date must be after start date",
    );
  });
});
