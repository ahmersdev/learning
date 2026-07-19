import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.ts";
import { validate } from "../middlewares/validate.middleware.ts";
import { generalLimiter } from "../middlewares/rate-limiter.middleware.ts";
import { userSchema } from "../schemas/users.schema.ts";
import { getUser, patchUser } from "../controllers/users.controller.ts";

const router = Router();

/**
 * @openapi
 * /users/me:
 *   get:
 *     summary: Get the currently authenticated user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: "success" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id: { type: string }
 *                         fullName: { type: string }
 *                         username: { type: string }
 *                         email: { type: string }
 *       401:
 *         description: Unauthorized — missing or invalid access token
 */
router.get("/me", requireAuth, generalLimiter, getUser);

/**
 * @openapi
 * /users/me:
 *   patch:
 *     summary: Update the currently authenticated user's fullName and/or username
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string, example: "Jane Doe" }
 *               username: { type: string, example: "janedoe" }
 *             description: At least one of fullName or username must be provided
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation failed (e.g. empty body, invalid field values)
 *       401:
 *         description: Unauthorized — missing or invalid access token
 */
router.patch(
  "/me",
  requireAuth,
  generalLimiter,
  validate(userSchema),
  patchUser,
);

export default router;
