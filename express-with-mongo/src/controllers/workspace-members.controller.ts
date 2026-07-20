import { type Request, type Response, type NextFunction } from "express";
import { AppError } from "../utils/app-errors.ts";
import type {
  WorkspaceMembersPostInput,
  WorkspaceMembersPatchInput,
} from "../schemas/workspace-members.schema.ts";
import {
  getRequesterRoleService,
  postWorkspaceMembersService,
  getWorkspaceMembersService,
  patchWorkspaceMembersByIdService,
  deleteWorkspaceMembersByIdService,
} from "../services/workspace-members.service.ts";

export const postWorkspaceMembers = async (
  req: Request<{ workspaceId: string }, {}, WorkspaceMembersPostInput>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { workspaceId } = req.params;
    const requesterRole = await getRequesterRoleService(
      workspaceId,
      req.user.id,
    );

    const result = await postWorkspaceMembersService(
      requesterRole,
      workspaceId,
      req.body,
    );

    return res.status(201).json({
      status: "success",
      message: "Member added successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getWorkspaceMembers = async (
  req: Request<{ workspaceId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { workspaceId } = req.params;

    // Any member can view the list — just confirm they belong to the
    // workspace at all (getRequesterRoleService throws if not a member,
    // once DB is wired up)
    await getRequesterRoleService(workspaceId, req.user.id);

    const members = await getWorkspaceMembersService(workspaceId);

    return res.status(200).json({
      status: "success",
      data: { members },
    });
  } catch (error) {
    next(error);
  }
};

export const patchWorkspaceMembersById = async (
  req: Request<
    { workspaceId: string; userId: string },
    {},
    WorkspaceMembersPatchInput
  >,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { workspaceId, userId } = req.params;
    const requesterRole = await getRequesterRoleService(
      workspaceId,
      req.user.id,
    );

    const member = await patchWorkspaceMembersByIdService(
      requesterRole,
      workspaceId,
      userId,
      req.body,
    );

    return res.status(200).json({
      status: "success",
      message: "Member updated successfully",
      data: { member },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteWorkspaceMembersById = async (
  req: Request<{ workspaceId: string; userId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { workspaceId, userId } = req.params;
    const requesterRole = await getRequesterRoleService(
      workspaceId,
      req.user.id,
    );

    await deleteWorkspaceMembersByIdService(requesterRole, workspaceId, userId);

    return res.status(200).json({
      status: "success",
      message: "Member removed successfully",
    });
  } catch (error) {
    next(error);
  }
};
