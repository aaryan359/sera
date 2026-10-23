import { Router } from "express";
import userRouter from "./user.routes.ts";

const router = Router();

// Mount user routes at /users and /auth for convenience
router.use("/users", userRouter);
router.use("/auth", userRouter);

export default router;
