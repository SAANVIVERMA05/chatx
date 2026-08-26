/**
 * Message routes.
 *
 * Routes:
 *   GET  /api/messages/:conversationId       — paginated message history
 *   POST /api/messages/:conversationId       — send a message via REST
 *   PUT  /api/messages/:conversationId/read  — mark all messages as read
 *
 * All routes require a valid JWT (enforced by `authenticate` middleware).
 *
 * Note: Real-time message sending happens over Socket.io (server/src/socket.ts).
 *       The POST route here is a REST fallback for environments without WebSocket support.
 */

import { Router, Request, Response } from "express";
import { pool } from "../db/pool";
import { MessageRepository, ConversationRepository } from "../repositories";
import { authenticate, AuthRequest } from "../middleware";

const router = Router();
const messageRepo = new MessageRepository(pool);
const convRepo = new ConversationRepository(pool);

// All routes in this file require authentication
router.use(authenticate);

// ── GET /:conversationId ──────────────────────────────────────
router.get("/:conversationId", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthRequest;
    const conversationId = req.params.conversationId as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const before = req.query.before as string | undefined;

    if (!(await convRepo.isMember(conversationId, userId))) {
      return res.status(403).json({ error: "Not a member of this conversation" });
    }

    const messages = await messageRepo.getForConversation(conversationId, limit, before);
    res.json({ messages });
  } catch (err) {
    console.error("List messages error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /:conversationId ─────────────────────────────────────
router.post("/:conversationId", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthRequest;
    const conversationId = req.params.conversationId as string;
    const { ciphertext, nonce, ratchetHeader, msgNumber } = req.body;

    if (!ciphertext || !nonce || !ratchetHeader) {
      return res.status(400).json({ error: "E2E fields required" });
    }

    if (!(await convRepo.isMember(conversationId, userId))) {
      return res.status(403).json({ error: "Not a member of this conversation" });
    }

    const message = await messageRepo.insert({
      conversationId,
      senderId: userId,
      ciphertext,
      nonce,
      ratchetHeader,
      msgNumber: typeof msgNumber === 'number' ? msgNumber : 0,
    });

    res.status(201).json({ message });
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /:conversationId/read ─────────────────────────────────
router.put("/:conversationId/read", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthRequest;
    const conversationId = req.params.conversationId as string;

    await messageRepo.markRead(conversationId, userId);
    res.json({ ok: true });
  } catch (err) {
    console.error("Mark read error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
