"use client";

interface TypingIndicatorProps {
  name?: string;
  className?: string;
}

export default function TypingIndicator({ name, className }: TypingIndicatorProps) {
  return (
    <div className={`flex items-end gap-2 ${className || ""}`}>
      <div className="bg-(--color-elevated) border border-(--color-border) rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          <span className="typing-dot" style={{ animationDelay: "0ms" }} />
          <span className="typing-dot" style={{ animationDelay: "150ms" }} />
          <span className="typing-dot" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

/**
 * Compact inline typing label for headers
 */
export function TypingLabel({ name }: { name?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-(--color-primary) font-medium">
        {name || "Someone"}
      </span>
      <span className="text-(--color-text-muted)">is typing</span>
      <span className="inline-flex gap-0.5 ml-0.5">
        <span className="typing-dot-sm" style={{ animationDelay: "0ms" }} />
        <span className="typing-dot-sm" style={{ animationDelay: "150ms" }} />
        <span className="typing-dot-sm" style={{ animationDelay: "300ms" }} />
      </span>
    </span>
  );
}
