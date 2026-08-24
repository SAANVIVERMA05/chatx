"use client";

/**
 * useChats — manages the list of conversations for the current user.
 *
 * Responsibilities:
 *   - Fetching conversations from the API
 *   - Updating chat metadata (last message, unread count)
 *   - Exposing actions: refreshChats, updateChatLastMessage, markChatRead
 *
 * SOLID:
 *   - SRP: Only manages chat-list state. Does not handle messages or sockets.
 *   - OCP: Add pagination, filtering, or search without touching SecureChatApp.
 */

import { useState, useCallback } from "react";
import { Chat, Message, normalizeMessage } from "@/types/chat";
import { AuthUser } from "@/contexts/AuthContext";

interface UseChatsOptions {
  token: string | null;
  currentUser: AuthUser | null;
}

interface UseChatsReturn {
  chats: Chat[];
  isLoading: boolean;
  fetchChats: () => Promise<void>;
  /** Call when a new message arrives to update the chat's last message. */
  updateChatOnNewMessage: (message: Message) => void;
  /** Mark all messages in a chat as read (resets unread count). */
  markChatRead: (chatId: string) => void;
  /** Add a newly created chat to the list. */
  prependChat: (chat: Chat) => void;
}

/** Normalize a raw server conversation to the client Chat shape. */
function normalizeChat(raw: Record<string, unknown>, currentUserId: string): Chat {
  const members: Array<Record<string, unknown>> =
    (raw.members as Array<Record<string, unknown>>) || [];
  const participants = members.map((m) => ({
    id: m.id as string,
    name: (m.username as string) || "",
    avatar: m.avatar_url as string | undefined,
    status: "offline" as const,
  }));

  const rawLastMsg = raw.last_message as Record<string, unknown> | null;
  const lastMessage = rawLastMsg ? normalizeMessage(rawLastMsg) : undefined;

  return {
    id: raw.id as string,
    type: (raw.type as Chat["type"]) || "direct",
    name: raw.name as string | undefined,
    participants,
    lastMessage,
    unreadCount: (raw.unread_count as number) || 0,
    isEncrypted: true,
  };
}

export function useChats({ token, currentUser }: UseChatsOptions): UseChatsReturn {
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchChats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/chats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const normalized: Chat[] = (data.chats || data.conversations || []).map(
        (c: Record<string, unknown>) =>
          normalizeChat(c, currentUser?.id ?? "")
      );
      setChats(normalized);
    } catch (err) {
      console.error("fetchChats error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [token, currentUser?.id]);

  const updateChatOnNewMessage = useCallback((message: Message) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === message.chatId
          ? { ...chat, lastMessage: message }
          : chat
      )
    );
  }, []);

  const markChatRead = useCallback((chatId: string) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
      )
    );
  }, []);

  const prependChat = useCallback((chat: Chat) => {
    setChats((prev) => [chat, ...prev.filter((c) => c.id !== chat.id)]);
  }, []);

  return { chats, isLoading, fetchChats, updateChatOnNewMessage, markChatRead, prependChat };
}
