import { Router } from "express";
import { UserController } from "../controllers/user.controller.ts";
import { requireAuth } from "../middleware/auth.middleware.ts";
import { notImplemented } from "./not-implemented.ts";

const userRouter = Router();

// Protected routes
userRouter.get("/check-auth", requireAuth, UserController.checkAuth);
userRouter.get("/verifyauth", requireAuth, UserController.checkAuth);

// Account data export and deletion.
userRouter.post("/me/export", requireAuth, notImplemented);
userRouter.delete("/me", requireAuth, notImplemented);

export default userRouter;
