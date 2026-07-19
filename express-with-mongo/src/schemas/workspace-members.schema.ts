import { z } from "zod";

const workspaceRoles = ["admin", "member"] as const;

export const workspaceMembersPostSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email({ error: "Invalid email format" })),
    role: z.enum(workspaceRoles, {
      error: `role must be one of: ${workspaceRoles.join(", ")}`,
    }),
  })
  .strict();

export const workspaceMembersPatchSchema = z
  .object({
    role: z
      .enum(workspaceRoles, {
        error: `role must be one of: ${workspaceRoles.join(", ")}`,
      })
      .optional(),
  })
  .strict();

export type WorkspaceMembersPostInput = z.infer<
  typeof workspaceMembersPostSchema
>;
export type WorkspaceMembersPatchInput = z.infer<
  typeof workspaceMembersPatchSchema
>;
