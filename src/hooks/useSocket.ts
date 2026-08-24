"use client";

/**
 * useSocket — manages the Socket.io client connection lifecycle.
 *
 * Responsibilities:
 *   - Establishes and tears down the socket connection
 *   - Handles auth (token + dev fallback)
 *   - Exposes the socket instance and connection status
 *
 * SOLID:
 *   - SRP: This hook ONLY manages the socket connection.
 *          It does NOT handle messages, typing, or chats.
 *   - OCP: Add new socket features by composing on top of this hook,
 *          not by modifying it.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { AuthUser } from "@/contexts/AuthContext";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";

interface UseSocketOptions {
  user: AuthUser | null;
  token: string | null;
}

interface UseSocketReturn {
  /** The underlying Socket.io instance. null until connected. */
  socket: Socket | null;
  /** True once the socket is connected to the server. */
  isConnected: boolean;
  /** Join a conversation room to receive its messages. */
  joinConversation: (conversationId: string) => void;
  /** Leave a conversation room. */
  leaveConversation: (conversationId: string) => void;
}

export function useSocket({ user, token }: UseSocketOptions): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Don't connect until we have an authenticated user
    if (!user) return;

    const socket = io(SOCKET_URL, {
      auth: token
        ? { token }
        : { userId: user.id, username: user.name }, // dev fallback
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      console.log("⚡ Socket connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      console.log("💤 Socket disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.warn("Socket connection error:", err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [user, token]);

  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit("conversation:join", conversationId);
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit("conversation:leave", conversationId);
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    joinConversation,
    leaveConversation,
  };
}
