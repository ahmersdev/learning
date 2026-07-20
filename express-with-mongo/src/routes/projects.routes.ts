import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.ts";
import { generalLimiter } from "../middlewares/rate-limiter.middleware.ts";
import { validate } from "../middlewares/validate.middleware.ts";
import {
  postProject,
  getProjects,
  getProjectById,
  patchProjectById,
  deleteProjectById,
} from "../controllers/projects.controller.ts";
import {
  projectPatchSchema,
  projectPostSchema,
} from "../schemas/projects.schema.ts";
import { validateObjectId } from "../middlewares/validate-object-id.middleware.ts";

const router = Router();

/**
 * @openapi
 * /workspaces/{workspaceId}/projects:
 *   post:
 *     summary: Create a new project in a workspace
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: "Website Redesign" }
 *               description: { type: string, example: "Q3 marketing site refresh" }
 *     responses:
 *       201:
 *         description: Project created successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       404:
 *         description: Workspace not found
 */
router.post(
  "/:workspaceId/projects",
  requireAuth,
  validateObjectId("workspaceId"),
  generalLimiter,
  validate(projectPostSchema),
  postProject,
);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects:
 *   get:
 *     summary: List all projects in a workspace
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of projects retrieved successfully
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       404:
 *         description: Workspace not found
 */
router.get(
  "/:workspaceId/projects",
  requireAuth,
  validateObjectId("workspaceId"),
  generalLimiter,
  getProjects,
);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}:
 *   get:
 *     summary: Get a single project by ID
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Project retrieved successfully
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       404:
 *         description: Project not found
 */
router.get(
  "/:workspaceId/projects/:projectId",
  requireAuth,
  validateObjectId("workspaceId", "projectId"),
  generalLimiter,
  getProjectById,
);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}:
 *   patch:
 *     summary: Update a project's name and/or description
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
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
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *             description: At least one of name or description must be provided
 *     responses:
 *       200:
 *         description: Project updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       404:
 *         description: Project not found
 */
router.patch(
  "/:workspaceId/projects/:projectId",
  requireAuth,
  validateObjectId("workspaceId", "projectId"),
  generalLimiter,
  validate(projectPatchSchema),
  patchProjectById,
);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}:
 *   delete:
 *     summary: Delete a project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Project deleted successfully
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       404:
 *         description: Project not found
 */
router.delete(
  "/:workspaceId/projects/:projectId",
  requireAuth,
  validateObjectId("workspaceId", "projectId"),
  generalLimiter,
  deleteProjectById,
);

export default router;
