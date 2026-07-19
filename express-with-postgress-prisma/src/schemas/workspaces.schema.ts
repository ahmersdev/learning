import { z } from "zod";

export const workspacePostSchema = z
  .object({
    name: z.string().trim().min(1, "name is required"),
    description: z.string().trim().optional(),
  })
  .strict();

export const workspacePatchSchema = z
  .object({
    name: z.string().trim().min(1, "name is required").optional(),
    description: z.string().trim().optional(),
  })
  .strict()
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: "At least one field (name or description) must be provided",
  });

export type WorkspacePostInput = z.infer<typeof workspacePostSchema>;
export type WorkspacePatchInput = z.infer<typeof workspacePatchSchema>;
