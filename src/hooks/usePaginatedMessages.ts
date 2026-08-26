"use client";

/**
 * usePaginatedMessages — loads message history in pages of 50.
 *
 * Initial load: fetches the last 50 messages (most recent).
 * loadOlderMessages(): fetches the 50 messages before the oldest
 *   currently loaded message, prepending them to the list.
 *
 * Scroll behaviour is managed by the caller:
 *   - Save scrollHeight before calling loadOlderMessages()
 *   - After state updates, restore scroll by: container.scrollTop = container.scrollHeight - savedHeight
 */

import { useState, useCallback, useRef } from "react";

import type { Message } from "@/types/chat";

export type PaginatedMessage = Message;

interface UsePaginatedMessagesReturn {
  messages: Record<string, PaginatedMessage[]>;
  hasMore: Record<string, boolean>;
  isLoadingMore: boolean;
  /** Load initial 50 messages for a chat. Resets state for that chat. */
  loadMessages: (chatId: string, token: string) => Promise<void>;
  /** Fetch the next page above the oldest loaded message. */
  loadOlderMessages: (chatId: string, token: string) => Promise<void>;
  /** Append a single incoming message (from socket). */
  appendMessage: (msg: PaginatedMessage) => void;
  /** Replace an optimistic message (temp_ id) with the confirmed one. */
  replaceOptimistic: (chatId: string, tempId: string, confirmed: PaginatedMessage) => void;
  /** Update message status field. */
  updateStatus: (chatId: string, messageId: string, status: string) => void;
  /** Mark all messages in a chat from other senders as read. */
  markAllRead: (chatId: string, myUserId: string) => void;
}

const PAGE_SIZE = 50;

import { decryptChatMessage } from "@/lib/e2e";
import { getActiveUserId } from "@/lib/keyStore";
import { normalizeMessage } from "@/types/chat";

async function decryptMessageArray(messages: any[], chatId: string): Promise<PaginatedMessage[]> {
  const currentUserId = getActiveUserId();
  const decryptedMessages = [];

  // Messages from server are usually sorted by timestamp desc, but we want to process them chronologically (asc) to keep ratchet state in sync
  const sorted = [...messages].sort((a, b) => new Date(a.timestamp || a.created_at).getTime() - new Date(b.timestamp || b.created_at).getTime());

  for (const raw of sorted) {
    const msg = normalizeMessage(raw);
    
    if (msg.ciphertext && !msg.ratchetHeader?.group) {
      // E2E encrypted direct message
      try {
        if (msg.senderId === currentUserId) {
          // We sent this message. In a real app we'd keep local plaintext or a sent-keys cache.
          // For now, we'll try to decrypt it if we somehow saved the key, or just show fallback.
          msg.plaintext = "💬 [You sent an encrypted message]";
        } else {
          msg.plaintext = await decryptChatMessage(
            chatId,
            msg.ciphertext,
            msg.nonce,
            msg.ratchetHeader
          );
        }
      } catch (e) {
        console.warn("Failed to decrypt message:", msg.id, e);
        msg.plaintext = "🔒 [Encrypted Message]";
      }
    } else if (msg.ciphertext && msg.ratchetHeader?.group) {
      // Dummy encryption for groups
      try {
        msg.plaintext = atob(msg.ciphertext);
      } catch {
        msg.plaintext = "Failed to decode group msg";
      }
    } else {
      // Legacy plaintext message
      msg.plaintext = msg.content || msg.plaintext;
    }
    
    // UI expects content to have the text
    msg.content = msg.plaintext || msg.ciphertext || "";
    decryptedMessages.push(msg);
  }

  // Restore original sort order (descending timestamp for UI)
  return decryptedMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

async function fetchPage(
  chatId: string,
  token: string,
  before?: string
): Promise<{ messages: PaginatedMessage[]; hasMore: boolean }> {
  const url = new URL(`/api/chats/${chatId}/messages`, window.location.origin);
  url.searchParams.set("limit", String(PAGE_SIZE));
  if (before) url.searchParams.set("before", before);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { messages: [], hasMore: false };
  
  const data = await res.json();
  const decrypted = await decryptMessageArray(data.messages, chatId);
  
  return { messages: decrypted, hasMore: data.hasMore };
}

export function usePaginatedMessages(): UsePaginatedMessagesReturn {
  const [messages, setMessages] = useState<Record<string, PaginatedMessage[]>>({});
  const [hasMore, setHasMore] = useState<Record<string, boolean>>({});
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Guard against concurrent loadOlderMessages calls
  const loadingRef = useRef(false);

  const loadMessages = useCallback(async (chatId: string, token: string) => {
    const { messages: page, hasMore: more } = await fetchPage(chatId, token);
    setMessages((prev) => ({ ...prev, [chatId]: page }));
    setHasMore((prev) => ({ ...prev, [chatId]: more }));
  }, []);

  const loadOlderMessages = useCallback(async (chatId: string, token: string) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoadingMore(true);

    try {
      const current = messages[chatId] ?? [];
      const oldestId = current[0]?.id;
      const { messages: older, hasMore: more } = await fetchPage(chatId, token, oldestId);

      if (older.length === 0) {
        setHasMore((prev) => ({ ...prev, [chatId]: false }));
        return;
      }

      // Prepend, deduplicate
      setMessages((prev) => {
        const existing = prev[chatId] ?? [];
        const existingIds = new Set(existing.map((m) => m.id));
        const fresh = older.filter((m) => !existingIds.has(m.id));
        return { ...prev, [chatId]: [...fresh, ...existing] };
      });
      setHasMore((prev) => ({ ...prev, [chatId]: more }));
    } finally {
      setIsLoadingMore(false);
      loadingRef.current = false;
    }
  }, [messages]);

  const appendMessage = useCallback((msg: PaginatedMessage) => {
    setMessages((prev) => {
      const existing = prev[msg.chatId] ?? [];
      if (existing.some((m) => m.id === msg.id)) return prev;
      return { ...prev, [msg.chatId]: [...existing, msg] };
    });
  }, []);

  const replaceOptimistic = useCallback(
    (chatId: string, tempId: string, confirmed: PaginatedMessage) => {
      setMessages((prev) => {
        const existing = prev[chatId] ?? [];
        const idx = existing.findIndex((m) => m.id === tempId);
        if (idx === -1) {
          // Not found as optimistic — append if not duplicate
          if (existing.some((m) => m.id === confirmed.id)) return prev;
          return { ...prev, [chatId]: [...existing, confirmed] };
        }
        const updated = [...existing];
        updated[idx] = confirmed;
        return { ...prev, [chatId]: updated };
      });
    },
    []
  );

  const updateStatus = useCallback(
    (chatId: string, messageId: string, status: string) => {
      setMessages((prev) => ({
        ...prev,
        [chatId]: (prev[chatId] ?? []).map((m) =>
          m.id === messageId ? { ...m, status: status as Message["status"] } : m
        ),
      }));
    },
    []
  );

  const markAllRead = useCallback((chatId: string, myUserId: string) => {
    setMessages((prev) => ({
      ...prev,
      [chatId]: (prev[chatId] ?? []).map((m) =>
        m.senderId !== myUserId && m.status !== "read"
          ? { ...m, status: "read" as Message["status"] }
          : m
      ),
    }));
  }, []);

  return {
    messages,
    hasMore,
    isLoadingMore,
    loadMessages,
    loadOlderMessages,
    appendMessage,
    replaceOptimistic,
    updateStatus,
    markAllRead,
  };
}
