import { z } from "zod";

const taskStatuses = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
] as const;
const taskPriorities = ["low", "medium", "high", "urgent"] as const;

export const taskPostSchema = z
  .object({
    title: z.string().trim().min(1, "title is required"),
    description: z
      .string()
      .trim()
      .min(1, "description cannot be empty")
      .optional(),
    status: z.enum(taskStatuses).optional(),
    priority: z.enum(taskPriorities).optional(),
    dueDate: z.iso
      .datetime({ error: "dueDate must be a valid ISO date" })
      .optional(),
    assigneeId: z
      .string()
      .trim()
      .min(1, "assigneeId cannot be empty")
      .optional(),
  })
  .strict();

export const taskPatchSchema = z
  .object({
    title: z.string().trim().min(1, "title is required").optional(),
    description: z
      .string()
      .trim()
      .min(1, "description cannot be empty")
      .optional(),
    status: z.enum(taskStatuses).optional(),
    priority: z.enum(taskPriorities).optional(),
    dueDate: z.iso
      .datetime({ error: "dueDate must be a valid ISO date" })
      .optional(),
    assigneeId: z
      .string()
      .trim()
      .min(1, "assigneeId cannot be empty")
      .optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one field must be provided",
  });

const taskSortFields = ["dueDate", "priority", "createdAt", "title"] as const;

export const taskQuerySchema = z
  .object({
    status: z.enum(taskStatuses).optional(),
    priority: z.enum(taskPriorities).optional(),
    assigneeId: z.string().trim().min(1).optional(),
    sortBy: z.enum(taskSortFields).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type TaskPostInput = z.infer<typeof taskPostSchema>;
export type TaskPatchInput = z.infer<typeof taskPatchSchema>;
export type TaskQueryInput = z.infer<typeof taskQuerySchema>;
