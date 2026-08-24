"use client";

/**
 * useMessages — manages message state for open conversations.
 *
 * Responsibilities:
 *   - Fetching message history for a conversation
 *   - Appending incoming real-time messages
 *   - Optimistic send (adding a "sending" state message before server confirms)
 *
 * SOLID:
 *   - SRP: Only manages message-list state. Does not manage chats or sockets.
 *   - OCP: Add pagination or message search here without touching other files.
 */

import { useState, useCallback } from "react";
import { Message, MessageStatus, normalizeMessage } from "@/types/chat";

interface UseMessagesReturn {
  /** All messages keyed by chatId. */
  messages: Record<string, Message[]>;
  /** Fetch message history for a conversation from the REST API. */
  fetchMessages: (chatId: string, token: string) => Promise<void>;
  /** Append a message received via Socket.io. */
  appendMessage: (message: Message) => void;
  /** Update the status of a specific message (e.g., sent → delivered). */
  updateMessageStatus: (chatId: string, messageId: string, status: MessageStatus) => void;
  /** Add an optimistic "sending" message before server confirmation. */
  addOptimisticMessage: (message: Message) => void;
}

export function useMessages(): UseMessagesReturn {
  const [messages, setMessages] = useState<Record<string, Message[]>>({});

  const fetchMessages = useCallback(async (chatId: string, token: string) => {
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();

      const normalized: Message[] = (data.messages || [])
        .map((m: Record<string, unknown>) => normalizeMessage(m))
        // Messages come newest-first from the API; reverse for chronological display
        .reverse();

      setMessages((prev) => ({ ...prev, [chatId]: normalized }));
    } catch (err) {
      console.error("fetchMessages error:", err);
    }
  }, []);

  const appendMessage = useCallback((message: Message) => {
    setMessages((prev) => {
      const existing = prev[message.chatId] || [];
      // Avoid duplicates (socket may echo back what REST already added)
      if (existing.some((m) => m.id === message.id)) return prev;
      return { ...prev, [message.chatId]: [...existing, message] };
    });
  }, []);

  const updateMessageStatus = useCallback(
    (chatId: string, messageId: string, status: MessageStatus) => {
      setMessages((prev) => ({
        ...prev,
        [chatId]: (prev[chatId] || []).map((m) =>
          m.id === messageId ? { ...m, status } : m
        ),
      }));
    },
    []
  );

  const addOptimisticMessage = useCallback((message: Message) => {
    setMessages((prev) => {
      const existing = prev[message.chatId] || [];
      return { ...prev, [message.chatId]: [...existing, message] };
    });
  }, []);

  return { messages, fetchMessages, appendMessage, updateMessageStatus, addOptimisticMessage };
}
