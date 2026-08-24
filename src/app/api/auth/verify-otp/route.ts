import { NextResponse } from "next/server";
import { store } from "../../store";

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_VERIFY_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

export async function POST(request: Request) {
  try {
    const { phoneNumber, code, name } = await request.json();

    if (!phoneNumber || !code) {
      return NextResponse.json({ error: "Phone number and code required" }, { status: 400 });
    }

    const normalizedPhone = phoneNumber.replace(/\s/g, "");

    // Check if there's an active OTP record for this phone
    const activeOtp = store.getActiveOtp(normalizedPhone);

    if (activeOtp?.request_id && TWILIO_SID && TWILIO_TOKEN && TWILIO_VERIFY_SID) {
      // ── Verify via Twilio Verify API ──
      const verifyUrl = `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SID}/VerificationCheck`;

      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: normalizedPhone,
          Code: code,
        }).toString(),
      });

      const verifyData = await verifyRes.json();
      console.log("📱 Twilio Verify check:", JSON.stringify(verifyData));

      if (!verifyRes.ok || verifyData.status !== "approved") {
        console.error("Twilio Verify check failed:", verifyData);
        return NextResponse.json({ error: "Invalid or expired OTP code" }, { status: 401 });
      }

      // Mark OTP as used
      activeOtp.used = true;
    } else {
      // ── Local verification (console fallback) ──
      const otp = store.verifyOtp(normalizedPhone, code);
      if (!otp) {
        return NextResponse.json({ error: "Invalid or expired OTP code" }, { status: 401 });
      }
    }

    // Find or create the user
    let user = store.findUserByPhone(normalizedPhone);
    if (!user) {
      user = store.createUser(normalizedPhone);
    }

    // Update name if provided and user has placeholder name
    const isNewUser = user.username.startsWith("user_");
    if (name && isNewUser) {
      store.updateUser(user.id, { username: name });
      user.username = name;
    }

    const token = store.generateToken(user.id);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        phone_number: user.phone_number,
        avatar_url: user.avatar_url,
      },
      token,
      isNewUser,
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return NextResponse.json({ error: "Failed to verify OTP" }, { status: 500 });
  }
}
