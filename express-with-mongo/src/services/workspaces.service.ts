import type {
  WorkspacePostInput,
  WorkspacePatchInput,
} from "../schemas/workspaces.schema.ts";
import { Workspace } from "../models/workspace.model.ts";
import { AppError } from "../utils/app-errors.ts";
import { WorkspaceMember } from "../models/workspace-member.model.ts";

export const postWorkspaceService = async (
  ownerId: string,
  workspaceData: WorkspacePostInput,
) => {
  const { name, description } = workspaceData;

  const workspace = await Workspace.create({
    ownerId,
    name,
    description: description ?? null,
  });

  await WorkspaceMember.create({
    workspaceId: workspace.id,
    userId: ownerId,
    role: "admin",
  });

  return {
    id: workspace.id,
    ownerId: workspace.ownerId.toString(),
    name: workspace.name,
    description: workspace.description,
  };
};

export const getWorkspacesService = async (ownerId: string) => {
  const workspaces = await Workspace.find({ ownerId });

  return workspaces.map((workspace) => ({
    id: workspace.id,
    ownerId: workspace.ownerId.toString(),
    name: workspace.name,
    description: workspace.description,
  }));
};

// Scoping every lookup to { _id: workspaceId, ownerId } in one query means a
// user requesting someone else's workspace ID gets the exact same 404 as a
// truly nonexistent ID — the two cases are indistinguishable to them,
// which is what avoids leaking whether that ID even exists
export const getWorkspaceByIdService = async (
  ownerId: string,
  workspaceId: string,
) => {
  const workspace = await Workspace.findOne({ _id: workspaceId, ownerId });

  if (!workspace) {
    throw new AppError("Workspace not found", 404);
  }

  return {
    id: workspace.id,
    ownerId: workspace.ownerId.toString(),
    name: workspace.name,
    description: workspace.description,
  };
};

export const patchWorkspaceByIdService = async (
  ownerId: string,
  workspaceId: string,
  updates: WorkspacePatchInput,
) => {
  const workspace = await Workspace.findOneAndUpdate(
    { _id: workspaceId, ownerId },
    { $set: updates },
    { new: true, runValidators: true },
  );

  if (!workspace) {
    throw new AppError("Workspace not found", 404);
  }

  return {
    id: workspace.id,
    ownerId: workspace.ownerId.toString(),
    name: workspace.name,
    description: workspace.description,
  };
};

export const deleteWorkspaceByIdService = async (
  ownerId: string,
  workspaceId: string,
) => {
  const workspace = await Workspace.findOneAndDelete({
    _id: workspaceId,
    ownerId,
  });

  if (!workspace) {
    throw new AppError("Workspace not found", 404);
  }

  return;
};
