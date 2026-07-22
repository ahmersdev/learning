import { type Request, type Response, type NextFunction } from "express";
import { AppError } from "../utils/app-errors.ts";
import type {
  CommentPostInput,
  CommentPatchInput,
} from "../schemas/comments.schema.ts";
import {
  assertCanAccessTask,
  assertIsCommentAuthor,
  postCommentService,
  getCommentsService,
  patchCommentByIdService,
  deleteCommentByIdService,
} from "../services/comments.service.ts";

export const postComment = async (
  req: Request<{ taskId: string }, {}, CommentPostInput>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { taskId } = req.params;
    await assertCanAccessTask(taskId, req.user.id);

    const comment = await postCommentService(taskId, req.user.id, req.body);

    return res.status(201).json({
      status: "success",
      message: "Comment added successfully",
      data: { comment },
    });
  } catch (error) {
    next(error);
  }
};

export const getComments = async (
  req: Request<{ taskId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { taskId } = req.params;
    await assertCanAccessTask(taskId, req.user.id);

    const comments = await getCommentsService(taskId);

    return res.status(200).json({
      status: "success",
      data: { comments },
    });
  } catch (error) {
    next(error);
  }
};

export const patchCommentById = async (
  req: Request<{ taskId: string; commentId: string }, {}, CommentPatchInput>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { taskId, commentId } = req.params;
    await assertCanAccessTask(taskId, req.user.id);
    await assertIsCommentAuthor(taskId, commentId, req.user.id);

    const comment = await patchCommentByIdService(commentId, req.body);

    return res.status(200).json({
      status: "success",
      message: "Comment updated successfully",
      data: { comment },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCommentById = async (
  req: Request<{ taskId: string; commentId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { taskId, commentId } = req.params;
    await assertCanAccessTask(taskId, req.user.id);
    await assertIsCommentAuthor(taskId, commentId, req.user.id);
    await deleteCommentByIdService(commentId);

    return res.status(200).json({
      status: "success",
      message: "Comment deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
