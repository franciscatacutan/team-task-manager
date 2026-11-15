import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(3, "Project name must be at least 3 characters"),
  description: z.string().optional(),
  plannedDueDate: z.iso.date().nullable().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
