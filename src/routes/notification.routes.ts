import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.ts";
import { notImplemented } from "./not-implemented.ts";

const notificationRouter = Router();
notificationRouter.use(requireAuth);

// /v1/api/notifications
notificationRouter.get("/", notImplemented); // List notifications.
notificationRouter.patch("/:notificationId", notImplemented); // Mark as read.

export default notificationRouter;
