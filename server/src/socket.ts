/**
 * Socket.io event handlers.
 *
 * This module handles ONLY the WebSocket transport layer:
 *   - Auth middleware (verify JWT or dev credentials)
 *   - Event routing (join/leave rooms, forward events)
 *   - Delegates DB work to MessageRepository (SRP)
 *
 * SOLID:
 *   - SRP: Socket.ts routes events; it does NOT write SQL directly.
 *   - DIP: Depends on MessageRepository abstraction, not `pool`.
 */

import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { pool } from "./db/pool";
import { MessageRepository } from "./repositories";
import { JWT_SECRET, IS_DEV } from "./config/env";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

export function setupSocketHandlers(io: Server): void {
  const messageRepo = new MessageRepository(pool);

  // ── Auth Middleware ──────────────────────────────────────────
  io.use((socket: AuthenticatedSocket, next) => {
    const { token, userId, username } = socket.handshake.auth;

    // Dev mode: accept userId + username directly (from Next.js in-memory store)
    if (IS_DEV && userId && username) {
      socket.userId = userId;
      socket.username = username;
      next();
      return;
    }

    // Production: require JWT
    if (!token) {
      return next(new Error("Authentication required"));
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        username: string;
      };
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  // ── Connection ───────────────────────────────────────────────
  io.on("connection", (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    const username = socket.username!;
    console.log(`⚡ ${username} connected (${socket.id})`);

    // Personal room for targeted notifications
    socket.join(`user:${userId}`);

    // ── Room management ──────────────────────────────────────
    socket.on("conversation:join", (conversationId: string) => {
      socket.join(`conv:${conversationId}`);
      console.log(`  ${username} joined conv:${conversationId}`);
    });

    socket.on("conversation:leave", (conversationId: string) => {
      socket.leave(`conv:${conversationId}`);
    });

    // ── Send message ─────────────────────────────────────────
    socket.on(
      "message:send",
      async (data: {
        conversationId: string;
        content: string;
        messageType?: string;
        fileUrl?: string;
        fileName?: string;
        fileSize?: string;
        replyTo?: { id: string; content: string; senderName: string };
      }) => {
        try {
          const { conversationId, content, messageType, fileUrl, fileName, fileSize, replyTo } = data;
          if (!content?.trim() && !fileUrl) return;

          let message: Record<string, unknown>;

          try {
            // Persist to DB via repository (no raw SQL here)
            const dbMsg = await messageRepo.insert({
              conversationId,
              senderId: userId,
              content: content?.trim() || "",
              messageType,
              fileUrl,
              fileName,
              fileSize,
            });
            message = { ...dbMsg, sender_username: username };
          } catch {
            // DB unavailable (e.g. dev mode without PostgreSQL): create synthetic message
            message = {
              id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              conversation_id: conversationId,
              sender_id: userId,
              sender_username: username,
              content: content?.trim() || "",
              created_at: new Date().toISOString(),
              delivered_at: null,
              read_at: null,
              message_type: messageType || "text",
              file_url: fileUrl ?? null,
              file_name: fileName ?? null,
              file_size: fileSize ?? null,
              reply_to: replyTo ?? null,
            };
          }

          // Broadcast to conversation room
          io.to(`conv:${conversationId}`).emit("message:new", message);

          // Confirm to sender
          socket.emit("message:sent", { ...message, status: "sent" });

          // Simulate delivery receipt after a short delay
          setTimeout(() => {
            socket.emit("message:delivered", {
              messageId: message.id,
              chatId: conversationId,
            });
          }, 500);
        } catch (err) {
          console.error("Socket message:send error:", err);
          socket.emit("message:error", { error: "Failed to send message" });
        }
      }
    );

    // ── Typing indicators ─────────────────────────────────────
    socket.on("typing:start", (conversationId: string) => {
      socket.to(`conv:${conversationId}`).emit("typing:start", {
        userId,
        username,
        conversationId,
      });
    });

    socket.on("typing:stop", (conversationId: string) => {
      socket.to(`conv:${conversationId}`).emit("typing:stop", {
        userId,
        conversationId,
      });
    });

    // ── Mark messages as read ─────────────────────────────────
    socket.on("messages:read", async (conversationId: string) => {
      try {
        await messageRepo.markRead(conversationId, userId);
        socket.to(`conv:${conversationId}`).emit("messages:read", {
          userId,
          conversationId,
        });
      } catch (err) {
        console.error("Socket messages:read error:", err);
      }
    });

    // ── Disconnect ────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`💤 ${username} disconnected (${socket.id})`);
    });
  });
}
