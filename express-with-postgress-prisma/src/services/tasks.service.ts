import { prisma } from "../config/db.ts";
import { AppError, NotFoundError } from "../utils/app-errors.ts";
import type {
  TaskPostInput,
  TaskPatchInput,
  TaskQueryInput,
} from "../schemas/tasks.schema.ts";

export const assertCanAccessProject = async (
  projectId: string,
  userId: string,
): Promise<{ workspaceId: string }> => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
  });

  if (!membership) {
    throw new NotFoundError("Project not found");
  }

  return { workspaceId: project.workspaceId };
};

const assertAssigneeIsWorkspaceMember = async (
  workspaceId: string,
  assigneeId: string,
) => {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: assigneeId } },
  });

  if (!membership) {
    throw new AppError("assigneeId is not a member of this workspace", 400);
  }
};

export const postTaskService = async (
  projectId: string,
  workspaceId: string,
  taskData: TaskPostInput,
) => {
  const { title, description, status, priority, dueDate, assigneeId } =
    taskData;

  if (assigneeId) {
    await assertAssigneeIsWorkspaceMember(workspaceId, assigneeId);
  }

  return prisma.task.create({
    data: {
      projectId,
      title,
      description: description ?? null,
      status: status ?? "backlog",
      priority: priority ?? "medium",
      dueDate: dueDate ? new Date(dueDate) : null,
      assigneeId: assigneeId ?? null,
    },
  });
};

export const getTasksService = async (
  projectId: string,
  query: TaskQueryInput,
) => {
  const { status, priority, assigneeId, sortBy, sortOrder, page, limit } =
    query;

  const where = {
    projectId,
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(assigneeId ? { assigneeId } : {}),
  };

  const orderBy = sortBy
    ? { [sortBy]: sortOrder }
    : { createdAt: "desc" as const };

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.task.count({ where }),
  ]);

  return {
    tasks,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
};

export const getTaskByIdService = async (projectId: string, taskId: string) => {
  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId },
  });

  if (!task) {
    throw new NotFoundError("Task not found");
  }

  return task;
};

export const patchTaskByIdService = async (
  projectId: string,
  workspaceId: string,
  taskId: string,
  updates: TaskPatchInput,
) => {
  if (updates.assigneeId) {
    await assertAssigneeIsWorkspaceMember(workspaceId, updates.assigneeId);
  }

  const { count } = await prisma.task.updateMany({
    where: { id: taskId, projectId },
    data: {
      ...updates,
      ...(updates.dueDate ? { dueDate: new Date(updates.dueDate) } : {}),
    },
  });

  if (count === 0) {
    throw new NotFoundError("Task not found");
  }

  return prisma.task.findUniqueOrThrow({ where: { id: taskId } });
};

export const deleteTaskByIdService = async (
  projectId: string,
  taskId: string,
) => {
  const { count } = await prisma.task.deleteMany({
    where: { id: taskId, projectId },
  });

  if (count === 0) {
    throw new NotFoundError("Task not found");
  }
};
