import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.ts";
import {
  authLimiter,
  generalLimiter,
} from "../middlewares/rate-limiter.middleware.ts";
import { validate } from "../middlewares/validate.middleware.ts";
import {
  postWorkspaceMembers,
  getWorkspaceMembers,
  patchWorkspaceMembersById,
  deleteWorkspaceMembersById,
  resetMemberPassword,
} from "../controllers/workspace-members.controller.ts";
import {
  workspaceMembersPatchSchema,
  workspaceMembersPostSchema,
} from "../schemas/workspace-members.schema.ts";

const router = Router();

/**
 * @openapi
 * /workspaces/{workspaceId}/members:
 *   post:
 *     summary: Add a member to a workspace (admin only)
 *     tags: [Workspace Members]
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
 *             required: [email, role]
 *             properties:
 *               email: { type: string, example: "member@example.com" }
 *               role: { type: string, enum: [admin, member], example: "member" }
 *     responses:
 *       201:
 *         description: Member added successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       403:
 *         description: Forbidden — requester is not a workspace admin
 *       404:
 *         description: Workspace not found
 */
router.post(
  "/:workspaceId/members",
  requireAuth,
  generalLimiter,
  validate(workspaceMembersPostSchema),
  postWorkspaceMembers,
);

/**
 * @openapi
 * /workspaces/{workspaceId}/members:
 *   get:
 *     summary: List all members of a workspace
 *     tags: [Workspace Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of members retrieved successfully
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       404:
 *         description: Workspace not found
 */
router.get(
  "/:workspaceId/members",
  requireAuth,
  generalLimiter,
  getWorkspaceMembers,
);

/**
 * @openapi
 * /workspaces/{workspaceId}/members/{userId}:
 *   patch:
 *     summary: Update a member's role (admin only)
 *     tags: [Workspace Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role: { type: string, enum: [admin, member] }
 *     responses:
 *       200:
 *         description: Member updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       403:
 *         description: Forbidden — requester is not a workspace admin
 *       404:
 *         description: Member not found
 */
router.patch(
  "/:workspaceId/members/:userId",
  requireAuth,
  generalLimiter,
  validate(workspaceMembersPatchSchema),
  patchWorkspaceMembersById,
);

/**
 * @openapi
 * /workspaces/{workspaceId}/members/{userId}:
 *   delete:
 *     summary: Remove a member from a workspace (admin only)
 *     tags: [Workspace Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Member removed successfully
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       403:
 *         description: Forbidden — requester is not a workspace admin
 *       404:
 *         description: Member not found
 */
router.delete(
  "/:workspaceId/members/:userId",
  requireAuth,
  generalLimiter,
  deleteWorkspaceMembersById,
);

export default router;

/**
 * @openapi
 * /workspaces/{workspaceId}/members/{userId}/reset-password:
 *   post:
 *     summary: Reset a member's password to a new temporary one (admin only)
 *     description: >
 *       Only works if the member hasn't changed their own password yet
 *       (mustChangePassword is still true). Returns a new temporary password
 *       once — it is never stored or retrievable again after this response.
 *     tags: [Workspace Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       403:
 *         description: Forbidden — requester is not a workspace admin, is resetting their own password, or the member has already set their own password
 *       404:
 *         description: Member not found
 */
router.post(
  "/:workspaceId/members/:userId/reset-password",
  requireAuth,
  authLimiter,
  resetMemberPassword,
);
