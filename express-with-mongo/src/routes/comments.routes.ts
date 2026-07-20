import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.ts";
import { generalLimiter } from "../middlewares/rate-limiter.middleware.ts";
import { validate } from "../middlewares/validate.middleware.ts";
import {
  postComment,
  getComments,
  patchCommentById,
  deleteCommentById,
} from "../controllers/comments.controller.ts";
import {
  commentPatchSchema,
  commentPostSchema,
} from "../schemas/comments.schema.ts";
import { validateObjectId } from "../middlewares/validate-object-id.middleware.ts";

const router = Router();

/**
 * @openapi
 * /tasks/{taskId}/comments:
 *   post:
 *     summary: Add a comment to a task
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string, example: "Looks good, ready to ship." }
 *     responses:
 *       201:
 *         description: Comment added successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       404:
 *         description: Task not found
 */
router.post(
  "/:taskId/comments",
  requireAuth,
  validateObjectId("taskId"),
  generalLimiter,
  validate(commentPostSchema),
  postComment,
);

/**
 * @openapi
 * /tasks/{taskId}/comments:
 *   get:
 *     summary: List all comments on a task
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of comments retrieved successfully
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       404:
 *         description: Task not found
 */
router.get(
  "/:taskId/comments",
  requireAuth,
  validateObjectId("taskId"),
  generalLimiter,
  getComments,
);

/**
 * @openapi
 * /tasks/{taskId}/comments/{commentId}:
 *   patch:
 *     summary: Update your own comment on a task
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string }
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       403:
 *         description: Forbidden — you can only edit your own comments
 *       404:
 *         description: Comment not found
 */
router.patch(
  "/:taskId/comments/:commentId",
  requireAuth,
  validateObjectId("taskId", "commentId"),
  generalLimiter,
  validate(commentPatchSchema),
  patchCommentById,
);

/**
 * @openapi
 * /tasks/{taskId}/comments/{commentId}:
 *   delete:
 *     summary: Delete your own comment on a task
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       403:
 *         description: Forbidden — you can only delete your own comments
 *       404:
 *         description: Comment not found
 */
router.delete(
  "/:taskId/comments/:commentId",
  requireAuth,
  validateObjectId("taskId", "commentId"),
  generalLimiter,
  deleteCommentById,
);

export default router;
