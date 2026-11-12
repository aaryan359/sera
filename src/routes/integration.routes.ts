import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.ts";
import { notImplemented } from "./not-implemented.ts";

const integrationRouter = Router();

// /v1/api/integrations
integrationRouter.get("/", requireAuth, notImplemented); // Supported integrations and status.
integrationRouter.post("/google/start", requireAuth, notImplemented); // Begin OAuth consent.
// The callback will validate OAuth state/PKCE rather than require a bearer header.
integrationRouter.get("/google/callback", notImplemented);

export default integrationRouter;
