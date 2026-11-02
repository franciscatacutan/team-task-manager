import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, it } from "vitest";
import { createTaskSchema, type CreateTaskInput } from "./createTaskSchema";

const validTask: CreateTaskInput = {
  name: "Release preparation",
  priority: "HIGH",
  assigneeId: "user-1",
  plannedStartDate: "2026-11-10T09:00:00Z",
  plannedDueDate: "2026-11-11T09:00:00Z",
};
const resolve = zodResolver(createTaskSchema);
const options = { fields: {}, shouldUseNativeValidation: false };

describe("task form resolver compatibility", () => {
  it("returns the task name contract for a valid submission", async () => {
    const result = await resolve(validTask, undefined, options);
    expect(result.errors).toEqual({});
    expect(result.values).toEqual(validTask);
  });
  it("preserves field errors and the cross-field date constraint", async () => {
    const result = await resolve(
      {
        ...validTask,
        name: "a",
        assigneeId: "",
        plannedDueDate: "2026-11-09T09:00:00Z",
      },
      undefined,
      options,
    );
    expect(result.values).toEqual({});
    expect(result.errors.name?.message).toBe(
      "Name must be at least 3 characters",
    );
    expect(result.errors.assigneeId?.message).toBe("Assignee is required");
    expect(result.errors.plannedDueDate?.message).toBe(
      "Due date must be after start date",
    );
  });
});
