import { Router } from "express";
import {
    RegisterUser,
    Login,
    checkAuth,
    updateUser,
    updateProfilePicture,
} from "../controllers/user.controller.ts";
import { requireAuth } from "../middleware/auth.middleware.ts";

const authRouter = Router();

// /v1/api/auth
authRouter.post("/register", RegisterUser);
authRouter.post("/login", Login);
authRouter.get("/check-auth", requireAuth, checkAuth);

// Existing aliases kept for compatibility.
authRouter.get("/verifyauth", requireAuth, checkAuth);
authRouter.put("/update", requireAuth, updateUser);
authRouter.put("/profile-picture", requireAuth, updateProfilePicture);

export default authRouter;
