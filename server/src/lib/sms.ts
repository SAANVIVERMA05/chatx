/**
 * SMS Service — sends OTP codes via configured provider.
 *
 * Providers:
 *   - "twilio"  → Twilio Programmable SMS (recommended)
 *   - "vonage"  → Vonage (Nexmo) SMS
 *   - "console" → Logs to console (default for development)
 *
 * Set SMS_PROVIDER in your .env file to choose.
 *
 * SOLID:
 *   - OCP: Add a new provider (e.g. AWS SNS) by implementing SmsProvider and
 *           adding a case in getSmsProvider(). No other file changes needed.
 *   - DIP: Callers use sendOtpSms(); they don't know which provider is active.
 */

import { SMS_PROVIDER } from "../config/env";

interface SmsProvider {
  send(to: string, body: string): Promise<{ sid: string; status: string }>;
}

// ── Console Provider (dev fallback) ─────────────────────────
class ConsoleSmsProvider implements SmsProvider {
  async send(to: string, body: string) {
    console.log(`\n📱 SMS → ${to}\n${body}\n`);
    return { sid: `console_${Date.now()}`, status: "delivered" };
  }
}

// ── Twilio Provider ─────────────────────────────────────────
class TwilioSmsProvider implements SmsProvider {
  private client: any;
  private fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_FROM_NUMBER || "";

    if (!accountSid || !authToken) {
      throw new Error(
        "Twilio credentials missing. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env"
      );
    }
    if (!this.fromNumber) {
      throw new Error("TWILIO_FROM_NUMBER is required");
    }

    // Lazy import — only loads twilio if configured
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const twilio = require("twilio");
    this.client = twilio(accountSid, authToken);

    console.log("✓ Twilio SMS provider initialized");
    console.log(`  From: ${this.fromNumber}`);
  }

  async send(to: string, body: string) {
    const message = await this.client.messages.create({
      body,
      from: this.fromNumber,
      to,
    });

    console.log(`  ✓ Twilio message sent: ${message.sid} → ${to}`);
    return { sid: message.sid, status: message.status };
  }
}

// ── Vonage (Nexmo) Provider ─────────────────────────────────
class VonageSmsProvider implements SmsProvider {
  private apiKey: string;
  private apiSecret: string;
  private fromNumber: string;

  constructor() {
    this.apiKey = process.env.VONAGE_API_KEY || "";
    this.apiSecret = process.env.VONAGE_API_SECRET || "";
    this.fromNumber = process.env.VONAGE_FROM_NUMBER || "";

    if (!this.apiKey || !this.apiSecret) {
      throw new Error(
        "Vonage credentials missing. Set VONAGE_API_KEY and VONAGE_API_SECRET in .env"
      );
    }
    if (!this.fromNumber) {
      throw new Error("VONAGE_FROM_NUMBER is required");
    }

    console.log("✓ Vonage SMS provider initialized");
    console.log(`  From: ${this.fromNumber}`);
  }

  async send(to: string, body: string) {
    // Vonage REST API via fetch
    const params = new URLSearchParams({
      api_key: this.apiKey,
      api_secret: this.apiSecret,
      from: this.fromNumber,
      to,
      text: body,
    });

    const response = await fetch("https://rest.nexmo.com/sms/json", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data: any = await response.json();

    if (data.messages?.[0]?.status !== "0") {
      const errorText = data.messages?.[0]?.["error-text"] || "Unknown error";
      throw new Error(`Vonage error: ${errorText}`);
    }

    const messageId = data.messages?.[0]?.["message-id"] || "unknown";
    console.log(`  ✓ Vonage message sent: ${messageId} → ${to}`);
    return { sid: messageId, status: "sent" };
  }
}

// ── Provider Factory ────────────────────────────────────────
let provider: SmsProvider | null = null;

function getSmsProvider(): SmsProvider {
  if (provider) return provider;

  const smsProvider = SMS_PROVIDER;

  switch (smsProvider) {
    case "twilio":
      provider = new TwilioSmsProvider();
      break;
    case "vonage":
      provider = new VonageSmsProvider();
      break;
    case "console":
    default:
      provider = new ConsoleSmsProvider();
      break;
  }

  return provider;
}

/**
 * Send an SMS message.
 * Falls back to console logging if no provider is configured.
 */
export async function sendSms(to: string, body: string) {
  const p = getSmsProvider();
  return p.send(to, body);
}

/**
 * Send an OTP code via SMS.
 * Formats a nice message with the code and expiry info.
 */
export async function sendOtpSms(
  to: string,
  code: string,
  expiryMinutes: number
) {
  const body = [
    `Your ChatX verification code is: ${code}`,
    ``,
    `This code expires in ${expiryMinutes} minutes.`,
    `Do not share this code with anyone.`,
  ].join("\n");

  return sendSms(to, body);
}
