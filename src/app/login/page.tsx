"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Phone, MessageSquare, ArrowLeft, Loader2, User } from "lucide-react";
import CountryCodeSelect from "@/components/CountryCodeSelect";

type Step = "phone" | "otp" | "name";

export default function LoginPage() {
  const [step, setStep] = useState<Step>("phone");
  const [dialCode, setDialCode] = useState("+1");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null);
  const [verifiedUser, setVerifiedUser] = useState<any>(null);
  const [resendTimer, setResendTimer] = useState(0);

  const { loginWithOtp } = useAuth();
  const router = useRouter();
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const verifySubmittedRef = useRef(false);

  // Resend countdown
  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

  // Focus first OTP input when step changes to otp
  useEffect(() => {
    if (step === "otp") {
      verifySubmittedRef.current = false;
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  // Auto-submit when all 6 OTP digits are entered (runs AFTER state updates)
  useEffect(() => {
    if (step === "otp" && otp.every((d) => d !== "") && !verifySubmittedRef.current && !isLoading) {
      verifySubmittedRef.current = true;
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      handleVerifyOtp(fakeEvent);
    }
  }, [otp, step, isLoading]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const cleanPhone = phoneNumber.replace(/\s/g, "");
      if (!/^[0-9]{4,12}$/.test(cleanPhone)) {
        throw new Error("Please enter a valid phone number");
      }

      const fullPhone = `${dialCode}${cleanPhone}`;

      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: fullPhone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send verification code");
      }

      // If dev mode (no Twilio), auto-fill the OTP
      if (data.otp) {
        const digits = data.otp.split("");
        setOtp(digits);
        // Auto-verify after a brief delay
        setTimeout(() => {
          autoVerify(fullPhone, data.otp);
        }, 500);
        setStep("otp");
        setResendTimer(60);
        return;
      }

      setStep("otp");
      setResendTimer(60);
    } catch (err: any) {
      setError(err.message || "Failed to send verification code");
    } finally {
      setIsLoading(false);
    }
  };

  const autoVerify = async (phone: string, code: string) => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone, code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }

      setVerifiedToken(data.token);
      setVerifiedUser(data.user);

      if (data.isNewUser) {
        setStep("name");
      } else {
        loginWithOtp(data.user, data.token);
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const code = otp.join("");
      if (code.length !== 6) {
        throw new Error("Please enter the complete 6-digit code");
      }

      const cleanPhone = phoneNumber.replace(/\s/g, "");
      const fullPhone = `${dialCode}${cleanPhone}`;

      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: fullPhone, code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid verification code");
      }

      setVerifiedToken(data.token);
      setVerifiedUser(data.user);

      if (data.isNewUser) {
        setStep("name");
      } else {
        loginWithOtp(data.user, data.token);
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message || "Verification failed");
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetName = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (name.trim().length < 2) {
        throw new Error("Name must be at least 2 characters");
      }

      const authToken = verifiedToken;
      if (!authToken) {
        throw new Error("Session expired. Please go back and try again.");
      }

      // Use the update-profile endpoint to set the name (OTP was already consumed)
      const response = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        loginWithOtp(data.user, authToken);
      } else {
        // Profile update failed, but token is still valid — login anyway
        const user = verifiedUser || { id: "", username: name.trim() };
        loginWithOtp(user, authToken);
      }

      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set name");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit is handled by useEffect above (after state updates)
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 0) return;

    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || "";
    }
    setOtp(newOtp);

    // Focus the last filled input or the next empty one
    const nextEmpty = newOtp.findIndex((d) => d === "");
    const focusIndex = nextEmpty === -1 ? 5 : nextEmpty;
    otpRefs.current[focusIndex]?.focus();
  };

  const handleResend = async () => {
    setResendTimer(60);
    setOtp(["", "", "", "", "", ""]);
    setError("");
    setIsLoading(true);

    try {
      const cleanPhone = phoneNumber.replace(/\s/g, "");
      const fullPhone = `${dialCode}${cleanPhone}`;

      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: fullPhone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to resend code");
      }

      // Dev mode auto-fill
      if (data.otp) {
        const digits = data.otp.split("");
        setOtp(digits);
        setTimeout(() => {
          autoVerify(fullPhone, data.otp);
        }, 500);
      }
    } catch (err: any) {
      setError(err.message || "Failed to resend code");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-(--color-background) p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="h-16 w-16 bg-(--color-elevated) rounded-full flex items-center justify-center mx-auto mb-4 shadow-2xl border border-(--color-border)">
            <Lock className="h-8 w-8 text-(--color-primary)" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">ChatX</h1>
          <p className="text-(--color-text-muted) mt-2">
            End-to-end encrypted messaging
          </p>
        </div>

        {/* Card */}
        <div className="bg-(--color-surface) rounded-2xl shadow-2xl border border-(--color-border) p-5 md:p-8 relative">

          {/* Step 1: Phone Number */}
          {step === "phone" && (
            <>
              <div className="text-center mb-6">
                <div className="h-12 w-12 bg-(--color-primary)/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Phone className="h-6 w-6 text-(--color-primary)" />
                </div>
                <h2 className="text-lg font-semibold">Enter your phone number</h2>
                <p className="text-sm text-(--color-text-muted) mt-1">
                  We&apos;ll send you a verification code via SMS
                </p>
              </div>

              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-(--color-text-muted) mb-2">
                    Phone Number
                  </label>
                  <div className="flex space-x-2">
                    <CountryCodeSelect
                      value={dialCode}
                      onChange={(dial) => setDialCode(dial)}
                    />
                    <div className="relative flex-1">
                      <Input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="234 567 8900"
                        className="w-full"
                        required
                      />
                    </div>
                  </div>
                  <p className="text-xs text-(--color-text-muted) mt-2">
                    Select your country code, then enter your phone number
                  </p>
                </div>

                {error && (
                  <div className="text-sm text-(--color-error) bg-(--color-error)/10 p-3 rounded-lg">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading || !phoneNumber.trim()}>
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                      Sending code...
                    </span>
                  ) : (
                    "Send Verification Code"
                  )}
                </Button>
              </form>
            </>
          )}

          {/* Step 2: OTP Verification */}
          {step === "otp" && (
            <>
              <div className="text-center mb-6">
                <button
                  onClick={() => { setStep("phone"); setError(""); setOtp(["", "", "", "", "", ""]); }}
                  className="absolute left-4 top-4 p-2 text-(--color-text-muted) hover:text-(--color-text-primary)"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="h-12 w-12 bg-(--color-primary)/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="h-6 w-6 text-(--color-primary)" />
                </div>
                <h2 className="text-lg font-semibold">Verify your number</h2>
                <p className="text-sm text-(--color-text-muted) mt-1">
                  Enter the 6-digit code sent to
                </p>
                <p className="text-sm font-medium mt-0.5">{dialCode}{phoneNumber}</p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                {/* OTP Input */}
                <div className="flex justify-center gap-2">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      onPaste={handleOtpPaste}
                      className="w-11 h-13 text-center text-xl font-bold bg-(--color-background) border border-(--color-border) rounded-lg outline-none focus:border-(--color-primary) focus:ring-1 focus:ring-(--color-primary)/20 transition-all"
                    />
                  ))}
                </div>

                {error && (
                  <div className="text-sm text-(--color-error) bg-(--color-error)/10 p-3 rounded-lg">
                    {error}
                  </div>
                )}

                {isLoading && otp.every((d) => d !== "") && (
                  <div className="flex items-center justify-center text-sm text-(--color-text-muted)">
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    Verifying...
                  </div>
                )}

                <div className="text-center">
                  {resendTimer > 0 ? (
                    <p className="text-sm text-(--color-text-muted)">
                      Resend code in {resendTimer}s
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      className="text-sm text-(--color-primary) hover:underline"
                    >
                      Resend code
                    </button>
                  )}
                </div>
              </form>
            </>
          )}

          {/* Step 3: Set Name (new users) */}
          {step === "name" && (
            <>
              <div className="text-center mb-6">
                <div className="h-12 w-12 bg-(--color-primary)/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <User className="h-6 w-6 text-(--color-primary)" />
                </div>
                <h2 className="text-lg font-semibold">What&apos;s your name?</h2>
                <p className="text-sm text-(--color-text-muted) mt-1">
                  This will be displayed to other users
                </p>
              </div>

              <form onSubmit={handleSetName} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-(--color-text-muted) mb-2">
                    Display Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--color-text-muted)" />
                    <Input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      className="pl-10"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-(--color-error) bg-(--color-error)/10 p-3 rounded-lg">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading || name.trim().length < 2}>
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                      Creating account...
                    </span>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-(--color-text-muted) mt-6">
          By continuing, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
