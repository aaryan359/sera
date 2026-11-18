import { Router } from "express";
import { UserController } from "../controllers/user.controller.ts";
import { requireAuth } from "../middleware/auth.middleware.ts";

const authRouter = Router();

// /api/v1/auth
authRouter.get("/check-auth", requireAuth, UserController.checkAuth);
// authRouter.post("/logout", requireAuth, UserController.LogoutUser);

authRouter.post("/authenticate", UserController.authenticate);





export default authRouter;
