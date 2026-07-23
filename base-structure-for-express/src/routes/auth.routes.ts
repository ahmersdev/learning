import { Router } from "express";
import {
  refresh,
  signin,
  signout,
  signup,
} from "../controllers/auth.controller.ts";
import { validate } from "../middlewares/validate.middleware.ts";
import { signinSchema, signupSchema } from "../schemas/auth.schema.ts";
import {
  authLimiter,
  refreshLimiter,
} from "../middlewares/rate-limiter.middleware.ts";

const router = Router();

/**
 * @openapi
 * /auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, username, email, password]
 *             properties:
 *               fullName: { type: string, example: "John Doe" }
 *               username: { type: string, example: "johndoe" }
 *               email: { type: string, example: "john@example.com" }
 *               password: { type: string, example: "Password1!" }
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation failed
 */
router.post("/signup", authLimiter, validate(signupSchema), signup);

/**
 * @openapi
 * /auth/signin:
 *   post:
 *     summary: Sign in an existing user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               username: { type: string, example: "johndoe" }
 *               email: { type: string, example: "john@example.com" }
 *               password: { type: string, example: "Password1!" }
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Validation failed
 */
router.post("/signin", authLimiter, validate(signinSchema), signin);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Get a new access token using the refresh token cookie
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: New access token issued
 *       401:
 *         description: Missing, invalid, or expired refresh token
 */
router.post("/refresh", refreshLimiter, refresh);

/**
 * @openapi
 * /auth/signout:
 *   post:
 *     summary: Sign out and clear the refresh token cookie
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post("/signout", signout);

export default router;
