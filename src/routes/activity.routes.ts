import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.ts";
import { notImplemented } from "./not-implemented.ts";

const activityRouter = Router();
activityRouter.use(requireAuth);

// /v1/api/activity
activityRouter.get("/", notImplemented); // Action history.
activityRouter.get("/:activityId", notImplemented); // Details and evidence.

export default activityRouter;
