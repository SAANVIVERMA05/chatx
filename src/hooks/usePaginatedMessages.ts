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

export interface PaginatedMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: string;
  status: string;
  type: string;
  file?: { name: string; size: string; url?: string };
  sender?: { id: string; name: string; avatar?: string; status: string };
  replyTo?: { id: string; content: string; senderName: string };
}

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
  return res.json();
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
          m.id === messageId ? { ...m, status } : m
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
          ? { ...m, status: "read" }
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
