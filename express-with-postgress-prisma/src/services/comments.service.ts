import { prisma } from "../config/db.ts";
import { NotFoundError, ForbiddenError } from "../utils/app-errors.ts";
import type {
  CommentPostInput,
  CommentPatchInput,
} from "../schemas/comments.schema.ts";

const COMMENT_AUTHOR_FIELDS = { id: true, fullName: true, username: true };

export const assertCanAccessTask = async (
  taskId: string,
  userId: string,
): Promise<void> => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { project: { select: { workspaceId: true } } },
  });

  if (!task) {
    throw new NotFoundError("Task not found");
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: task.project.workspaceId, userId },
    },
  });

  if (!membership) {
    throw new NotFoundError("Task not found");
  }
};

export const assertIsCommentAuthor = async (
  taskId: string,
  commentId: string,
  userId: string,
): Promise<void> => {
  const comment = await prisma.comment.findFirst({
    where: { id: commentId, taskId },
  });

  if (!comment) {
    throw new NotFoundError("Comment not found");
  }

  if (comment.authorId !== userId) {
    throw new ForbiddenError("You can only modify your own comments");
  }
};

export const postCommentService = async (
  taskId: string,
  authorId: string,
  commentData: CommentPostInput,
) => {
  const { content } = commentData;

  return prisma.comment.create({
    data: { taskId, authorId, content },
    include: { author: { select: COMMENT_AUTHOR_FIELDS } },
  });
};

export const getCommentsService = async (taskId: string) => {
  return prisma.comment.findMany({
    where: { taskId },
    include: { author: { select: COMMENT_AUTHOR_FIELDS } },
    orderBy: { createdAt: "asc" }, // chronological — a comment thread reads oldest-first
  });
};

export const patchCommentByIdService = async (
  commentId: string,
  updates: CommentPatchInput,
) => {
  // existence + ownership already confirmed by assertIsCommentAuthor,
  // called by the controller immediately before this
  return prisma.comment.update({
    where: { id: commentId },
    data: { content: updates.content },
    include: { author: { select: COMMENT_AUTHOR_FIELDS } },
  });
};

export const deleteCommentByIdService = async (commentId: string) => {
  await prisma.comment.delete({ where: { id: commentId } });
};
