import { NextResponse } from "next/server";
import { store } from "../../store";

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_VERIFY_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

export async function POST(request: Request) {
  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber || !/^\+?[0-9]{7,15}$/.test(phoneNumber.replace(/\s/g, ""))) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    const normalizedPhone = phoneNumber.replace(/\s/g, "");

    // Find or create user
    let user = store.findUserByPhone(normalizedPhone);
    if (!user) {
      user = store.createUser(normalizedPhone);
    }

    if (TWILIO_SID && TWILIO_TOKEN && TWILIO_VERIFY_SID) {
      // Send OTP via Twilio Verify API (works on trial accounts!)
      console.log(`📱 Sending Twilio Verify OTP to ${normalizedPhone}...`);

      const verifyUrl = `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SID}/Verifications`;

      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: normalizedPhone,
          Channel: "sms",
        }).toString(),
      });

      const verifyData = await verifyRes.json();
      console.log("📱 Twilio Verify response:", JSON.stringify(verifyData));

      if (!verifyRes.ok) {
        console.error("Twilio Verify error:", verifyData);
        // Fall back to dev mode if Twilio fails (e.g. unverified number on trial)
        console.log(`⚠️ Twilio failed (${verifyData.error_code || verifyData.message}), falling back to dev mode`);
        const code = Array.from({ length: 6 }, () =>
          Math.floor(Math.random() * 10).toString()
        ).join("");
        store.createOtp(normalizedPhone, code, user.id);
        console.log(`📱 OTP for ${normalizedPhone}: ${code} (Twilio fallback — dev mode)`);
        return NextResponse.json({
          message: "OTP sent (dev mode)",
          otp: code,
          devMode: true,
        });
      }

      // Store the verification SID for later checking
      store.createOtp(normalizedPhone, "", user.id, verifyData.sid);

      console.log(`📱 Verify OTP sent to ${normalizedPhone}, SID: ${verifyData.sid}`);

      return NextResponse.json({
        message: "OTP sent via SMS",
      });
    } else {
      // Console fallback for development
      const code = Array.from({ length: 6 }, () =>
        Math.floor(Math.random() * 10).toString()
      ).join("");
      store.createOtp(normalizedPhone, code, user.id);

      console.log(`📱 OTP for ${normalizedPhone}: ${code} (no Twilio credentials)`);
      return NextResponse.json({
        message: "OTP sent",
        otp: code, // Dev-only
      });
    }
  } catch (err) {
    console.error("Send OTP error:", err);
    return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 });
  }
}
