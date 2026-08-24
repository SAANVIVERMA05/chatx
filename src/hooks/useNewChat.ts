"use client";

/**
 * useNewChat — handles searching users and creating a 1-to-1 conversation.
 *
 * Usage:
 *   const { query, setQuery, results, isSearching, createChat, isCreating } = useNewChat(token);
 *
 * Wire `query` to a search input. Results update automatically after
 * a 300ms debounce. Call `createChat(userId)` when the user selects
 * a result — it returns the new chat object (or the existing one if
 * a direct chat between the two users already exists).
 */

import { useState, useEffect, useCallback, useRef } from "react";

export interface UserResult {
  id: string;
  name: string;
  username: string;
  phone_number: string;
  avatar_url: string | null;
  status: string;
}

export interface CreatedChat {
  id: string;
  type: "direct" | "group";
  name: string | null;
  isEncrypted: boolean;
  unreadCount: number;
  participants: Array<{ id: string; name: string; avatar?: string; status: string }>;
  lastMessage: null;
}

interface UseNewChatReturn {
  query: string;
  setQuery: (q: string) => void;
  results: UserResult[];
  isSearching: boolean;
  createChat: (userId: string) => Promise<CreatedChat | null>;
  isCreating: boolean;
  error: string | null;
}

export function useNewChat(token: string | null): UseNewChatReturn {
  const [query, setQuery] = useState("");
  const [allUsers, setAllUsers] = useState<UserResult[]>([]);
  const [results, setResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedRef = useRef(false);

  // Fetch all users once when the hook mounts (or token changes)
  useEffect(() => {
    if (!token || fetchedRef.current) return;
    fetchedRef.current = true;

    fetch("/api/users", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setAllUsers(data.users ?? []))
      .catch(() => {});
  }, [token]);

  // Debounced local filter
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(() => {
      const q = query.toLowerCase().trim();
      const filtered = allUsers.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.username?.toLowerCase().includes(q) ||
          u.phone_number?.includes(q)
      );
      setResults(filtered);
      setIsSearching(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, allUsers]);

  const createChat = useCallback(
    async (userId: string): Promise<CreatedChat | null> => {
      if (!token) return null;
      setIsCreating(true);
      setError(null);
      try {
        const res = await fetch("/api/chats/create", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ user_id: userId }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to create chat");
          return null;
        }
        return data.chat as CreatedChat;
      } catch {
        setError("Network error");
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [token]
  );

  return { query, setQuery, results, isSearching, createChat, isCreating, error };
}
