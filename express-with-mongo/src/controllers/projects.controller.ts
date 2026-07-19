import { type Request, type Response, type NextFunction } from "express";
import { AppError } from "../utils/app-errors.ts";
import type {
  ProjectPostInput,
  ProjectPatchInput,
} from "../schemas/projects.schema.ts";
import {
  assertIsWorkspaceMember,
  postProjectService,
  getProjectsService,
  getProjectByIdService,
  patchProjectByIdService,
  deleteProjectByIdService,
} from "../services/projects.service.ts";

export const postProject = async (
  req: Request<{ workspaceId: string }, {}, ProjectPostInput>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { workspaceId } = req.params;
    await assertIsWorkspaceMember(workspaceId, req.user.id);

    const project = await postProjectService(workspaceId, req.body);

    return res.status(201).json({
      status: "success",
      message: "Project created successfully",
      data: { project },
    });
  } catch (error) {
    next(error);
  }
};

export const getProjects = async (
  req: Request<{ workspaceId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { workspaceId } = req.params;
    await assertIsWorkspaceMember(workspaceId, req.user.id);

    const projects = await getProjectsService(workspaceId);

    return res.status(200).json({
      status: "success",
      data: { projects },
    });
  } catch (error) {
    next(error);
  }
};

export const getProjectById = async (
  req: Request<{ workspaceId: string; projectId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { workspaceId, projectId } = req.params;
    await assertIsWorkspaceMember(workspaceId, req.user.id);

    const project = await getProjectByIdService(workspaceId, projectId);

    return res.status(200).json({
      status: "success",
      data: { project },
    });
  } catch (error) {
    next(error);
  }
};

export const patchProjectById = async (
  req: Request<
    { workspaceId: string; projectId: string },
    {},
    ProjectPatchInput
  >,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { workspaceId, projectId } = req.params;
    await assertIsWorkspaceMember(workspaceId, req.user.id);

    const project = await patchProjectByIdService(
      workspaceId,
      projectId,
      req.body,
    );

    return res.status(200).json({
      status: "success",
      message: "Project updated successfully",
      data: { project },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProjectById = async (
  req: Request<{ workspaceId: string; projectId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { workspaceId, projectId } = req.params;
    await assertIsWorkspaceMember(workspaceId, req.user.id);

    await deleteProjectByIdService(workspaceId, projectId);

    return res.status(200).json({
      status: "success",
      message: "Project deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
