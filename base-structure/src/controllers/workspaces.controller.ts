import { type Request, type Response, type NextFunction } from "express";
import { AppError } from "../utils/app-errors.ts";
import type {
  WorkspacePostInput,
  WorkspacePatchInput,
} from "../schemas/workspaces.schema.ts";
import {
  postWorkspaceService,
  getWorkspacesService,
  getWorkspaceByIdService,
  patchWorkspaceByIdService,
  deleteWorkspaceByIdService,
} from "../services/workspaces.service.ts";

export const postWorkspace = async (
  req: Request<{}, {}, WorkspacePostInput>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const workspace = await postWorkspaceService(req.user.id, req.body);

    return res.status(201).json({
      status: "success",
      message: "Workspace created successfully",
      data: { workspace },
    });
  } catch (error) {
    next(error);
  }
};

export const getWorkspace = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const workspaces = await getWorkspacesService(req.user.id);

    return res.status(200).json({
      status: "success",
      data: { workspaces },
    });
  } catch (error) {
    next(error);
  }
};

export const getWorkspaceById = async (
  req: Request<{ workspaceId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const workspace = await getWorkspaceByIdService(
      req.user.id,
      req.params.workspaceId,
    );

    return res.status(200).json({
      status: "success",
      data: { workspace },
    });
  } catch (error) {
    next(error);
  }
};

export const patchWorkspaceById = async (
  req: Request<{ workspaceId: string }, {}, WorkspacePatchInput>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const workspace = await patchWorkspaceByIdService(
      req.user.id,
      req.params.workspaceId,
      req.body,
    );

    return res.status(200).json({
      status: "success",
      message: "Workspace updated successfully",
      data: { workspace },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteWorkspaceById = async (
  req: Request<{ workspaceId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    await deleteWorkspaceByIdService(req.user.id, req.params.workspaceId);

    return res.status(200).json({
      status: "success",
      message: "Workspace deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
