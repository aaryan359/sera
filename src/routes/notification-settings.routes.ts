import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.ts";
import { notImplemented } from "./not-implemented.ts";

const notificationSettingsRouter = Router();
notificationSettingsRouter.use(requireAuth);

// /v1/api/notification-settings
notificationSettingsRouter.get("/", notImplemented); // Preferences and quiet hours.
notificationSettingsRouter.patch("/", notImplemented); // Update preferences.

export default notificationSettingsRouter;
