import { type Request, type Response, type NextFunction } from "express";
import { type ZodType } from "zod";
import { AppError } from "../utils/app-errors.ts";

export const validate = (schema: ZodType) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const result = await schema.safeParseAsync(req.body);

      if (!result.success) {
        // Group messages by field name using a clean Map
        const errorMap = new Map<string, string[]>();

        for (const issue of result.error.issues) {
          const field = issue.path.join(".") || "body";
          const messages = errorMap.get(field) || [];
          messages.push(issue.message);
          errorMap.set(field, messages);
        }

        // Convert the Map back to your expected details array format
        const details = Array.from(errorMap.entries()).map(
          ([field, messages]) => ({
            field,
            // Joins multiple errors with a comma, or adjust to choose how you want them formatted
            message: messages.join(", "),
          }),
        );

        return next(new AppError("Validation failed", 400, details));
      }

      req.body = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
};
