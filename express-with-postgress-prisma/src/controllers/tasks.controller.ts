import { type Request, type Response, type NextFunction } from "express";
import { AppError } from "../utils/app-errors.ts";
import type {
  TaskPostInput,
  TaskPatchInput,
  TaskQueryInput,
} from "../schemas/tasks.schema.ts";
import {
  assertCanAccessProject,
  postTaskService,
  getTasksService,
  getTaskByIdService,
  patchTaskByIdService,
  deleteTaskByIdService,
} from "../services/tasks.service.ts";

export const postTask = async (
  req: Request<{ projectId: string }, {}, TaskPostInput>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { projectId } = req.params;
    const { workspaceId } = await assertCanAccessProject(
      projectId,
      req.user.id,
    );

    const task = await postTaskService(projectId, workspaceId, req.body);

    return res.status(201).json({
      status: "success",
      message: "Task created successfully",
      data: { task },
    });
  } catch (error) {
    next(error);
  }
};

export const getTasks = async (
  req: Request<{ projectId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { projectId } = req.params;
    await assertCanAccessProject(projectId, req.user.id);

    const query = req.query as unknown as TaskQueryInput;
    const result = await getTasksService(projectId, query);

    return res.status(200).json({
      status: "success",
      data: { tasks: result.tasks, pagination: result.pagination },
    });
  } catch (error) {
    next(error);
  }
};

export const getTaskById = async (
  req: Request<{ projectId: string; taskId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { projectId, taskId } = req.params;
    await assertCanAccessProject(projectId, req.user.id);

    const task = await getTaskByIdService(projectId, taskId);

    return res.status(200).json({
      status: "success",
      data: { task },
    });
  } catch (error) {
    next(error);
  }
};

export const patchTaskById = async (
  req: Request<{ projectId: string; taskId: string }, {}, TaskPatchInput>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { projectId, taskId } = req.params;
    const { workspaceId } = await assertCanAccessProject(
      projectId,
      req.user.id,
    );
    const task = await patchTaskByIdService(
      projectId,
      workspaceId,
      taskId,
      req.body,
    );

    return res.status(200).json({
      status: "success",
      message: "Task updated successfully",
      data: { task },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTaskById = async (
  req: Request<{ projectId: string; taskId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { projectId, taskId } = req.params;
    await assertCanAccessProject(projectId, req.user.id);

    await deleteTaskByIdService(projectId, taskId);

    return res.status(200).json({
      status: "success",
      message: "Task deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
