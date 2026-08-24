/**
 * Conversation routes.
 *
 * Routes:
 *   GET  /api/conversations       — list user's conversations
 *   POST /api/conversations       — create direct or group conversation
 *   GET  /api/conversations/:id   — get single conversation
 *
 * All routes require a valid JWT (enforced by `authenticate` middleware).
 */

import { Router, Request, Response } from "express";
import { pool } from "../db/pool";
import { ConversationRepository } from "../repositories";
import { authenticate, AuthRequest } from "../middleware";

const router = Router();
const convRepo = new ConversationRepository(pool);

// All routes in this file require authentication
router.use(authenticate);

// ── GET / ─────────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthRequest;
    const conversations = await convRepo.findForUser(userId);
    res.json({ conversations });
  } catch (err) {
    console.error("List conversations error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST / ────────────────────────────────────────────────────
router.post("/", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthRequest;
    const { type, name, memberIds } = req.body;

    if (!type || !["direct", "group"].includes(type)) {
      return res.status(400).json({ error: "Type must be 'direct' or 'group'" });
    }
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: "memberIds array required" });
    }
    if (type === "direct" && memberIds.length !== 1) {
      return res.status(400).json({ error: "Direct chats require exactly 1 other member" });
    }

    // For direct chat: return existing if one already exists
    if (type === "direct") {
      const existingId = await convRepo.findDirectBetween(userId, memberIds[0]);
      if (existingId) {
        const existing = await convRepo.findById(existingId);
        return res.json({ conversation: existing, alreadyExisted: true });
      }
    }

    // Deduplicate: creator is always included
    const allMembers = [userId, ...memberIds.filter((id: string) => id !== userId)];
    const conversation = await convRepo.create(type, name ?? null, allMembers);

    res.status(201).json({ conversation });
  } catch (err) {
    console.error("Create conversation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /:id ──────────────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthRequest;
    const id = req.params.id as string;

    if (!(await convRepo.isMember(id, userId))) {
      return res.status(403).json({ error: "Not a member of this conversation" });
    }

    const conversation = await convRepo.findById(id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json({ conversation });
  } catch (err) {
    console.error("Get conversation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
