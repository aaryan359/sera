import type { RequestHandler } from "express";
import ApiResponse from "../utils/ApiResponse.ts";

// Replace this handler with the corresponding controller as each feature is built.
export const notImplemented: RequestHandler = (_req, res) => {
    ApiResponse.error(res, {
        statusCode: 501,
        message: "This endpoint is not implemented yet",
        error: "NOT_IMPLEMENTED",
    });
};
