import { Router } from "express";
import userRouter from "./user.routes.ts";
import authRouter from "./auth.routes.ts";
import conversationRouter from "./conversation.routes.ts";
import runRouter from "./run.routes.ts";
import approvalRouter from "./approval.routes.ts";
import integrationRouter from "./integration.routes.ts";
import connectionRouter from "./connection.routes.ts";
import activityRouter from "./activity.routes.ts";
import scheduleRouter from "./schedule.routes.ts";
import deviceRouter from "./device.routes.ts";
import notificationRouter from "./notification.routes.ts";
import notificationSettingsRouter from "./notification-settings.routes.ts";

const router = Router();

// All routes below are mounted under /v1/api in server.ts.
router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/conversations", conversationRouter);
router.use("/runs", runRouter);
router.use("/approvals", approvalRouter);
router.use("/integrations", integrationRouter);
router.use("/connections", connectionRouter);
router.use("/activity", activityRouter);
router.use("/schedules", scheduleRouter);
router.use("/devices", deviceRouter);
router.use("/notifications", notificationRouter);
router.use("/notification-settings", notificationSettingsRouter);

export default router;
