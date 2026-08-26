/**
 * ChatX Server — entry point.
 *
 * Responsibilities:
 *   1. Boot Express + Socket.io
 *   2. Test DB connection
 *   3. Run pending migrations
 *   4. Mount routes
 *   5. Start HTTP listener
 *
 * All configuration comes from `config/env.ts`.
 */

import "dotenv/config"; // Loads .env before any other import
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { pool, testConnection } from "./db/pool";
import { PORT, NODE_ENV, CORS_ORIGIN } from "./config/env";
import authRoutes from "./routes/auth";
import otpRoutes from "./routes/otp";
import conversationRoutes from "./routes/conversations";
import messageRoutes from "./routes/messages";
import uploadRoutes from "./routes/uploads";
import keysRoutes from "./routes/keys";
import { setupSocketHandlers } from "./socket";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

// ── Global Middleware ─────────────────────────────────────────
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// ── Health Check ─────────────────────────────────────────────
app.get("/health", async (_req, res) => {
  try {
    const [ok, time] = await Promise.all([
      pool.query("SELECT 1 AS ok"),
      pool.query("SELECT NOW() AS time"),
    ]);
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      database: {
        connected: ok.rows[0].ok === 1,
        time: time.rows[0].time,
        host: process.env.POSTGRES_HOST,
        name: process.env.POSTGRES_DB,
      },
    });
  } catch (err) {
    res.status(503).json({
      status: "error",
      message: "Database connection failed",
      error: (err as Error).message,
    });
  }
});

// ── Routes ───────────────────────────────────────────────────
app.use("/api/auth", otpRoutes);              // OTP-based auth (primary)
app.use("/api/auth/legacy", authRoutes);      // Legacy password auth (deprecated)
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/keys", keysRoutes);

// Static file serving for uploads
app.use("/uploads", express.static("uploads"));

// ── Socket.io ────────────────────────────────────────────────
setupSocketHandlers(io);

// ── Boot ─────────────────────────────────────────────────────
async function start(): Promise<void> {
  console.log(`\n🚀 ChatX Server — ${NODE_ENV}`);
  console.log("─".repeat(40));

  const dbOk = await testConnection();
  if (!dbOk) {
    console.warn("⚠ DB unavailable — Socket.io still active, REST routes may fail");
  }

  if (dbOk) {
    try {
      const { runMigration } = await import("./db/migrate");
      await runMigration();
      console.log("✓ Migration complete");
    } catch (err) {
      console.warn("⚠ Migration skipped:", (err as Error).message);
    }
  }

  httpServer.listen(PORT, () => {
    console.log(`✓ HTTP:     http://localhost:${PORT}`);
    console.log(`✓ Socket.io ready`);
    console.log(`✓ Health:   http://localhost:${PORT}/health`);
    console.log("─".repeat(40) + "\n");
  });
}

start();
