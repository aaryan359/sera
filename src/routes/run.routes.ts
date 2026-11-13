import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.ts";
import { notImplemented } from "./not-implemented.ts";
import { RunController } from "../controllers/run.controller.ts";

const runRouter = Router();
runRouter.use(requireAuth);

// /v1/api/runs
runRouter.get("/", notImplemented); // List task runs.
runRouter.get("/:runId", RunController.getRun); // Status, result or failure.
runRouter.get("/:runId/events", notImplemented); // Live progress through SSE.
runRouter.post("/:runId/cancel", RunController.cancelRun); // Request cancellation.
runRouter.get("/:runId/actions", notImplemented); // Actions and receipts.

export default runRouter;
