import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.ts";
import { generalLimiter } from "../middlewares/rate-limiter.middleware.ts";
import { validate } from "../middlewares/validate.middleware.ts";
import {
  postTask,
  getTasks,
  getTaskById,
  patchTaskById,
  deleteTaskById,
} from "../controllers/tasks.controller.ts";
import {
  taskPatchSchema,
  taskPostSchema,
  taskQuerySchema,
} from "../schemas/tasks.schema.ts";

const router = Router();

/**
 * @openapi
 * /projects/{projectId}/tasks:
 *   post:
 *     summary: Create a new task in a project
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string, example: "Design homepage mockup" }
 *               description: { type: string }
 *               status: { type: string, enum: [backlog, todo, in_progress, in_review, blocked, done] }
 *               priority: { type: string, enum: [low, medium, high, urgent] }
 *               dueDate: { type: string, format: date-time }
 *               assigneeId: { type: string }
 *     responses:
 *       201:
 *         description: Task created successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       404:
 *         description: Project not found
 */
router.post(
  "/:projectId/tasks",
  requireAuth,
  generalLimiter,
  validate(taskPostSchema),
  postTask,
);

/**
 * @openapi
 * /projects/{projectId}/tasks:
 *   get:
 *     summary: List tasks in a project, with filtering/sorting/pagination
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [backlog, todo, in_progress, in_review, blocked, done] }
 *       - in: query
 *         name: priority
 *         schema: { type: string, enum: [low, medium, high, urgent] }
 *       - in: query
 *         name: assigneeId
 *         schema: { type: string }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [dueDate, priority, createdAt, title] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: List of tasks retrieved successfully
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       404:
 *         description: Project not found
 */
router.get(
  "/:projectId/tasks",
  requireAuth,
  generalLimiter,
  validate(taskQuerySchema, "query"),
  getTasks,
);

/**
 * @openapi
 * /projects/{projectId}/tasks/{taskId}:
 *   get:
 *     summary: Get a single task by ID
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Task retrieved successfully
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       404:
 *         description: Task not found
 */
router.get(
  "/:projectId/tasks/:taskId",
  requireAuth,
  generalLimiter,
  getTaskById,
);

/**
 * @openapi
 * /projects/{projectId}/tasks/{taskId}:
 *   patch:
 *     summary: Update a task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
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
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               status: { type: string, enum: [backlog, todo, in_progress, in_review, blocked, done] }
 *               priority: { type: string, enum: [low, medium, high, urgent] }
 *               dueDate: { type: string, format: date-time }
 *               assigneeId: { type: string }
 *             description: At least one field must be provided
 *     responses:
 *       200:
 *         description: Task updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       404:
 *         description: Task not found
 */
router.patch(
  "/:projectId/tasks/:taskId",
  requireAuth,
  generalLimiter,
  validate(taskPatchSchema),
  patchTaskById,
);

/**
 * @openapi
 * /projects/{projectId}/tasks/{taskId}:
 *   delete:
 *     summary: Delete a task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       404:
 *         description: Task not found
 */
router.delete(
  "/:projectId/tasks/:taskId",
  requireAuth,
  generalLimiter,
  deleteTaskById,
);

export default router;
