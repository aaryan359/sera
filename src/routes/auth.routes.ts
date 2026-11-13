import { Router } from "express";
import { UserController } from "../controllers/user.controller.ts";
import { requireAuth } from "../middleware/auth.middleware.ts";

const authRouter = Router();

// /v1/api/auth
authRouter.post("/register", UserController.RegisterUser);
authRouter.post("/login", UserController.Login);
authRouter.get("/check-auth", requireAuth, UserController.checkAuth);

// Existing aliases kept for compatibility.
authRouter.get("/verifyauth", requireAuth, UserController.checkAuth);
authRouter.put("/update", requireAuth, UserController.updateUser);
authRouter.put("/profile-picture", requireAuth, UserController.updateProfilePicture);

export default authRouter;
