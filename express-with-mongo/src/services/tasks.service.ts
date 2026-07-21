import type {
  TaskPostInput,
  TaskPatchInput,
  TaskQueryInput,
} from "../schemas/tasks.schema.ts";
import { AppError, BadRequestError } from "../utils/app-errors.ts";
import { Task, type ITask } from "../models/task.model.ts";
import { Project } from "../models/project.model.ts";
import { WorkspaceMember } from "../models/workspace-member.model.ts";

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

const assertValidAssignee = async (
  projectId: string,
  assigneeId: string,
): Promise<void> => {
  const project = await Project.findById(projectId);

  if (!project) {
    throw new AppError("Project not found", 404);
  }

  const membership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId: assigneeId,
  });

  if (!membership) {
    throw new BadRequestError(
      "assigneeId must belong to a member of this task's workspace",
    );
  }
};

interface PopulatedAssignee {
  _id: { toString(): string };
  fullName: string;
  username: string;
  email: string;
}

// Represents a Task document *after* populate() has swapped assigneeId
// from a raw ObjectId to a full user object. Mongoose's static Document
// type can't express this transformation on its own, so this is the
// shape toTaskResponse actually expects, and callers cast to it.
type PopulatedTask = Omit<ITask, "assigneeId"> & {
  id: string;
  assigneeId: PopulatedAssignee | null;
};

const toTaskResponse = (task: PopulatedTask) => {
  const assignee = task.assigneeId;

  return {
    id: task.id,
    projectId: task.projectId.toString(),
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    assigneeDetails: assignee
      ? {
          id: assignee._id.toString(),
          fullName: assignee.fullName,
          username: assignee.username,
          email: assignee.email,
        }
      : null,
    createdAt: task.createdAt.toISOString(),
  };
};

const ASSIGNEE_POPULATE_FIELDS = "fullName username email";

export const postTaskService = async (
  projectId: string,
  taskData: TaskPostInput,
) => {
  const { title, description, status, priority, dueDate, assigneeId } =
    taskData;

  if (assigneeId) {
    await assertValidAssignee(projectId, assigneeId);
  }

  const task = await Task.create({
    projectId,
    title,
    description: description ?? null,
    status: status ?? "backlog",
    priority: priority ?? "medium",
    dueDate: dueDate ?? null,
    assigneeId: assigneeId ?? null,
  });

  await task.populate("assigneeId", ASSIGNEE_POPULATE_FIELDS);

  return toTaskResponse(task as unknown as PopulatedTask);
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
    : { createdAt: -1 };

  const skip = (query.page - 1) * query.limit;

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(query.limit)
      .populate("assigneeId", ASSIGNEE_POPULATE_FIELDS),
    Task.countDocuments(filter),
  ]);

  return {
    tasks: (tasks as unknown as PopulatedTask[]).map(toTaskResponse),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const getTaskByIdService = async (projectId: string, taskId: string) => {
  const task = await Task.findOne({ _id: taskId, projectId }).populate(
    "assigneeId",
    ASSIGNEE_POPULATE_FIELDS,
  );

  if (!task) {
    throw new AppError("Task not found", 404);
  }

  return toTaskResponse(task as unknown as PopulatedTask);
};

export const patchTaskByIdService = async (
  projectId: string,
  taskId: string,
  updates: TaskPatchInput,
) => {
  if (updates.assigneeId) {
    await assertValidAssignee(projectId, updates.assigneeId);
  }

  const task = await Task.findOneAndUpdate(
    { _id: taskId, projectId },
    { $set: updates },
    { new: true, runValidators: true },
  ).populate("assigneeId", ASSIGNEE_POPULATE_FIELDS);

  if (!task) {
    throw new AppError("Task not found", 404);
  }

  return toTaskResponse(task as unknown as PopulatedTask);
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
