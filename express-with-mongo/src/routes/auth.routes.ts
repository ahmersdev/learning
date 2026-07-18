import { Router } from "express";
import { signin, signout, signup } from "../controllers/auth.controller.ts";
import { validate } from "../middlewares/validate.middleware.ts";
import { signinSchema, signupSchema } from "../schemas/auth.schema.ts";

const router = Router();

router.post("/signup", validate(signupSchema), signup);

router.post("/signin", validate(signinSchema), signin);

router.post("/signout", signout);

export default router;
