import { prisma } from "../config/db.ts";
import { NotFoundError } from "../utils/app-errors.ts";
import type {
  WorkspacePostInput,
  WorkspacePatchInput,
} from "../schemas/workspaces.schema.ts";

export const postWorkspaceService = async (
  ownerId: string,
  workspaceData: WorkspacePostInput,
) => {
  const { name, description } = workspaceData;

  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: { name, description: description ?? null, ownerId },
    });

    await tx.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: ownerId, role: "admin" },
    });

    return workspace;
  });
};

export const getWorkspacesService = async (ownerId: string) => {
  return prisma.workspace.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
  });
};

export const getWorkspaceByIdService = async (
  ownerId: string,
  workspaceId: string,
) => {
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId },
  });

  if (!workspace) {
    throw new NotFoundError("Workspace not found");
  }

  return workspace;
};

export const patchWorkspaceByIdService = async (
  ownerId: string,
  workspaceId: string,
  updates: WorkspacePatchInput,
) => {
  const { count } = await prisma.workspace.updateMany({
    where: { id: workspaceId, ownerId },
    data: updates,
  });

  if (count === 0) {
    throw new NotFoundError("Workspace not found");
  }

  return prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
};

export const deleteWorkspaceByIdService = async (
  ownerId: string,
  workspaceId: string,
) => {
  const { count } = await prisma.workspace.deleteMany({
    where: { id: workspaceId, ownerId },
  });

  if (count === 0) {
    throw new NotFoundError("Workspace not found");
  }
};
