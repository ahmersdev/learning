import type {
  ProjectPostInput,
  ProjectPatchInput,
} from "../schemas/projects.schema.ts";
import { AppError } from "../utils/app-errors.ts";
import { Project } from "../models/project.model.ts";
import { WorkspaceMember } from "../models/workspace-member.model.ts";

// Any member (admin or regular) can access a workspace's projects — this
// mirrors getRequesterRoleService's "404 not 403" pattern: a workspace you
// don't belong to looks identical to one that doesn't exist at all
export const assertIsWorkspaceMember = async (
  workspaceId: string,
  userId: string,
): Promise<void> => {
  const membership = await WorkspaceMember.findOne({ workspaceId, userId });

  if (!membership) {
    throw new AppError("Workspace not found", 404);
  }
};

export const postProjectService = async (
  workspaceId: string,
  projectData: ProjectPostInput,
) => {
  const { name, description } = projectData;

  const project = await Project.create({
    workspaceId,
    name,
    description: description ?? null,
  });

  return {
    id: project.id,
    workspaceId: project.workspaceId.toString(),
    name: project.name,
    description: project.description,
  };
};

export const getProjectsService = async (workspaceId: string) => {
  const projects = await Project.find({ workspaceId });

  return projects.map((project) => ({
    id: project.id,
    workspaceId: project.workspaceId.toString(),
    name: project.name,
    description: project.description,
  }));
};

export const getProjectByIdService = async (
  workspaceId: string,
  projectId: string,
) => {
  const project = await Project.findOne({ _id: projectId, workspaceId });

  if (!project) {
    throw new AppError("Project not found", 404);
  }

  return {
    id: project.id,
    workspaceId: project.workspaceId.toString(),
    name: project.name,
    description: project.description,
  };
};

export const patchProjectByIdService = async (
  workspaceId: string,
  projectId: string,
  updates: ProjectPatchInput,
) => {
  const project = await Project.findOneAndUpdate(
    { _id: projectId, workspaceId },
    { $set: updates },
    { new: true, runValidators: true },
  );

  if (!project) {
    throw new AppError("Project not found", 404);
  }

  return {
    id: project.id,
    workspaceId: project.workspaceId.toString(),
    name: project.name,
    description: project.description,
  };
};

export const deleteProjectByIdService = async (
  workspaceId: string,
  projectId: string,
) => {
  const project = await Project.findOneAndDelete({
    _id: projectId,
    workspaceId,
  });

  if (!project) {
    throw new AppError("Project not found", 404);
  }

  return;
};
