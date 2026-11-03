import { TASK_PRIORITIES } from "../constants/task.constants";
import { z } from "zod";

export const createTaskSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .refine(
        (value) => value.length <= 100,
        "Name must be at most 100 characters",
      ),
    description: z
      .string()
      .max(2000, "Description must be at most 2000 characters")
      .optional(),

    priority: z.enum(TASK_PRIORITIES),

    assigneeId: z.uuid("Select a valid assignee"),
    supportId: z.uuid("Select a valid support user").optional(),

    plannedStartDate: z.iso.datetime({
      offset: true,
      error: "Start date is required and must be valid",
    }),
    plannedDueDate: z.iso.datetime({
      offset: true,
      error: "Due date is required and must be valid",
    }),
  })
  .refine((data) => !data.supportId || data.supportId !== data.assigneeId, {
    message: "Support cannot be the same as assignee",
    path: ["supportId"],
  })
  .refine(
    (data) => {
      if (!data.plannedStartDate || !data.plannedDueDate) return true;

      return new Date(data.plannedStartDate) <= new Date(data.plannedDueDate);
    },
    {
      message: "Due date must be after start date",
      path: ["plannedDueDate"],
    },
  );

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
