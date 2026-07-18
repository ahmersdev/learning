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

router.post("/signup", authLimiter, validate(signupSchema), signup);

router.post("/signin", authLimiter, validate(signinSchema), signin);

router.post("/refresh", refreshLimiter, refresh);

router.post("/signout", signout);

export default router;
