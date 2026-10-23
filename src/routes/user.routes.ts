import { Router } from "express";
import {
  RegisterUser,
  Login,
  updateUser,
  updateProfilePicture,
  checkAuth,
} from "../controllers/user.controller.ts";
import { requireAuth } from "../middleware/auth.middleware.ts";

const userRouter = Router();

// Public routes (Google OAuth)
userRouter.post("/register", RegisterUser);
userRouter.post("/login", Login);

// Protected routes
userRouter.get("/check-auth", requireAuth, checkAuth);
userRouter.get("/verifyauth", requireAuth, checkAuth);
userRouter.put("/update", requireAuth, updateUser);
userRouter.put("/profile-picture", requireAuth, updateProfilePicture);

export default userRouter;