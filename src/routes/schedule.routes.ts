import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.ts";
import { notImplemented } from "./not-implemented.ts";

const scheduleRouter = Router();
scheduleRouter.use(requireAuth);

// /v1/api/schedules
scheduleRouter.post("/", notImplemented); // Create a recurring task.
scheduleRouter.get("/", notImplemented); // List schedules.
scheduleRouter.get("/:scheduleId", notImplemented); // Schedule details.
scheduleRouter.patch("/:scheduleId", notImplemented); // Edit, pause or resume.
scheduleRouter.delete("/:scheduleId", notImplemented); // Stop future runs.

export default scheduleRouter;
