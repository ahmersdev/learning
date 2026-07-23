import { z } from "zod";

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(1, "fullName is required"),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, "username must be at least 3 characters"),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email({ error: "Invalid email format" })),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(
        /[^a-zA-Z0-9]/,
        "Password must contain at least one special character",
      ),
  })
  .strict();

export const signinSchema = z
  .object({
    username: z.string().trim().toLowerCase().optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email({ error: "Invalid email format" }))
      .optional(),
    password: z.string().min(1, "Password is required"),
  })
  .strict()
  .refine((data) => data.username || data.email, {
    message: "Either username or email is required",
    path: ["username"],
  });

export type SignupInputSchema = z.infer<typeof signupSchema>;
export type SigninInputSchema = z.infer<typeof signinSchema>;
