import type {
  CommentPostInput,
  CommentPatchInput,
} from "../schemas/comments.schema.ts";
import { AppError, ForbiddenError } from "../utils/app-errors.ts";
import { Comment } from "../models/comment.model.ts";
import { Task } from "../models/task.model.ts";
import { Project } from "../models/project.model.ts";
import { WorkspaceMember } from "../models/workspace-member.model.ts";

// A comment's parent chain is Comment -> Task -> Project -> Workspace.
// Same "404 not 403" pattern as tasks.service.ts's assertCanAccessProject,
// just one hop further up the chain.
export const assertCanAccessTask = async (
  taskId: string,
  userId: string,
): Promise<void> => {
  const task = await Task.findById(taskId);

  if (!task) {
    throw new AppError("Task not found", 404);
  }

  const project = await Project.findById(task.projectId);

  if (!project) {
    throw new AppError("Task not found", 404);
  }

  const membership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId,
  });

  if (!membership) {
    throw new AppError("Task not found", 404);
  }
};

export const assertIsCommentAuthor = async (
  commentId: string,
  userId: string,
): Promise<void> => {
  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new AppError("Comment not found", 404);
  }

  if (comment.authorId.toString() !== userId) {
    throw new ForbiddenError("You can only modify your own comments");
  }
};

const toCommentResponse = (comment: InstanceType<typeof Comment>) => ({
  id: comment.id,
  taskId: comment.taskId.toString(),
  authorId: comment.authorId.toString(),
  content: comment.content,
  createdAt: comment.createdAt.toISOString(),
});

export const postCommentService = async (
  taskId: string,
  authorId: string,
  commentData: CommentPostInput,
) => {
  const { content } = commentData;

  const comment = await Comment.create({ taskId, authorId, content });

  return toCommentResponse(comment);
};

export const getCommentsService = async (taskId: string) => {
  const comments = await Comment.find({ taskId }).sort({ createdAt: 1 }); // oldest first, like a real comment thread

  return comments.map(toCommentResponse);
};

export const patchCommentByIdService = async (
  taskId: string,
  commentId: string,
  updates: CommentPatchInput,
) => {
  const comment = await Comment.findOneAndUpdate(
    { _id: commentId, taskId },
    { $set: updates },
    { new: true, runValidators: true },
  );

  if (!comment) {
    throw new AppError("Comment not found", 404);
  }

  return toCommentResponse(comment);
};

export const deleteCommentByIdService = async (
  taskId: string,
  commentId: string,
) => {
  const comment = await Comment.findOneAndDelete({ _id: commentId, taskId });

  if (!comment) {
    throw new AppError("Comment not found", 404);
  }

  return;
};
