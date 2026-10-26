import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3333,
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "",
  redisUrl: process.env.REDIS_URL || "",
  jwtSecret: process.env.JWT_SECRET || "sera_jwt_super_secret_dev_key_2026",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  // Self-hosted search (see compose.yaml). Defaults to the local SearXNG port.
  searxngUrl: process.env.SEARXNG_URL || `http://127.0.0.1:${process.env.SEARXNG_HOST_PORT || "18888"}`,
  // Greenhouse job boards to search, as a comma-separated list of board tokens, e.g. "stripe,airbnb".
  greenhouseBoards: (process.env.GREENHOUSE_BOARDS || "")
    .split(",")
    .map((board) => board.trim())
    .filter((board) => board !== ""),
};
