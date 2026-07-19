import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.ts";
import { validate } from "../middlewares/validate.middleware.ts";
import { generalLimiter } from "../middlewares/rate-limiter.middleware.ts";
import {
  postWorkspace,
  getWorkspace,
  getWorkspaceById,
  patchWorkspaceById,
  deleteWorkspaceById,
} from "../controllers/workspaces.controller.ts";
import {
  workspacePatchSchema,
  workspacePostSchema,
} from "../schemas/workspaces.schema.ts";

const router = Router();

/**
 * @openapi
 * /workspaces:
 *   post:
 *     summary: Create a new workspace
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: "Marketing Team" }
 *               description: { type: string, example: "Workspace for the marketing team" }
 *     responses:
 *       201:
 *         description: Workspace created successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized — missing or invalid access token
 */
router.post(
  "/",
  requireAuth,
  generalLimiter,
  validate(workspacePostSchema),
  postWorkspace,
);

/**
 * @openapi
 * /workspaces:
 *   get:
 *     summary: List all workspaces owned by the currently authenticated user
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of workspaces retrieved successfully
 *       401:
 *         description: Unauthorized — missing or invalid access token
 */
router.get("/", requireAuth, generalLimiter, getWorkspace);

/**
 * @openapi
 * /workspaces/{workspaceId}:
 *   get:
 *     summary: Get a single workspace by ID
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *         description: ID of the workspace to retrieve
 *     responses:
 *       200:
 *         description: Workspace retrieved successfully
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       404:
 *         description: Workspace not found
 */
router.get("/:workspaceId", requireAuth, generalLimiter, getWorkspaceById);

/**
 * @openapi
 * /workspaces/{workspaceId}:
 *   patch:
 *     summary: Update a workspace's name and/or description
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *         description: ID of the workspace to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, example: "Renamed Workspace" }
 *               description: { type: string, example: "Updated description" }
 *             description: At least one of name or description must be provided
 *     responses:
 *       200:
 *         description: Workspace updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       404:
 *         description: Workspace not found
 */
router.patch(
  "/:workspaceId",
  requireAuth,
  generalLimiter,
  validate(workspacePatchSchema),
  patchWorkspaceById,
);

/**
 * @openapi
 * /workspaces/{workspaceId}:
 *   delete:
 *     summary: Delete a workspace
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *         description: ID of the workspace to delete
 *     responses:
 *       200:
 *         description: Workspace deleted successfully
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       404:
 *         description: Workspace not found
 */
router.delete(
  "/:workspaceId",
  requireAuth,
  generalLimiter,
  deleteWorkspaceById,
);

export default router;
