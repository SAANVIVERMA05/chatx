/**
 * Shared JWT authentication middleware.
 *
 * Extracted from conversations.ts and messages.ts where it was copy-pasted.
 *
 * SOLID:
 *   - SRP: This file's only job is to verify JWT and attach userId to the request.
 *   - OCP: Add new auth strategies (API key, session) without modifying route files.
 *   - DIP: Routes depend on this abstraction, not on jwt directly.
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env";

/**
 * Extends Express Request with the authenticated user's ID.
 * Use `AuthRequest` instead of `Request` in protected route handlers.
 */
export interface AuthRequest extends Request {
  userId: string;
}

/**
 * Express middleware that verifies the Bearer JWT token.
 * On success: attaches `req.userId` and calls `next()`.
 * On failure: responds 401.
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    (req as AuthRequest).userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
