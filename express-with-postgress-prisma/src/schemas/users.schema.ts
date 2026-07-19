import { z } from "zod";

export const userSchema = z
  .object({
    fullName: z.string().trim().min(1, "fullName is required").optional(),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, "username must be at least 3 characters")
      .optional(),
  })
  .strict()
  .refine(
    (data) => data.fullName !== undefined || data.username !== undefined,
    {
      message: "At least one field (fullName or username) must be provided",
    },
  );

export type UserUpdateInput = z.infer<typeof userSchema>;
