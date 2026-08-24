"use client";

import { cn } from "@/lib/utils";

type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";

interface ReadReceiptProps {
  status: MessageStatus;
  className?: string;
}

/**
 * WhatsApp-style read receipt checkmarks:
 * - ⏳ sending (clock, muted color)
 * - ✓ sent (single check, muted color)
 * - ✓✓ delivered (double check, muted/grey)
 * - ✓✓ read (double check, green/primary)
 */
export default function ReadReceipt({ status, className }: ReadReceiptProps) {
  if (status === "sending") {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none" className="text-(--color-text-muted) opacity-50">
          {/* Clock icon */}
          <circle cx="5.5" cy="5.5" r="5" stroke="currentColor" strokeWidth="1.2" fill="none" />
          <path d="M5.5 3v2.5l1.5 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </span>
    );
  }

  if (status === "sent") {
    // Single grey check
    return (
      <span className={cn("inline-flex items-center", className)}>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none" className="text-(--color-text-muted)">
          <path
            d="M1 5.5l3.5 3.5L11 2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (status === "delivered") {
    // Double grey check
    return (
      <span className={cn("inline-flex items-center", className)}>
        <svg width="20" height="11" viewBox="0 0 20 11" fill="none" className="text-(--color-text-muted)">
          <path
            d="M1 5.5l3.5 3.5L11 2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5 5.5l3.5 3.5L15 2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (status === "failed") {
    // Red exclamation for failed messages
    return (
      <span className={cn("inline-flex items-center", className)}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-(--color-error)">
          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M7 4v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="7" cy="10" r="0.8" fill="currentColor" />
        </svg>
      </span>
    );
  }

  // Read — double green check (uses the primary color which is emerald)
  return (
    <span className={cn("inline-flex items-center", className)}>
      <svg width="20" height="11" viewBox="0 0 20 11" fill="none" className="text-(--color-primary)">
        <path
          d="M1 5.5l3.5 3.5L11 2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5 5.5l3.5 3.5L15 2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
