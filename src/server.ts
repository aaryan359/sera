import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { config } from "./config.ts";
import router from "./routes/index.ts";
import ApiResponse from "./utils/ApiResponse.ts";

const app = express();
const API_PREFIX = "/v1/api";

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

app.get("/health", (_req, res) => {
    res.status(200).json({ status: "healthy" });
});

app.get(API_PREFIX, (_req, res) => {
    ApiResponse.success(res, { message: "Sera API v1" });
});

app.use(API_PREFIX, router);

app.use((_req, res) => {
    ApiResponse.error(res, {
        statusCode: 404,
        message: "Route not found",
        error: "NOT_FOUND",
    });
});

const handleError: ErrorRequestHandler = (err, _req, res, next) => {
    if (res.headersSent) {
        next(err);
        return;
    }

    const status = Number(err?.status);
    const statusCode = Number.isInteger(status) && status >= 400 && status < 500 ? status : 500;
    ApiResponse.error(res, {
        statusCode,
        message: statusCode < 500 ? "Invalid request" : "Internal server error",
    });
};

app.use(handleError);

app.listen(config.port, () => {
    console.log(`Sera API running on port ${config.port} at ${API_PREFIX}`);
});
