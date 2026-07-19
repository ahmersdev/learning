import { type Request, type Response, type NextFunction } from "express";
import type { UserUpdateInput } from "../schemas/users.schema.ts";
import { AppError } from "../utils/app-errors.ts";
import { getUserService, updateUserService } from "../services/users.service.ts";

export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const user = await getUserService(req.user.id);

    return res.status(200).json({
      status: "success",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

export const patchUser = async (
  req: Request<{}, {}, UserUpdateInput>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const updatedUser = await updateUserService(req.user.id, req.body);

    return res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: { user: updatedUser },
    });
  } catch (error) {
    next(error);
  }
};
