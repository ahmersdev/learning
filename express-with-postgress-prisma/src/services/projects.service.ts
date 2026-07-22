import { prisma } from "../config/db.ts";
import { NotFoundError } from "../utils/app-errors.ts";
import type {
  ProjectPostInput,
  ProjectPatchInput,
} from "../schemas/projects.schema.ts";

export const assertIsWorkspaceMember = async (
  workspaceId: string,
  userId: string,
): Promise<void> => {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (!membership) {
    throw new NotFoundError("Workspace not found");
  }
};

export const postProjectService = async (
  workspaceId: string,
  projectData: ProjectPostInput,
) => {
  const { name, description } = projectData;

  return prisma.project.create({
    data: { workspaceId, name, description: description ?? null },
  });
};

export const getProjectsService = async (workspaceId: string) => {
  return prisma.project.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
};

export const getProjectByIdService = async (
  workspaceId: string,
  projectId: string,
) => {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
  });

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  return project;
};

export const patchProjectByIdService = async (
  workspaceId: string,
  projectId: string,
  updates: ProjectPatchInput,
) => {
  const { count } = await prisma.project.updateMany({
    where: { id: projectId, workspaceId },
    data: updates,
  });

  if (count === 0) {
    throw new NotFoundError("Project not found");
  }

  return prisma.project.findUniqueOrThrow({ where: { id: projectId } });
};

export const deleteProjectByIdService = async (
  workspaceId: string,
  projectId: string,
) => {
  const { count } = await prisma.project.deleteMany({
    where: { id: projectId, workspaceId },
  });

  if (count === 0) {
    throw new NotFoundError("Project not found");
  }
};
