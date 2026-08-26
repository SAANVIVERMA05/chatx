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

// ── Typing rate-limit & idle-stop state ─────────────────────────────────────
// Key: `${userId}:${conversationId}`
const typingLastBroadcast = new Map<string, number>();
const typingIdleTimers = new Map<string, NodeJS.Timeout>();

const TYPING_RATE_MS = 1500;  // minimum ms between server broadcasts
const TYPING_IDLE_MS = 3000;  // ms of silence before auto-stop

function clearTypingIdle(
  io: Server,
  userId: string,
  username: string,
  conversationId: string
): void {
  const key = `${userId}:${conversationId}`;
  const existing = typingIdleTimers.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    io.to(`conv:${conversationId}`).emit("typing:stop", { userId, conversationId });
    typingIdleTimers.delete(key);
    typingLastBroadcast.delete(key);
  }, TYPING_IDLE_MS);

  typingIdleTimers.set(key, timer);
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
  io.on("connection", async (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    const username = socket.username!;
    console.log(`⚡ ${username} connected (${socket.id})`);

    // Personal room for targeted delivery/read notifications
    socket.join(`user:${userId}`);

    // ── Reconnect delivery flush ──────────────────────────────
    // On every connection (including reconnects) fan-out delivery events for
    // all un-delivered messages the user should have received by now.
    // This covers conversations they weren't actively joined to at connect time.
    try {
      const pending = await messageRepo.getPendingDelivered(userId);
      // markDelivered per conversation, then notify each sender
      const byConv = new Map<string, typeof pending>();
      for (const row of pending) {
        const arr = byConv.get(row.conversation_id) ?? [];
        arr.push(row);
        byConv.set(row.conversation_id, arr);
      }
      for (const [conversationId, rows] of byConv) {
        try {
          const delivered = await messageRepo.markDelivered(conversationId, userId);
          for (const row of delivered) {
            io.to(`user:${row.sender_id}`).emit("message:delivered", {
              messageId: row.id,
              chatId: conversationId,
            });
          }
        } catch { /* individual conv failure shouldn't abort others */ }
      }
    } catch (err) {
      console.warn("Reconnect delivery flush skipped (no DB?):", (err as Error).message);
    }

    // ── Room management ──────────────────────────────────────
    socket.on("conversation:join", async (conversationId: string) => {
      socket.join(`conv:${conversationId}`);
      console.log(`  ${username} joined conv:${conversationId}`);

      // ── Real delivery receipts ────────────────────────────
      // Mark all un-delivered messages (not sent by this user) as delivered.
      // Fan-out individual { type:"delivered", msgId } to each sender's personal room.
      try {
        const delivered = await messageRepo.markDelivered(conversationId, userId);
        for (const row of delivered) {
          io.to(`user:${row.sender_id}`).emit("message:delivered", {
            messageId: row.id,
            chatId: conversationId,
          });
        }
      } catch (err) {
        // DB unavailable in dev mode without PostgreSQL — silently continue
        console.warn("markDelivered skipped (no DB?):", (err as Error).message);
      }
    });

    socket.on("conversation:leave", (conversationId: string) => {
      socket.leave(`conv:${conversationId}`);
    });

    // ── Send message ─────────────────────────────────────────
    socket.on(
      "message:send",
      async (data: {
        conversationId: string;
        ciphertext: string;
        nonce: string;
        ratchetHeader: Record<string, unknown>;
        msgNumber: number;
        tempId?: string;          // client optimistic ID — echoed back in message:sent
        messageType?: string;
        fileUrl?: string;
        fileName?: string;
        fileSize?: string;
        replyTo?: { id: string; content: string; senderName: string };
      }) => {
        try {
          const { conversationId, ciphertext, nonce, ratchetHeader, msgNumber, messageType, fileUrl, fileName, fileSize, replyTo, tempId } = data;
          if (!ciphertext && !fileUrl) return;

          let message: Record<string, unknown>;

          try {
            // Persist to DB via repository (no raw SQL here)
            const dbMsg = await messageRepo.insert({
              conversationId,
              senderId: userId,
              ciphertext: ciphertext || "",
              nonce: nonce || "",
              ratchetHeader: ratchetHeader || {},
              msgNumber: typeof msgNumber === 'number' ? msgNumber : 0,
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
              ciphertext: ciphertext || "",
              nonce: nonce || "",
              ratchet_header: ratchetHeader || {},
              msg_number: msgNumber || 0,
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

          // Confirm to sender — status starts as "sent"; echo tempId for optimistic replacement
          socket.emit("message:sent", { ...message, status: "sent", tempId: tempId ?? null });
        } catch (err) {
          console.error("Socket message:send error:", err);
          socket.emit("message:error", { error: "Failed to send message" });
        }
      }
    );

    // ── Typing indicators (structured payload + rate limiting) ─
    socket.on(
      "typing:start",
      (data: { conversationId: string; userId?: string }) => {
        // Accept both old bare-string and new object forms for backwards compat
        const conversationId =
          typeof data === "string" ? (data as unknown as string) : data.conversationId;
        if (!conversationId) return;

        const key = `${userId}:${conversationId}`;
        const now = Date.now();
        const last = typingLastBroadcast.get(key) ?? 0;

        // Server-side rate limit: drop events that arrive too fast
        if (now - last < TYPING_RATE_MS) {
          // Still reset the idle timer so the 3s window is extended correctly
          clearTypingIdle(io, userId, username, conversationId);
          return;
        }

        typingLastBroadcast.set(key, now);

        // Broadcast to others in the room (not back to sender)
        socket.to(`conv:${conversationId}`).emit("typing:start", {
          userId,
          username,
          conversationId,
        });

        // Arm (or re-arm) the 3s server-side idle auto-stop
        clearTypingIdle(io, userId, username, conversationId);
      }
    );

    socket.on(
      "typing:stop",
      (data: { conversationId: string } | string) => {
        const conversationId =
          typeof data === "string" ? data : data.conversationId;
        if (!conversationId) return;

        const key = `${userId}:${conversationId}`;

        // Cancel any pending idle timer
        const existing = typingIdleTimers.get(key);
        if (existing) clearTimeout(existing);
        typingIdleTimers.delete(key);
        typingLastBroadcast.delete(key);

        socket.to(`conv:${conversationId}`).emit("typing:stop", {
          userId,
          conversationId,
        });
      }
    );

    // ── Mark messages as read ─────────────────────────────────
    socket.on("messages:read", async (conversationId: string) => {
      try {
        const readRows = await messageRepo.markRead(conversationId, userId);

        // Fan-out per-message read events to each sender's personal room
        for (const row of readRows) {
          io.to(`user:${row.sender_id}`).emit("message:read", {
            messageId: row.id,
            chatId: conversationId,
          });
        }

        // Also broadcast bulk event to the room (for recipient's own UI cleanup)
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

      // Clean up all pending typing timers for this user
      for (const [key, timer] of typingIdleTimers.entries()) {
        if (key.startsWith(`${userId}:`)) {
          clearTimeout(timer);
          typingIdleTimers.delete(key);
          typingLastBroadcast.delete(key);
          // Extract conversationId and send stop event
          const conversationId = key.slice(userId.length + 1);
          io.to(`conv:${conversationId}`).emit("typing:stop", {
            userId,
            conversationId,
          });
        }
      }
    });
  });
}
