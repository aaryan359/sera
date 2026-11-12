import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.ts";
import { notImplemented } from "./not-implemented.ts";

const connectionRouter = Router();
connectionRouter.use(requireAuth);

// /v1/api/connections
connectionRouter.delete("/:connectionId", notImplemented); // Disconnect an account.
connectionRouter.get("/:connectionId/grants", notImplemented); // List tool permissions.
connectionRouter.put("/:connectionId/grants/:toolName", notImplemented); // Enable/update permission.
connectionRouter.delete("/:connectionId/grants/:toolName", notImplemented); // Revoke permission.

export default connectionRouter;
