import { Router } from "express";
import {
    RegisterUser,
    Login,
    updateUser,
    updateProfilePicture,
    checkAuth,
} from "../controllers/user.controller.ts";
import { requireAuth } from "../middleware/auth.middleware.ts";
import { notImplemented } from "./not-implemented.ts";

const userRouter = Router();

// Public routes (Google OAuth)
userRouter.post("/register", RegisterUser);
userRouter.post("/login", Login);

// Protected routes
userRouter.get("/check-auth", requireAuth, checkAuth);
userRouter.get("/verifyauth", requireAuth, checkAuth);
userRouter.put("/update", requireAuth, updateUser);
userRouter.put("/profile-picture", requireAuth, updateProfilePicture);

// Account data export and deletion.
userRouter.post("/me/export", requireAuth, notImplemented);
userRouter.delete("/me", requireAuth, notImplemented);

export default userRouter;
