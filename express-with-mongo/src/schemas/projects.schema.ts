import { z } from "zod";

export const projectPostSchema = z
  .object({
    name: z.string().trim().min(1, "name is required"),
    description: z
      .string()
      .trim()
      .min(1, "description cannot be empty")
      .optional(),
  })
  .strict();

export const projectPatchSchema = z
  .object({
    name: z.string().trim().min(1, "name is required").optional(),
    description: z
      .string()
      .trim()
      .min(1, "description cannot be empty")
      .optional(),
  })
  .strict()
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: "At least one field (name or description) must be provided",
  });

export type ProjectPostInput = z.infer<typeof projectPostSchema>;
export type ProjectPatchInput = z.infer<typeof projectPatchSchema>;
