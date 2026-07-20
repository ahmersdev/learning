import { type Request, type Response, type NextFunction } from "express";
import { BadRequestError } from "../utils/app-errors.ts";

// Mongoose's own ObjectId.isValid() is too permissive — it also accepts
// any 12-character string (since a 12-byte string can construct a valid
// ObjectId), which lets non-hex garbage slip through. A strict 24-char
// hex regex is what actually matches real Mongo _id values.
const isValidObjectId = (value: string): boolean =>
  /^[0-9a-fA-F]{24}$/.test(value);

export const validateObjectId = (...paramNames: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    for (const paramName of paramNames) {
      const value = req.params[paramName];
      // Ensure 'value' exists AND is a string before validating
      if (typeof value !== "string" || !isValidObjectId(value)) {
        return next(new BadRequestError(`Invalid ${paramName}`));
      }
    }
    next();
  };
};
