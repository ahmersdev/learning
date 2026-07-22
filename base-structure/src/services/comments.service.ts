import crypto from "crypto";
import type {
  CommentPostInput,
  CommentPatchInput,
} from "../schemas/comments.schema.ts";
import { AppError, ForbiddenError } from "../utils/app-errors.ts";

// TODO: once DB is wired up:
// - assertCanAccessTask should look up the task, trace it back to its
//   project -> workspace, and confirm the requesting user is a member
//   of that workspace (throw AppError 404 "Task not found" if either
//   the task doesn't exist or the user isn't a member)
// - assertIsCommentAuthor should look up the real comment and compare
//   its authorId to the requesting user (throw AppError 404 "Comment
//   not found" if it doesn't exist, ForbiddenError if it exists but
//   belongs to someone else)
// - all functions should perform real queries/writes scoped to taskId

export const assertCanAccessTask = async (
  taskId: string,
  userId: string,
): Promise<void> => {
  // TODO: check task exists + user is a member of its workspace
  return;
};

export const assertIsCommentAuthor = async (
  commentId: string,
  userId: string,
): Promise<void> => {
  // TODO: look up real comment.authorId and compare to userId
  // For now stub every requester as the author so the flow can be tested
  return;
};

export const postCommentService = async (
  taskId: string,
  authorId: string,
  commentData: CommentPostInput,
) => {
  const { content } = commentData;

  return {
    id: crypto.randomUUID(),
    taskId,
    authorId,
    content,
    createdAt: new Date().toISOString(),
  };
};

export const getCommentsService = async (taskId: string) => {
  // TODO: return all comments where taskId matches
  return [
    {
      id: crypto.randomUUID(),
      taskId,
      authorId: "stub-author-id",
      content: "Stub comment",
      createdAt: new Date().toISOString(),
    },
  ];
};

export const patchCommentByIdService = async (
  taskId: string,
  commentId: string,
  updates: CommentPatchInput,
) => {
  // TODO: find comment by id -> if not found OR not on this task,
  // throw new AppError("Comment not found", 404)
  // apply updates, save

  return {
    id: commentId,
    taskId,
    authorId: "stub-author-id",
    content: updates.content,
    createdAt: new Date().toISOString(),
  };
};

export const deleteCommentByIdService = async (
  taskId: string,
  commentId: string,
) => {
  // TODO: find comment by id -> if not found OR not on this task,
  // throw new AppError("Comment not found", 404)
  // delete from DB

  return;
};
