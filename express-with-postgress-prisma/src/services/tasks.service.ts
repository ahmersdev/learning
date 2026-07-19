import crypto from "crypto";
import type {
  TaskPostInput,
  TaskPatchInput,
  TaskQueryInput,
} from "../schemas/tasks.schema.ts";
import { AppError } from "../utils/app-errors.ts";

// TODO: once DB is wired up:
// - assertCanAccessProject should look up the project, find its parent
//   workspaceId, and confirm the requesting user is a member of that
//   workspace (throw AppError 404 "Project not found" if either the
//   project doesn't exist or the user isn't a member — don't leak
//   existence of projects the user can't access)
// - all functions should perform real queries/writes scoped to projectId

export const assertCanAccessProject = async (
  projectId: string,
  userId: string,
): Promise<void> => {
  // TODO: check project exists + user is a member of its workspace
  return;
};

export const postTaskService = async (
  projectId: string,
  taskData: TaskPostInput,
) => {
  const { title, description, status, priority, dueDate, assigneeId } =
    taskData;

  return {
    id: crypto.randomUUID(),
    projectId,
    title,
    description: description ?? null,
    status: status ?? "backlog",
    priority: priority ?? "medium",
    dueDate: dueDate ?? null,
    assigneeId: assigneeId ?? null,
    createdAt: new Date().toISOString(),
  };
};

export const getTasksService = async (
  projectId: string,
  query: TaskQueryInput,
) => {
  // TODO: build a real filtered/sorted/paginated DB query using
  // query.status, query.priority, query.assigneeId, query.sortBy,
  // query.page, query.limit

  const stubTask = {
    id: crypto.randomUUID(),
    projectId,
    title: "Stub Task",
    description: null,
    status: query.status ?? "backlog",
    priority: query.priority ?? "medium",
    dueDate: null,
    assigneeId: query.assigneeId ?? null,
    createdAt: new Date().toISOString(),
  };

  return {
    tasks: [stubTask],
    pagination: {
      page: query.page,
      limit: query.limit,
      total: 1,
      totalPages: 1,
    },
  };
};

export const getTaskByIdService = async (projectId: string, taskId: string) => {
  // TODO: find task by id -> if not found OR not in this project,
  // throw new AppError("Task not found", 404)

  return {
    id: taskId,
    projectId,
    title: "Stub Task",
    description: null,
    status: "backlog" as const,
    priority: "medium" as const,
    dueDate: null,
    assigneeId: null,
    createdAt: new Date().toISOString(),
  };
};

export const patchTaskByIdService = async (
  projectId: string,
  taskId: string,
  updates: TaskPatchInput,
) => {
  // TODO: find task by id -> if not found OR not in this project,
  // throw new AppError("Task not found", 404)
  // apply updates, save

  return {
    id: taskId,
    projectId,
    title: updates.title ?? "Stub Task",
    description: updates.description ?? null,
    status: updates.status ?? "backlog",
    priority: updates.priority ?? "medium",
    dueDate: updates.dueDate ?? null,
    assigneeId: updates.assigneeId ?? null,
    createdAt: new Date().toISOString(),
  };
};

export const deleteTaskByIdService = async (
  projectId: string,
  taskId: string,
) => {
  // TODO: find task by id -> if not found OR not in this project,
  // throw new AppError("Task not found", 404)
  // delete from DB

  return;
};
