"use client";

/**
 * NewChatModal — search for a user and start a 1-to-1 conversation.
 *
 * Props:
 *   isOpen       — controls visibility
 *   onClose      — called when user dismisses
 *   token        — JWT for authenticated API calls
 *   currentUserId — exclude the logged-in user from results
 *   onChatCreated — callback with the new/existing chat id
 */

import { useEffect, useRef } from "react";
import { Search, X, MessageSquare, Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNewChat } from "@/hooks/useNewChat";

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  currentUserId: string;
  onChatCreated: (chatId: string) => void;
}

export default function NewChatModal({
  isOpen,
  onClose,
  token,
  currentUserId,
  onChatCreated,
}: NewChatModalProps) {
  const { query, setQuery, results, isSearching, createChat, isCreating, error } =
    useNewChat(token);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens; reset query on close
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen, setQuery]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  async function handleSelect(userId: string) {
    const chat = await createChat(userId);
    if (chat) {
      onChatCreated(chat.id);
      onClose();
    }
  }

  if (!isOpen) return null;

  // Filter out the current user
  const filtered = results.filter((u) => u.id !== currentUserId);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New conversation"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2",
          "bg-(--color-surface) rounded-2xl shadow-2xl border border-(--color-border)",
          "flex flex-col overflow-hidden",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
        style={{ maxHeight: "80vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-(--color-border)">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-(--color-primary)" />
            <h2 className="text-base font-semibold">New Conversation</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-(--color-text-muted) hover:text-(--color-text-primary)"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search input */}
        <div className="px-4 py-3 border-b border-(--color-border)">
          <div className="relative">
            {isSearching ? (
              <Loader2 className="absolute left-3 top-2.5 h-4 w-4 text-(--color-text-muted) animate-spin" />
            ) : (
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-(--color-text-muted)" />
            )}
            <Input
              ref={inputRef}
              placeholder="Search by name or phone..."
              className="pl-9 bg-(--color-elevated) border-(--color-border) rounded-xl text-sm h-9 focus-visible:ring-1 focus-visible:ring-(--color-primary)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {error && (
            <div className="px-5 py-3 text-sm text-(--color-error)">{error}</div>
          )}

          {!query.trim() && (
            <div className="flex flex-col items-center justify-center py-12 text-(--color-text-muted)">
              <Search className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Search for someone to message</p>
            </div>
          )}

          {query.trim() && !isSearching && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-(--color-text-muted)">
              <p className="text-sm">No users found for &quot;{query}&quot;</p>
              <p className="text-xs mt-1 opacity-60">Try searching by phone number</p>
            </div>
          )}

          {filtered.map((user) => (
            <button
              key={user.id}
              onClick={() => handleSelect(user.id)}
              disabled={isCreating}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-left",
                "hover:bg-(--color-elevated) transition-colors duration-100",
                "border-b border-(--color-border)/40 last:border-0",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <Avatar
                size="md"
                src={user.avatar_url ?? undefined}
                fallback={user.name?.charAt(0) ?? user.username?.charAt(0)}
                status="online"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user.name ?? user.username}
                </p>
                {user.phone_number && (
                  <p className="text-xs text-(--color-text-muted) truncate mt-0.5">
                    {user.phone_number}
                  </p>
                )}
              </div>
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin text-(--color-primary) shrink-0" />
              ) : (
                <MessageSquare className="h-4 w-4 text-(--color-text-muted) opacity-0 group-hover:opacity-100 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
