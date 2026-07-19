import crypto from "crypto";
import type {
  WorkspacePostInput,
  WorkspacePatchInput,
} from "../schemas/workspaces.schema.ts";

// TODO: once DB is wired up, replace all of this with real queries scoped
// to ownerId, including ownership checks (404, not 403, if not owned —
// avoids leaking existence of other users' workspaces)

export const postWorkspaceService = async (
  ownerId: string,
  workspaceData: WorkspacePostInput,
) => {
  const { name, description } = workspaceData;

  return {
    id: crypto.randomUUID(),
    ownerId,
    name,
    description: description ?? null,
  };
};

export const getWorkspacesService = async (ownerId: string) => {
  // TODO: return all workspaces where ownerId matches
  return [
    {
      id: crypto.randomUUID(),
      ownerId,
      name: "Stub Workspace",
      description: null,
    },
  ];
};

export const getWorkspaceByIdService = async (
  ownerId: string,
  workspaceId: string,
) => {
  // TODO: find workspace by id -> if not found OR not owned by ownerId,
  // throw new AppError("Workspace not found", 404)

  return {
    id: workspaceId,
    ownerId,
    name: "Stub Workspace",
    description: null,
  };
};

export const patchWorkspaceByIdService = async (
  ownerId: string,
  workspaceId: string,
  updates: WorkspacePatchInput,
) => {
  // TODO: find workspace by id -> if not found OR not owned by ownerId,
  // throw new AppError("Workspace not found", 404)
  // apply updates, save

  return {
    id: workspaceId,
    ownerId,
    name: updates.name ?? "Stub Workspace",
    description: updates.description ?? null,
  };
};

export const deleteWorkspaceByIdService = async (
  ownerId: string,
  workspaceId: string,
) => {
  // TODO: find workspace by id -> if not found OR not owned by ownerId,
  // throw new AppError("Workspace not found", 404)
  // delete from DB

  return;
};
