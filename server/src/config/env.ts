/**
 * Centralized environment configuration.
 *
 * ALL environment variable access in the server goes through this module.
 * Never read `process.env.*` directly in route files or middleware.
 *
 * SOLID: Single Responsibility — one place owns configuration.
 */

import dotenv from "dotenv";
import path from "path";

// Load .env relative to the server root (works in both ts-node and compiled dist/)
dotenv.config({ path: path.join(__dirname, "../../.env") });

// ── Server ───────────────────────────────────────────────────
export const PORT = parseInt(process.env.PORT || "4000", 10);
export const NODE_ENV = process.env.NODE_ENV || "development";
export const IS_PRODUCTION = NODE_ENV === "production";
export const IS_DEV = !IS_PRODUCTION;

// ── CORS ─────────────────────────────────────────────────────
export const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// ── Auth / JWT ────────────────────────────────────────────────
export const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// ── Database ─────────────────────────────────────────────────
export const DB = {
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
  database: process.env.POSTGRES_DB || "chatx",
  user: process.env.POSTGRES_USER || "chatx",
  password: process.env.POSTGRES_PASSWORD || "chatx_secret",
};

// ── SMS ───────────────────────────────────────────────────────
export const SMS_PROVIDER = (process.env.SMS_PROVIDER || "console").toLowerCase();
