import { type Request, type Response, type NextFunction } from "express";
import { type ZodType } from "zod";
import { AppError } from "../utils/app-errors.ts";

type ValidationTarget = "body" | "query" | "params";

export const validate = (
  schema: ZodType,
  target: ValidationTarget = "body",
) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[target];
      const result = await schema.safeParseAsync(dataToValidate);

      if (!result.success) {
        const errorMap = new Map<string, string[]>();

        for (const issue of result.error.issues) {
          const field = issue.path.join(".") || target;
          const messages = errorMap.get(field) || [];
          messages.push(issue.message);
          errorMap.set(field, messages);
        }

        const details = Array.from(errorMap.entries()).map(
          ([field, messages]) => ({
            field,
            message: messages.join(", "),
          }),
        );

        return next(new AppError("Validation failed", 400, details));
      }

      if (target === "query") {
        Object.defineProperty(req, "query", {
          value: result.data,
          writable: true,
          configurable: true,
        });
      } else {
        req[target] = result.data;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
