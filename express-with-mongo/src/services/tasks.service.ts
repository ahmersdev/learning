import type {
  TaskPostInput,
  TaskPatchInput,
  TaskQueryInput,
} from "../schemas/tasks.schema.ts";
import { AppError } from "../utils/app-errors.ts";
import { Task } from "../models/task.model.ts";
import { Project } from "../models/project.model.ts";
import { WorkspaceMember } from "../models/workspace-member.model.ts";

// A task's parent chain is Task -> Project -> Workspace. To confirm access
// we resolve the project first (to get its workspaceId), then check
// membership in that workspace — same "404 not 403" leak-avoidance used
// throughout: a project that exists but you can't access looks identical
// to one that doesn't exist
export const assertCanAccessProject = async (
  projectId: string,
  userId: string,
): Promise<void> => {
  const project = await Project.findById(projectId);

  if (!project) {
    throw new AppError("Project not found", 404);
  }

  const membership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId,
  });

  if (!membership) {
    throw new AppError("Project not found", 404);
  }
};

const toTaskResponse = (task: InstanceType<typeof Task>) => ({
  id: task.id,
  projectId: task.projectId.toString(),
  title: task.title,
  description: task.description,
  status: task.status,
  priority: task.priority,
  dueDate: task.dueDate ? task.dueDate.toISOString() : null,
  assigneeId: task.assigneeId ? task.assigneeId.toString() : null,
  createdAt: task.createdAt.toISOString(),
});

export const postTaskService = async (
  projectId: string,
  taskData: TaskPostInput,
) => {
  const { title, description, status, priority, dueDate, assigneeId } =
    taskData;

  const task = await Task.create({
    projectId,
    title,
    description: description ?? null,
    status: status ?? "backlog",
    priority: priority ?? "medium",
    dueDate: dueDate ?? null,
    assigneeId: assigneeId ?? null,
  });

  return toTaskResponse(task);
};

export const getTasksService = async (
  projectId: string,
  query: TaskQueryInput,
) => {
  const filter: Record<string, unknown> = { projectId };

  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.assigneeId) filter.assigneeId = query.assigneeId;

  const sort: Record<string, 1 | -1> = query.sortBy
    ? { [query.sortBy]: query.sortOrder === "desc" ? -1 : 1 }
    : { createdAt: -1 }; // sensible default: newest first

  const skip = (query.page - 1) * query.limit;

  const [tasks, total] = await Promise.all([
    Task.find(filter).sort(sort).skip(skip).limit(query.limit),
    Task.countDocuments(filter),
  ]);

  return {
    tasks: tasks.map(toTaskResponse),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const getTaskByIdService = async (projectId: string, taskId: string) => {
  const task = await Task.findOne({ _id: taskId, projectId });

  if (!task) {
    throw new AppError("Task not found", 404);
  }

  return toTaskResponse(task);
};

export const patchTaskByIdService = async (
  projectId: string,
  taskId: string,
  updates: TaskPatchInput,
) => {
  const task = await Task.findOneAndUpdate(
    { _id: taskId, projectId },
    { $set: updates },
    { new: true, runValidators: true },
  );

  if (!task) {
    throw new AppError("Task not found", 404);
  }

  return toTaskResponse(task);
};

export const deleteTaskByIdService = async (
  projectId: string,
  taskId: string,
) => {
  const task = await Task.findOneAndDelete({ _id: taskId, projectId });

  if (!task) {
    throw new AppError("Task not found", 404);
  }

  return;
};
