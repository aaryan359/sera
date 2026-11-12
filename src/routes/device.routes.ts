import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.ts";
import { notImplemented } from "./not-implemented.ts";

const deviceRouter = Router();
deviceRouter.use(requireAuth);

// /v1/api/devices
deviceRouter.post("/", notImplemented); // Register a device/push token.
deviceRouter.delete("/:deviceId", notImplemented); // Unregister a device.

export default deviceRouter;
