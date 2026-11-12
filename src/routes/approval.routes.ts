import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.ts";
import { notImplemented } from "./not-implemented.ts";

const approvalRouter = Router();
approvalRouter.use(requireAuth);

// /v1/api/approvals
approvalRouter.get("/", notImplemented); // List pending approvals.
approvalRouter.get("/:approvalId", notImplemented); // Exact action preview.
approvalRouter.post("/:approvalId/decision", notImplemented); // Approve or reject.

export default approvalRouter;
