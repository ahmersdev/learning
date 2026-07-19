import crypto from "crypto";
import type {
  ProjectPostInput,
  ProjectPatchInput,
} from "../schemas/projects.schema.ts";
import { AppError } from "../utils/app-errors.ts";

// TODO: once DB is wired up:
// - assertIsWorkspaceMember should verify the user actually belongs to this
//   workspace (throw AppError 404 "Workspace not found" if not — avoids
//   leaking existence of workspaces the user isn't part of)
// - all functions should perform real queries/writes scoped to workspaceId

export const assertIsWorkspaceMember = async (
  workspaceId: string,
  userId: string,
): Promise<void> => {
  // TODO: check membership; for now stub every requester as a valid member
  return;
};

export const postProjectService = async (
  workspaceId: string,
  projectData: ProjectPostInput,
) => {
  const { name, description } = projectData;

  return {
    id: crypto.randomUUID(),
    workspaceId,
    name,
    description: description ?? null,
  };
};

export const getProjectsService = async (workspaceId: string) => {
  // TODO: return all projects where workspaceId matches
  return [
    {
      id: crypto.randomUUID(),
      workspaceId,
      name: "Stub Project",
      description: null,
    },
  ];
};

export const getProjectByIdService = async (
  workspaceId: string,
  projectId: string,
) => {
  // TODO: find project by id -> if not found OR not in this workspace,
  // throw new AppError("Project not found", 404)

  return {
    id: projectId,
    workspaceId,
    name: "Stub Project",
    description: null,
  };
};

export const patchProjectByIdService = async (
  workspaceId: string,
  projectId: string,
  updates: ProjectPatchInput,
) => {
  // TODO: find project by id -> if not found OR not in this workspace,
  // throw new AppError("Project not found", 404)
  // apply updates, save

  return {
    id: projectId,
    workspaceId,
    name: updates.name ?? "Stub Project",
    description: updates.description ?? null,
  };
};

export const deleteProjectByIdService = async (
  workspaceId: string,
  projectId: string,
) => {
  // TODO: find project by id -> if not found OR not in this workspace,
  // throw new AppError("Project not found", 404)
  // delete from DB

  return;
};
