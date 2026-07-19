import { z } from "zod";

export const commentPostSchema = z
  .object({
    content: z.string().trim().min(1, "content is required"),
  })
  .strict();

export const commentPatchSchema = z
  .object({
    content: z.string().trim().min(1, "content is required"),
  })
  .strict();

export type CommentPostInput = z.infer<typeof commentPostSchema>;
export type CommentPatchInput = z.infer<typeof commentPatchSchema>;
