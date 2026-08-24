/**
 * OTP-based authentication routes (primary auth method).
 *
 * Routes:
 *   POST /api/auth/send-otp       — request an OTP via SMS
 *   POST /api/auth/verify-otp     — exchange OTP for JWT
 *   POST /api/auth/update-profile — set display name after first login
 *   GET  /api/auth/me             — get current user from JWT
 */

import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db/pool";
import { UserRepository, OtpRepository } from "../repositories";
import { authenticate, AuthRequest } from "../middleware";
import { otpRateLimiter } from "../lib/rateLimit";
import { sendOtpSms } from "../lib/sms";
import { JWT_SECRET, JWT_EXPIRES_IN, SMS_PROVIDER } from "../config/env";

const router = Router();
const userRepo = new UserRepository(pool);
const otpRepo = new OtpRepository(pool);

const OTP_EXPIRY_MINUTES = 10;
const OTP_LENGTH = 6;

function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as string,
  } as jwt.SignOptions);
}

function generateOTP(): string {
  return Array.from({ length: OTP_LENGTH }, () =>
    Math.floor(Math.random() * 10).toString()
  ).join("");
}

function normalizePhone(raw: string): string {
  return raw.replace(/\s/g, "");
}

// ── POST /send-otp ────────────────────────────────────────────
router.post("/send-otp", async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber || !/^\+?[0-9]{7,15}$/.test(normalizePhone(phoneNumber))) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    const phone = normalizePhone(phoneNumber);

    // Rate limiting: max 3 OTP requests per phone per 10 minutes
    const rateLimit = otpRateLimiter.check(phone);
    if (!rateLimit.allowed) {
      const retryAfterSeconds = Math.ceil(rateLimit.retryAfterMs / 1000);
      res.setHeader("Retry-After", retryAfterSeconds.toString());
      return res.status(429).json({
        error: `Too many OTP requests. Try again in ${retryAfterSeconds} seconds.`,
        retryAfter: retryAfterSeconds,
      });
    }

    // Upsert user
    let user = await userRepo.findByPhone(phone);
    if (!user) {
      user = await userRepo.createWithPhone(
        `user_${phone.slice(-4)}_${Date.now()}`,
        phone
      );
    }

    // Invalidate old OTPs, then create new one
    await otpRepo.invalidatePrevious(phone);
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await otpRepo.create(phone, code, user.id, expiresAt);

    // Send via configured SMS provider
    let smsResult: { sid: string; status: string } | null = null;
    let smsError: string | null = null;

    try {
      smsResult = await sendOtpSms(phone, code, OTP_EXPIRY_MINUTES);
    } catch (err) {
      smsError = (err as Error).message;
      console.error("SMS send failed:", smsError);
    }

    const response: Record<string, unknown> = {
      message: smsResult ? "OTP sent" : "OTP generated (SMS delivery failed)",
      // Dev mode: include OTP in response when not using a real provider
      ...(SMS_PROVIDER !== "twilio" && SMS_PROVIDER !== "vonage" && { otp: code }),
    };

    if (smsError) response.smsError = smsError;
    if (smsResult) {
      response.smsSid = smsResult.sid;
      response.smsStatus = smsResult.status;
    }

    res.json(response);
  } catch (err) {
    console.error("Send OTP error:", err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// ── POST /verify-otp ──────────────────────────────────────────
router.post("/verify-otp", async (req: Request, res: Response) => {
  try {
    const { phoneNumber, code, name } = req.body;

    if (!phoneNumber || !code) {
      return res.status(400).json({ error: "Phone number and code required" });
    }

    const phone = normalizePhone(phoneNumber);

    const otp = await otpRepo.findValid(phone, code);
    if (!otp) {
      return res.status(401).json({ error: "Invalid OTP code" });
    }

    if (new Date(otp.expires_at) < new Date()) {
      return res.status(401).json({ error: "OTP expired. Please request a new one." });
    }

    await otpRepo.markUsed(otp.id);

    let user = await userRepo.findById(otp.user_id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update placeholder name if a real name was provided
    if (name && user.username.startsWith("user_")) {
      user = (await userRepo.updateUsername(user.id, name)) ?? user;
    }

    const token = generateToken(user.id);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        phone_number: phone,
        avatar_url: user.avatar_url,
      },
      token,
      isNewUser: user.username.startsWith("user_"),
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
});

// ── POST /update-profile ──────────────────────────────────────
router.post("/update-profile", authenticate, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: "Name must be at least 2 characters" });
    }

    const userId = (req as AuthRequest).userId;
    const user = await userRepo.updateUsername(userId, name.trim());
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ── GET /me ───────────────────────────────────────────────────
router.get("/me", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const user = await userRepo.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ user });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
