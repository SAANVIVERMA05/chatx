"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  MessageSquare,
  Users,
  Settings,
  UserCircle,
  Lock,
  Phone,
  MoreVertical,
  Paperclip,
  Smile,
  Send,
  FileText,
  Image as ImageIcon,
  Expand,
  X,
  LogOut,
  Mic,
  Reply,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth, AuthUser } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import ContactsTab from "@/components/tabs/ContactsTab";
import GroupsTab from "@/components/tabs/GroupsTab";
import SettingsTab from "@/components/tabs/SettingsTab";
import ProfileTab from "@/components/tabs/ProfileTab";
import EmojiPicker from "@/components/EmojiPicker";
import VoiceRecorder from "@/components/VoiceRecorder";
import AudioMessage from "@/components/AudioMessage";
import ImageMessage from "@/components/ImageMessage";
import Lightbox from "@/components/Lightbox";
import TypingIndicator, { TypingLabel } from "@/components/TypingIndicator";
import ReadReceipt from "@/components/ReadReceipt";
import { useNotifications } from "@/hooks/useNotifications";
import NewChatModal from "@/components/NewChatModal";
import { usePaginatedMessages } from "@/hooks/usePaginatedMessages";

type User = Omit<AuthUser, "password">;

type Message = {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: string;
  status: "sending" | "sent" | "delivered" | "read" | "failed";
  type: "text" | "file";
  file?: {
    name: string;
    size: string;
    url?: string;
    progress?: number;
  };
  sender?: {
    id: string;
    name: string;
    avatar?: string;
    status: string;
  };
  replyTo?: {
    id: string;
    content: string;
    senderName: string;
  };
};

type Chat = {
  id: string;
  type: "direct" | "group";
  participants: User[];
  name?: string;
  avatar?: string;
  lastMessage?: Message;
  unreadCount: number;
  isEncrypted: boolean;
};

// Contact info type
interface ContactInfo {
  address: string;
  email: string;
  phone: string;
  lastVisited: string;
}

const contactInfoMap: Record<string, ContactInfo> = {
  u2: {
    address: "123 Main St, USA",
    email: "alene@example.com",
    phone: "555-0123",
    lastVisited: "30, Nov 2024",
  },
  u3: {
    address: "32188 Sips Parkways, U.S",
    email: "Keefe@codedtheme.com",
    phone: "995-250-1803",
    lastVisited: "30, Nov 2024",
  },
  u4: {
    address: "456 Oak Ave, USA",
    email: "wilhelmine@example.com",
    phone: "555-0456",
    lastVisited: "25, Nov 2024",
  },
  u5: {
    address: "789 Pine Ln, USA",
    email: "lazaro@example.com",
    phone: "555-0789",
    lastVisited: "22, Nov 2024",
  },
  u6: {
    address: "321 Elm St, USA",
    email: "herman@example.com",
    phone: "555-0321",
    lastVisited: "28, Nov 2024",
  },
  u7: {
    address: "654 Maple Dr, USA",
    email: "agliulf@example.com",
    phone: "555-0654",
    lastVisited: "26, Nov 2024",
  },
  u8: {
    address: "987 Cedar Ln, USA",
    email: "lazaro2@example.com",
    phone: "555-0987",
    lastVisited: "29, Nov 2024",
  },
  u9: {
    address: "159 Birch Rd, USA",
    email: "stebin@example.com",
    phone: "555-1592",
    lastVisited: "30, Nov 2024",
  },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function isImageFile(filename?: string): boolean {
  if (!filename) return false;
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff?)$/i.test(filename);
}

/** Human-readable relative timestamp for conversation list. */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return new Date(iso).toLocaleDateString([], { weekday: "short" });
  }
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

// Normalize socket messages (snake_case from server) to client Message type
function normalizeMessage(raw: Record<string, unknown>): Message {
  return {
    id: raw.id as string,
    chatId: (raw.chatId as string) || (raw.conversation_id as string) || (raw.chat_id as string) || "",
    senderId: (raw.senderId as string) || (raw.sender_id as string) || "",
    content: (raw.content as string) || "",
    timestamp: (raw.timestamp as string) || (raw.created_at as string) || new Date().toISOString(),
    status: (raw.status as Message["status"]) || "sent",
    type: (raw.type as Message["type"]) || (raw.message_type as Message["type"]) || "text",
    file: raw.file as Message["file"] || (raw.file_url ? { name: (raw.file_name as string) || "file", size: (raw.file_size as string) || "", url: raw.file_url as string } : undefined),
    sender: raw.sender as Message["sender"] || (raw.sender_username ? { id: raw.sender_id as string, name: raw.sender_username as string, status: "online" } : undefined),
    replyTo: raw.replyTo as Message["replyTo"] || (raw.reply_to as Message["replyTo"]) || undefined,
  };
}

export default function SecureChatApp() {
  const { user: currentUser, token, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "chats" | "contacts" | "groups" | "settings" | "profile"
  >("chats");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const notifications = useNotifications(notificationEnabled);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Auto-request notification permission when enabled and first time
  useEffect(() => {
    if (notificationEnabled && notifications.isSupported && notifications.permission === "default") {
      notifications.requestPermission();
    }
  }, [notificationEnabled, notifications]);

  // Responsive: detect mobile viewport
  useEffect(() => {
    function checkMobile() {
      setIsMobile(window.innerWidth < 768);
    }
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // On mobile, switch to sidebar view when no chat is selected
  useEffect(() => {
    if (isMobile && !selectedChatId) {
      setShowMobileSidebar(true);
    }
  }, [isMobile, selectedChatId]);

  const [isViewingProfileOnly, setIsViewingProfileOnly] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState<string>("");
  const [replyToMessage, setReplyToMessage] = useState<any | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Ref for the messages scroll container (needed to preserve position on pagination)
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // Sentinel element at the top of the message list for IntersectionObserver
  const topSentinelRef = useRef<HTMLDivElement>(null);

  // Paginated messages hook — replaces plain messages state
  const {
    messages,
    hasMore,
    isLoadingMore,
    loadMessages,
    loadOlderMessages,
    appendMessage: appendPaginatedMessage,
    replaceOptimistic,
    updateStatus: updateMessageStatus,
    markAllRead,
  } = usePaginatedMessages();

  // Use ref for socket to avoid stale closures in callbacks
  const socketRef = useRef<any>(null);

  // Redirect to login if not authenticated (only after auth finishes loading)
  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push("/login");
    }
  }, [currentUser, router, authLoading]);

  // Fetch chats
  const fetchChats = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch("/api/chats", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setChats(data.chats);
        // Auto-select first chat if none selected
        if (!selectedChatId && data.chats.length > 0) {
          setSelectedChatId(data.chats[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch chats:", error);
    }
  }, [token, selectedChatId]);

  // Initialize socket connection
  useEffect(() => {
    if (!token || !currentUser) return;

    let newSocket: any = null;

    const initSocket = async () => {
      const { io } = await import("socket.io-client");

      // Connect to Express server for Socket.io
      const serverUrl = "http://localhost:4000";
      newSocket = io(serverUrl, {
        auth: {
          token,
          userId: currentUser.id,
          username: currentUser.name,
        },
      });

      newSocket.on("connect", () => {
        console.log("Socket connected");
        setIsConnected(true);
      });

      newSocket.on("disconnect", () => {
        console.log("Socket disconnected");
        setIsConnected(false);
      });

      // Handle our own sent message (replaces optimistic)
      newSocket.on("message:sent", (raw: Record<string, unknown>) => {
        const message = normalizeMessage(raw);
        // Find and replace the matching optimistic message
        const tempId = `temp_${message.senderId}`; // best-effort match
        replaceOptimistic(message.chatId, tempId, message as any);

        // Update chat's last message and move to top
        setChats((prev) => {
          const updated = prev.map((chat) =>
            chat.id === message.chatId ? { ...chat, lastMessage: message } : chat
          );
          return sortChatsByLastMessage(updated);
        });
      });

      // Handle messages from other users
      newSocket.on("message:new", (raw: Record<string, unknown>) => {
        const message = normalizeMessage(raw);

        // Push notification for messages from others when tab is backgrounded
        if (message.senderId !== currentUser?.id) {
          const senderName = message.sender?.name || "Someone";
          const preview = message.type === "text" ? message.content : message.file?.name || "Sent a file";
          const chat = chats.find((c) => c.id === message.chatId);
          const chatName = chat?.name || chat?.participants?.find((p) => p.id !== currentUser?.id)?.name || senderName;
          notifications.sendNotification({
            title: chat?.type === "group" ? `${chatName} - ${senderName}` : senderName,
            body: preview.length > 100 ? preview.substring(0, 100) + "..." : preview,
            tag: `chatx-${message.chatId}`,
            onClick: () => setSelectedChatId(message.chatId),
          });
        }

        appendPaginatedMessage(message as any);

        setChats((prev) => {
          const updated = prev.map((chat) => {
            if (chat.id !== message.chatId) return chat;
            // Increment unread count only when this chat is NOT currently open
            const isActive = chat.id === selectedChatId;
            return {
              ...chat,
              lastMessage: message,
              unreadCount: isActive ? 0 : (chat.unreadCount ?? 0) + 1,
            };
          });
          return sortChatsByLastMessage(updated);
        });
      });

      newSocket.on(
        "message:status:updated",
        (data: { chatId: string; messageId: string; status: string }) => {
          updateMessageStatus(data.chatId, data.messageId, data.status);
        }
      );

      newSocket.on(
        "typing:start",
        (data: { userId: string; chatId: string }) => {
          setTypingUsers((prev) => ({
            ...prev,
            [data.chatId]: [
              ...(prev[data.chatId] || []).filter((id) => id !== data.userId),
              data.userId,
            ],
          }));
        }
      );

      newSocket.on(
        "typing:stop",
        (data: { userId: string; chatId: string }) => {
          setTypingUsers((prev) => ({
            ...prev,
            [data.chatId]: (prev[data.chatId] || []).filter(
              (id) => id !== data.userId
            ),
          }));
        }
      );

      // Handle read receipts from other users
      newSocket.on(
        "messages:read",
        (data: { userId: string; conversationId: string }) => {
          // Mark all our outgoing messages in this chat as read
          updateMessageStatus(data.conversationId, "__all_mine__", "read");
          // More precise: iterate and update only sender=me messages
          // (handled inside updateStatus with special sentinel — we keep markAllRead for this)
          markAllRead(data.conversationId, currentUser?.id ?? "");
        }
      );

      // Handle status updates for our sent messages
      newSocket.on(
        "message:delivered",
        (data: { messageId: string; chatId: string }) => {
          updateMessageStatus(data.chatId, data.messageId, "delivered");
        }
      );

      socketRef.current = newSocket;
    };

    initSocket();

    return () => {
      if (newSocket) {
        newSocket.disconnect();
        socketRef.current = null;
      }
    };
  }, [token]);

  // Fetch initial data
  useEffect(() => {
    if (currentUser && token) {
      setIsLoading(true);
      fetchChats().then(() => setIsLoading(false));
    }
  }, [currentUser, token, fetchChats]);

  // Fetch messages (paginated) when a chat is selected
  useEffect(() => {
    if (!selectedChatId || !token) return;

    // Load initial 50 messages
    loadMessages(selectedChatId, token);

    // Join socket room
    socketRef.current?.emit("conversation:join", selectedChatId);

    // Tell server + locally clear unread count
    socketRef.current?.emit("messages:read", selectedChatId);
    markAllRead(selectedChatId, currentUser?.id ?? "");
    setChats((prev) =>
      prev.map((c) => (c.id === selectedChatId ? { ...c, unreadCount: 0 } : c))
    );

    return () => {
      socketRef.current?.emit("conversation:leave", selectedChatId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChatId, token]);

  // IntersectionObserver: load older messages when sentinel at top becomes visible
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel || !selectedChatId || !token) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore[selectedChatId] && !isLoadingMore) {
          // Save scroll height before prepending
          const container = messagesContainerRef.current;
          const prevScrollHeight = container?.scrollHeight ?? 0;

          loadOlderMessages(selectedChatId, token).then(() => {
            // Restore scroll position so viewport doesn't jump
            if (container) {
              const newScrollHeight = container.scrollHeight;
              container.scrollTop += newScrollHeight - prevScrollHeight;
            }
          });
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [selectedChatId, token, hasMore, isLoadingMore, loadOlderMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedChatId]);

  // Focus input when chat is selected
  useEffect(() => {
    if (selectedChatId) {
      messageInputRef.current?.focus();
    }
  }, [selectedChatId]);

  // Send message
  const handleSendMessage = useCallback(() => {
    const msg = newMessage.trim();
    if (!msg || !selectedChatId || !currentUser) return;

    // Capture reply before clearing
    const replyTarget = replyToMessage;

    // Clear input immediately for responsive feel
    setNewMessage("");
    setReplyToMessage(null);

    // Create optimistic message for instant display
    const optimisticMessage: Message = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      chatId: selectedChatId,
      senderId: currentUser.id,
      content: msg,
      timestamp: new Date().toISOString(),
      status: "sending",
      type: "text",
      sender: {
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar,
        status: currentUser.status,
      },
      replyTo: replyTarget ? {
        id: replyTarget.id,
        content: replyTarget.content,
        senderName: replyTarget.sender?.name || "",
      } : undefined,
    };

    // Add optimistic message immediately
    appendPaginatedMessage(optimisticMessage as any);

    // Update chat's last message
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === selectedChatId
          ? { ...chat, lastMessage: optimisticMessage }
          : chat
      )
    );

    // Send via socket (server persists and broadcasts)
    socketRef.current?.emit("message:send", {
      conversationId: selectedChatId,
      content: msg,
      replyTo: replyTarget ? {
        id: replyTarget.id,
        content: replyTarget.content,
        senderName: replyTarget.sender?.name || "",
      } : undefined,
    });

    // Stop typing indicator
    socketRef.current?.emit("typing:stop", selectedChatId);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [newMessage, selectedChatId, currentUser, replyToMessage]);

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    if (!selectedChatId || !socketRef.current) return;

    socketRef.current.emit("typing:start", selectedChatId);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit("typing:stop", selectedChatId);
    }, 2000);
  }, [selectedChatId]);

  // Close emoji picker on click outside chat area
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-emoji-picker]')) {
        // Don't close if clicking the emoji button itself
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Handle key press in message input
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  // Handle logout
  const handleLogout = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    logout();
    router.push("/login");
  }, [logout, router]);

  // Handle emoji select
  const handleEmojiSelect = useCallback((emoji: string) => {
    setNewMessage((prev) => prev + emoji);
    messageInputRef.current?.focus();
  }, []);

  // Handle voice message send
  const handleVoiceSend = useCallback(
    async (blob: Blob, duration: number) => {
      if (!selectedChatId || !currentUser) return;

      setIsRecordingVoice(false);
      setIsUploading(true);

      try {
        const formData = new FormData();
        const filename = `voice-${Date.now()}.webm`;
        formData.append("file", blob, filename);

        const authToken = localStorage.getItem("token");
        const response = await fetch("/api/uploads", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: formData,
        });

        if (!response.ok) throw new Error("Upload failed");

        const data = await response.json();
        const fileUrl = data.file.url;
        const fileSize = formatFileSize(data.file.size);

        // Create optimistic voice message
        const optimisticMessage: Message = {
          id: `temp_voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          chatId: selectedChatId,
          senderId: currentUser.id,
          content: `🎤 Voice message (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")})`,
          timestamp: new Date().toISOString(),
          status: "sending",
          type: "file",
          file: {
            name: filename,
            size: fileSize,
          },
          sender: {
            id: currentUser.id,
            name: currentUser.name,
            avatar: currentUser.avatar,
            status: currentUser.status,
          },
        };

        // Add optimistic message
        appendPaginatedMessage(optimisticMessage as any);

        // Update chat's last message
        setChats((prev) =>
          prev.map((chat) =>
            chat.id === selectedChatId
              ? { ...chat, lastMessage: optimisticMessage }
              : chat
          )
        );

        // Send via socket
        socketRef.current?.emit("message:send", {
          conversationId: selectedChatId,
          content: `🎤 Voice message`,
          fileUrl,
          fileName: filename,
          fileSize,
          messageType: "audio",
          duration,
        });
      } catch (err) {
        console.error("Voice upload failed:", err);
      } finally {
        setIsUploading(false);
      }
    },
    [selectedChatId, currentUser]
  );

  // Handle file upload
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !selectedChatId || !currentUser) return;

      // Reset the input so the same file can be selected again
      e.target.value = "";

      setIsUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const token = localStorage.getItem("token");
        const response = await fetch("/api/uploads", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) throw new Error("Upload failed");

        const data = await response.json();
        const fileUrl = data.file.url;
        const fileName = data.file.name;
        const fileSize = formatFileSize(data.file.size);

        // Create optimistic file message
        const optimisticMessage: Message = {
          id: `temp_file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          chatId: selectedChatId,
          senderId: currentUser.id,
          content: isImageFile(fileName) ? "📷 Photo" : `📎 ${fileName}`,
          timestamp: new Date().toISOString(),
          status: "sending",
          type: "file",
          file: {
            name: fileName,
            size: fileSize,
            url: fileUrl,
          },
          sender: {
            id: currentUser.id,
            name: currentUser.name,
            avatar: currentUser.avatar,
            status: currentUser.status,
          },
        };

        // Add optimistic message
        appendPaginatedMessage(optimisticMessage as any);

        // Update chat's last message
        setChats((prev) =>
          prev.map((chat) =>
            chat.id === selectedChatId
              ? { ...chat, lastMessage: optimisticMessage }
              : chat
          )
        );

        // Send via socket
        socketRef.current?.emit("message:send", {
          conversationId: selectedChatId,
          content: isImageFile(fileName) ? "📷 Photo" : `📎 ${fileName}`,
          fileUrl,
          fileName,
          fileSize,
          messageType: isImageFile(fileName) ? "image" : "file",
        });
      } catch (err) {
        console.error("File upload failed:", err);
      } finally {
        setIsUploading(false);
      }
    },
    [selectedChatId, currentUser]
  );

  // Sort helper — most recent message first
  function sortChatsByLastMessage(chatList: Chat[]): Chat[] {
    return [...chatList].sort((a, b) => {
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime();
    });
  }

  const selectedChat = chats.find((c) => c.id === selectedChatId);
  const activeMessages = selectedChatId ? messages[selectedChatId] || [] : [];
  const chatPartner =
    selectedChat?.type === "direct"
      ? selectedChat.participants.find((p) => p.id !== currentUser?.id)
      : undefined;
  const partnerInfo = chatPartner ? contactInfoMap[chatPartner.id] : undefined;

  // Filter chats by search query (name, last message, or any message content)
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    if (!currentUser) return chats;
    const q = searchQuery.toLowerCase().trim();
    return chats.filter((chat) => {
      // Match by chat name (group) or partner name (direct)
      const partner =
        chat.type === "direct"
          ? chat.participants.find((p) => p.id !== currentUser.id)
          : null;
      const chatName =
        chat.type === "group" ? chat.name : partner?.name;
      if (chatName?.toLowerCase().includes(q)) return true;

      // Match by last message content
      if (chat.lastMessage?.content?.toLowerCase().includes(q)) return true;

      // Match by any message in this conversation
      const chatMessages = messages[chat.id];
      if (chatMessages?.some((m) => m.content?.toLowerCase().includes(q)))
        return true;

      return false;
    });
  }, [chats, messages, searchQuery, currentUser]);

  if (!currentUser) {
    return (
      <div className="flex h-screen w-full bg-(--color-background) items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-12 w-12 border-4 border-(--color-primary) border-t-transparent rounded-full animate-spin" />
          <p className="text-(--color-text-muted)">Loading...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-full bg-(--color-background) items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-12 w-12 border-4 border-(--color-primary) border-t-transparent rounded-full animate-spin" />
          <p className="text-(--color-text-muted)">Loading chats...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-screen w-full bg-(--color-background) text-(--color-text-primary) overflow-hidden">
        {/* Sidebar */}
        <aside className={cn(
          "flex-shrink-0 border-r border-(--color-border) bg-(--color-sidebar) flex flex-col transition-all duration-300",
          isMobile
            ? (showMobileSidebar ? "w-full absolute inset-0 z-40" : "hidden")
            : "w-[320px]"
        )}>
          <div className="p-4 flex items-center justify-between border-b border-(--color-border)">
            <div className="flex items-center space-x-2">
              <Lock className="h-6 w-6 text-(--color-primary)" />
              <h1 className="text-xl font-bold tracking-tight">Message</h1>
            </div>
            <div className="flex items-center space-x-2">
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium">{currentUser.name}</p>
                <p className="text-xs text-(--color-text-muted)">
                  {isConnected ? "Connected" : "Disconnected"}
                </p>
              </div>
              <Avatar
                size="sm"
                status={currentUser.status}
                fallback={currentUser.name.charAt(0)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleLogout}
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-(--color-text-muted)" />
              <Input
                placeholder="Search messages..."
                className="pl-9 bg-(--color-surface) border-none rounded-full text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="px-4 py-2">
            <Button
              className="w-full justify-center text-sm shadow-sm bg-(--color-primary) hover:bg-(--color-primary)/90 text-white rounded-full"
              variant="default"
              onClick={() => setShowNewChatModal(true)}
            >
              <Plus className="mr-2 h-4 w-4" /> New Chat
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === "chats" && (
              <div className="space-y-0 px-0">
                {filteredChats.map((chat) => {
                  const partner =
                    chat.type === "direct"
                      ? chat.participants.find(
                          (p) => p.id !== currentUser.id
                        )
                      : null;
                  const name =
                    chat.type === "group" ? chat.name : partner?.name;
                  const status =
                    chat.type === "direct" ? partner?.status : undefined;
                  const title =
                    chat.type === "direct" ? partner?.title : undefined;

                  return (
                    <div
                      key={chat.id}
                      onClick={() => {
                        setSelectedChatId(chat.id);
                        setIsViewingProfileOnly(false);
                        if (isMobile) setShowMobileSidebar(false);
                      }}
                      className={cn(
                        "flex items-center px-4 py-3 cursor-pointer transition-colors duration-150 border-b border-(--color-border)/30",
                        selectedChatId === chat.id
                          ? "bg-(--color-elevated)"
                          : "hover:bg-(--color-surface)/50"
                      )}
                    >
                      <Avatar
                        size="md"
                        status={status}
                        fallback={name?.charAt(0)}
                      />
                      <div className="ml-4 flex-1 overflow-hidden">
                        <div className="flex justify-between items-baseline gap-2">
                          <h3 className="text-sm font-medium truncate">
                            {name}
                          </h3>
                          {chat.lastMessage && (
                            <span className="text-xs text-(--color-text-muted) shrink-0">
                              {relativeTime(chat.lastMessage.timestamp)}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center gap-2 mt-1">
                          <p className="text-xs text-(--color-text-muted) truncate line-clamp-1">
                            {chat.lastMessage ? (
                              <>
                                {chat.lastMessage.senderId === currentUser.id ? (
                                  <span className="text-(--color-text-muted)/70">You: </span>
                                ) : chat.type === "group" && chat.lastMessage.sender?.name ? (
                                  <span className="text-(--color-text-muted)/70">{chat.lastMessage.sender.name}: </span>
                                ) : null}
                                {chat.lastMessage.type !== "text"
                                  ? (chat.lastMessage.file?.name ? `📎 ${chat.lastMessage.file.name}` : "📎 File")
                                  : chat.lastMessage.content}
                              </>
                            ) : (
                              "No messages yet"
                            )}
                          </p>
                          {chat.unreadCount > 0 && (
                            <span className="flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-(--color-primary) text-[11px] font-bold text-white shrink-0">
                              {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredChats.length === 0 && searchQuery.trim() && (
                  <div className="px-4 py-8 text-center">
                    <Search className="h-8 w-8 text-(--color-text-muted) mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-(--color-text-muted)">
                      No conversations matching &quot;{searchQuery.trim()}&quot;
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "contacts" && (
              <ContactsTab
                onOpenChat={(contactId) => {
                  const existingChat = chats.find(
                    (c) =>
                      c.type === "direct" &&
                      c.participants.some((p) => p.id === contactId)
                  );
                  if (existingChat) {
                    setSelectedChatId(existingChat.id);
                    setIsViewingProfileOnly(false);
                    setActiveTab("chats");
                  }
                }}
                onChatCreated={(chatId) => {
                  fetchChats();
                  setSelectedChatId(chatId);
                  setIsViewingProfileOnly(false);
                  setActiveTab("chats");
                }}
              />
            )}

            {activeTab === "groups" && (
              <GroupsTab
                chats={chats as any}
                selectedChatId={selectedChatId}
                onSelectChat={(chatId) => {
                  setSelectedChatId(chatId);
                  setIsViewingProfileOnly(false);
                  setActiveTab("chats");
                }}
                onGroupCreated={(chatId) => {
                  // Refresh chats and navigate to the new group
                  fetchChats();
                  setSelectedChatId(chatId);
                  setIsViewingProfileOnly(false);
                  setActiveTab("chats");
                }}
              />
            )}

            {activeTab === "settings" && (
              <SettingsTab onLogout={handleLogout} notificationsEnabled={notificationEnabled} onNotificationsToggle={setNotificationEnabled} />
            )}

            {activeTab === "profile" && (
              <ProfileTab chats={chats as any} />
            )}
          </div>

          {/* Bottom Nav */}
          <div className="p-3 border-t border-(--color-border) bg-(--color-sidebar) flex justify-between items-center px-4">
            <button
              onClick={() => setActiveTab("chats")}
              className={cn(
                "p-2 rounded-md hover:bg-(--color-elevated) transition-colors",
                activeTab === "chats"
                  ? "text-(--color-primary)"
                  : "text-(--color-text-muted)"
              )}
              title="Chats"
            >
              <MessageSquare className="h-5 w-5" />
            </button>
            <button
              onClick={() => setActiveTab("contacts")}
              className={cn(
                "p-2 rounded-md hover:bg-(--color-elevated) transition-colors",
                activeTab === "contacts"
                  ? "text-(--color-primary)"
                  : "text-(--color-text-muted)"
              )}
              title="Contacts"
            >
              <Users className="h-5 w-5" />
            </button>
            <button
              onClick={() => setActiveTab("groups")}
              className={cn(
                "p-2 rounded-md hover:bg-(--color-elevated) transition-colors",
                activeTab === "groups"
                  ? "text-(--color-primary)"
                  : "text-(--color-text-muted)"
              )}
              title="Groups"
            >
              <Users className="h-5 w-5" />
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={cn(
                "p-2 rounded-md hover:bg-(--color-elevated) transition-colors",
                activeTab === "profile"
                  ? "text-(--color-primary)"
                  : "text-(--color-text-muted)"
              )}
              title="Profile"
            >
              <UserCircle className="h-5 w-5" />
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={cn(
                "p-2 rounded-md hover:bg-(--color-elevated) transition-colors",
                activeTab === "settings"
                  ? "text-(--color-primary)"
                  : "text-(--color-text-muted)"
              )}
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </aside>

        {/* Main Chat Area or Profile View */}
        {isViewingProfileOnly && selectedChat && chatPartner ? (
          <main className={cn("flex-1 flex flex-col bg-(--color-background) relative overflow-y-auto", isMobile && showMobileSidebar && "hidden")}>
            {/* Profile Header */}
            <header className="h-16 border-b border-(--color-border) flex items-center justify-between px-6 bg-(--color-surface) sticky top-0 z-10">
              <div className="flex items-center flex-1">
                <h1 className="text-xl font-bold tracking-tight">chatx</h1>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setIsViewingProfileOnly(false)}
                title="Close profile"
              >
                <X className="h-5 w-5" />
              </Button>
            </header>

            {/* Profile Content */}
            <div className="flex-1 flex flex-col items-center justify-start p-8 space-y-8">
              <div className="flex flex-col items-center">
                <Avatar
                  size="xl"
                  status={chatPartner?.status}
                  fallback={chatPartner?.name?.charAt(0)}
                  className="mb-6 shadow-2xl"
                />
                <h2 className="text-3xl font-bold mb-2">
                  {chatPartner?.name}
                </h2>
                <p className="text-lg text-(--color-text-muted)">
                  {chatPartner?.status === "online" && "🟢 Available"}
                  {chatPartner?.status === "offline" && "🔴 Away"}
                  {chatPartner?.status === "busy" && "🟠 Busy"}
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex space-x-8">
                <div className="flex flex-col items-center text-(--color-text-muted) hover:text-(--color-primary) cursor-pointer transition-colors">
                  <div className="h-12 w-12 bg-(--color-elevated) rounded-full flex items-center justify-center mb-2">
                    <Phone className="h-5 w-5" />
                  </div>
                  <span className="text-sm">Audio</span>
                </div>
                <div className="flex flex-col items-center text-(--color-text-muted) hover:text-(--color-primary) cursor-pointer transition-colors">
                  <div className="h-12 w-12 bg-(--color-elevated) rounded-full flex items-center justify-center mb-2">
                    <Search className="h-5 w-5" />
                  </div>
                  <span className="text-sm">Search</span>
                </div>
              </div>

              {/* Information Section */}
              <div className="w-full max-w-md">
                <h3 className="text-sm font-semibold text-(--color-text-muted) uppercase tracking-wider mb-6">
                  Information
                </h3>
                <div className="space-y-6">
                  <div className="border-l-4 border-(--color-primary) pl-4">
                    <p className="text-xs text-(--color-text-muted) uppercase tracking-wider mb-1">
                      Address
                    </p>
                    <p className="text-base font-medium">
                      {partnerInfo?.address}
                    </p>
                  </div>
                  <div className="border-l-4 border-(--color-primary) pl-4">
                    <p className="text-xs text-(--color-text-muted) uppercase tracking-wider mb-1">
                      Email
                    </p>
                    <p className="text-base font-medium text-(--color-primary) cursor-pointer hover:underline">
                      {partnerInfo?.email}
                    </p>
                  </div>
                  <div className="border-l-4 border-(--color-primary) pl-4">
                    <p className="text-xs text-(--color-text-muted) uppercase tracking-wider mb-1">
                      Phone
                    </p>
                    <p className="text-base font-medium">
                      {partnerInfo?.phone}
                    </p>
                  </div>
                  <div className="border-l-4 border-(--color-primary) pl-4">
                    <p className="text-xs text-(--color-text-muted) uppercase tracking-wider mb-1">
                      Last visited
                    </p>
                    <p className="text-base font-medium">
                      {partnerInfo?.lastVisited}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notification Section */}
              <div className="w-full max-w-md border-t border-(--color-border) pt-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Notification</h3>
                  <button
                    onClick={() => setNotificationEnabled(!notificationEnabled)}
                    className={cn(
                      "relative inline-flex h-6 w-11 rounded-full transition-colors",
                      notificationEnabled
                        ? "bg-(--color-primary)"
                        : "bg-(--color-border)"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
                        notificationEnabled
                          ? "translate-x-6"
                          : "translate-x-0.5"
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* File type Section */}
              <div className="w-full max-w-md border-t border-(--color-border) pt-8">
                <h3 className="text-sm font-semibold mb-4">File type</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-(--color-elevated) rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-(--color-primary)/20 rounded flex items-center justify-center">
                        <FileText className="h-5 w-5 text-(--color-primary)" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Document</p>
                        <p className="text-xs text-(--color-text-muted)">
                          1 KB, 321MiB
                        </p>
                      </div>
                    </div>
                    <MoreVertical className="h-4 w-4 text-(--color-text-muted)" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-(--color-elevated) rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-(--color-primary)/20 rounded flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-(--color-primary)" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Photos</p>
                        <p className="text-xs text-(--color-text-muted)">
                          53 File, 321MiB
                        </p>
                      </div>
                    </div>
                    <MoreVertical className="h-4 w-4 text-(--color-text-muted)" />
                  </div>
                </div>
              </div>
            </div>
          </main>
        ) : (
          <main className={cn("flex-1 flex flex-col bg-(--color-background) relative", isMobile && showMobileSidebar && "hidden")}>
            {selectedChat ? (
              <>
                {/* Chat Header */}
                <header className="h-16 border-b border-(--color-border) flex items-center justify-between px-4 md:px-6 bg-(--color-surface) sticky top-0 z-10">
                  <div className="flex items-center flex-1">
                    {isMobile && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 mr-2"
                        onClick={() => setShowMobileSidebar(true)}
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </Button>
                    )}
                    <Avatar
                      size="md"
                      status={chatPartner?.status}
                      fallback={
                        chatPartner?.name?.charAt(0) ||
                        selectedChat.name?.charAt(0)
                      }
                    />
                    <div className="ml-4 flex-1">
                      <h2
                        className="text-base font-semibold cursor-pointer hover:text-(--color-primary) transition-colors"
                        onClick={() => setIsViewingProfileOnly(true)}
                      >
                        {selectedChat.type === "group"
                          ? selectedChat.name
                          : chatPartner?.name}
                      </h2>
                      <p className="text-xs text-(--color-text-muted) mt-0.5">
                        {chatPartner?.status === "online" && "Active now"}
                        {chatPartner?.status === "offline" &&
                          chatPartner?.lastSeen}
                        {chatPartner?.status === "busy" && "Busy"}
                        {(typingUsers[selectedChatId || ""]?.length ?? 0) >
                          0 && (
                          <TypingLabel
                            name={(() => {
                              const typingId = typingUsers[selectedChatId || ""]?.[0];
                              if (!typingId) return undefined;
                              const typingChat = chats.find(c => c.id === selectedChatId);
                              const typer = typingChat?.participants.find(p => p.id === typingId);
                              return typer?.name;
                            })()}
                          />
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setIsModalOpen(true)}
                      title="Expand"
                    >
                      <Expand className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                      <Phone className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                      <Search className="h-5 w-5" />
                    </Button>
                  </div>
                </header>

                {/* Messages */}
                <div
                  ref={messagesContainerRef}
                  className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3 md:space-y-4 custom-scrollbar flex flex-col bg-(--color-background)"
                >
                  {/* Infinite-scroll sentinel — sits at the very top */}
                  <div ref={topSentinelRef} className="h-px" />

                  {/* Loading spinner when fetching older messages */}
                  {isLoadingMore && (
                    <div className="flex justify-center py-2">
                      <Loader2 className="h-5 w-5 animate-spin text-(--color-text-muted)" />
                    </div>
                  )}

                  {/* "All caught up" indicator when no more pages */}
                  {!hasMore[selectedChatId ?? ""] && activeMessages.length > 0 && (
                    <p className="text-center text-xs text-(--color-text-muted) py-1 opacity-50">
                      Beginning of conversation
                    </p>
                  )}

                  {activeMessages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-(--color-text-muted) text-sm md:text-base">
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    activeMessages.map((msg) => {
                      const isMine = msg.senderId === currentUser.id;
                      const sender = msg.sender;
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex max-w-[85%] md:max-w-[75%]",
                            isMine ? "self-end" : "self-start"
                          )}
                        >
                          {!isMine && selectedChat.type === "group" && (
                            <Avatar
                              size="sm"
                              className="mr-3 self-end mb-1"
                              fallback={sender?.name?.charAt(0)}
                            />
                          )}
                          <div className="flex flex-col">
                            {!isMine && selectedChat.type === "group" && (
                              <p className="text-xs text-(--color-text-muted) mb-1 ml-0.5">
                                {sender?.name}
                              </p>
                            )}
                            <div className="group/msg relative">
                              {/* Reply button on hover */}
                              <button
                                onClick={() => setReplyToMessage(msg)}
                                className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded-full hover:bg-(--color-elevated) text-(--color-text-muted) hover:text-(--color-primary)"
                                title="Reply"
                              >
                                <Reply className="h-4 w-4" />
                              </button>
                              {/* Reply quote */}
                              {msg.replyTo && (
                                <div className="mb-1 px-3 py-1.5 rounded-lg bg-black/10 border-l-2 border-(--color-primary)/50">
                                  <p className="text-[11px] font-semibold text-(--color-primary)">
                                    {msg.replyTo.senderName}
                                  </p>
                                  <p className="text-[11px] text-(--color-text-muted) truncate max-w-[200px]">
                                    {msg.replyTo.content}
                                  </p>
                                </div>
                              )}
                              <div
                                className={cn(
                                  "px-4 py-2.5 rounded-2xl text-sm break-words shadow-sm",
                                  isMine
                                    ? "bg-(--color-primary) text-white rounded-br-none"
                                    : "bg-(--color-elevated) text-(--color-text-primary) rounded-bl-none border border-(--color-border)",
                                  msg.status === "sending" && "opacity-70"
                                )}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setReplyToMessage(msg);
                                }}
                              >
                              {msg.type === "text" ? (
                                <p className="leading-relaxed">
                                  {msg.content}
                                </p>
                              ) : (
                                <div className="space-y-1">
                                  {/* Voice message */}
                                  {msg.content?.startsWith("🎤") || msg.file?.name?.includes("voice-") ? (
                                    <div className="p-2">
                                      <AudioMessage
                                        src={msg.file?.url || (msg.file?.name ? `/uploads/${msg.file.name}` : "")}
                                        duration={0}
                                        isMine={isMine}
                                      />
                                    </div>
                                  ) : /* Image message */
                                  isImageFile(msg.file?.name) || msg.file?.url?.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i) ? (
                                    <div className="p-1">
                                      <ImageMessage
                                        src={msg.file?.url || (msg.file?.name ? `/uploads/${msg.file.name}` : "")}
                                        alt={msg.file?.name || "Image"}
                                        isMine={isMine}
                                        onClick={() => {
                                          setLightboxImage(msg.file?.url || (msg.file?.name ? `/uploads/${msg.file.name}` : ""));
                                          setLightboxAlt(msg.file?.name || "Image");
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    /* Generic file */
                                    <div className="flex items-center space-x-3 bg-black/20 p-3 rounded-lg">
                                      <div className="h-10 w-10 bg-white/10 rounded flex items-center justify-center">
                                        <Paperclip className="h-5 w-5" />
                                      </div>
                                      <div>
                                        <p className="font-medium text-sm">
                                          {msg.file?.name}
                                        </p>
                                        <p className="text-xs opacity-70">
                                          {msg.file?.size}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            </div>
                            <span
                              className={cn(
                                "text-[11px] text-(--color-text-muted) mt-1 px-1",
                                isMine ? "text-right" : "text-left"
                              )}
                            >
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {isMine && (
                                <ReadReceipt status={msg.status as any} className="ml-1" />
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <TypingIndicator
                    className={cn(
                      (typingUsers[selectedChatId || ""]?.length ?? 0) === 0 && "hidden"
                    )}
                  />
                  <div ref={messagesEndRef} />
                </div>

                {/* Composer */}
                <div className="px-4 py-3 bg-(--color-surface) border-t border-(--color-border)">
                  {replyToMessage && (
                    <div className="mb-2 px-3 py-2 bg-(--color-elevated) rounded-xl border border-(--color-border) flex items-center justify-between">
                      <div className="flex items-center min-w-0">
                        <Reply className="h-4 w-4 text-(--color-primary) mr-2 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-(--color-primary)">
                            Replying to {replyToMessage.sender?.name}
                          </p>
                          <p className="text-xs text-(--color-text-muted) truncate">
                            {replyToMessage.content}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setReplyToMessage(null)}
                        className="ml-2 p-1 rounded-full hover:bg-(--color-border) transition-colors"
                      >
                        <X className="h-3.5 w-3.5 text-(--color-text-muted)" />
                      </button>
                    </div>
                  )}
                  {isRecordingVoice ? (
                    <VoiceRecorder
                      onSend={handleVoiceSend}
                      onCancel={() => setIsRecordingVoice(false)}
                    />
                  ) : (
                    <div className="flex items-center space-x-2 bg-(--color-background) rounded-full px-3 py-2 border border-(--color-border) focus-within:border-(--color-primary) focus-within:ring-1 focus-within:ring-(--color-primary)/20 transition-all">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip,.rar,.txt"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-(--color-text-muted) hover:text-(--color-primary) transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        title="Attach file"
                      >
                        {isUploading ? (
                          <div className="h-4 w-4 border-2 border-(--color-primary) border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Paperclip className="h-5 w-5" />
                        )}
                      </Button>
                      <Input
                        ref={messageInputRef}
                        placeholder="Type a message..."
                        className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 px-1 text-sm placeholder:text-(--color-text-muted)"
                        value={newMessage}
                        onChange={(e) => {
                          setNewMessage(e.target.value);
                          handleTyping();
                        }}
                        onKeyDown={handleKeyDown}
                      />
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-(--color-text-muted) hover:text-(--color-primary) transition-colors"
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          title="Emoji"
                        >
                          <Smile className="h-5 w-5" />
                        </Button>
                        {showEmojiPicker && (
                          <EmojiPicker
                            onSelect={handleEmojiSelect}
                            onClose={() => setShowEmojiPicker(false)}
                          />
                        )}
                      </div>
                      {/* Microphone button — show when input is empty, show send when typing */}
                      {newMessage.trim() ? (
                        <Button
                          size="icon"
                          className="h-8 w-8 rounded-full bg-(--color-primary) text-white hover:bg-(--color-primary)/90 transition-all"
                          title="Send message"
                          onClick={handleSendMessage}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          size="icon"
                          className="h-8 w-8 rounded-full bg-(--color-primary) text-white hover:bg-(--color-primary)/90 transition-all"
                          title="Record voice message"
                          onClick={() => setIsRecordingVoice(true)}
                        >
                          <Mic className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-(--color-surface) to-(--color-background)">
                <div className="h-24 w-24 bg-(--color-elevated) rounded-full flex items-center justify-center mb-6 shadow-2xl border border-(--color-border)">
                  <Lock className="h-10 w-10 text-(--color-primary)" />
                </div>
                <h2 className="text-2xl font-bold mb-2">SecureChat</h2>
                <p className="text-(--color-text-muted) max-w-sm mb-8">
                  Select a conversation to start a private messaging session.
                </p>
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-(--color-elevated) border border-(--color-border) text-sm font-medium text-(--color-text-muted)">
                  <Lock className="h-4 w-4 mr-2" /> End-to-End Encrypted
                </div>
              </div>
            )}
          </main>
        )}
      </div>

      {/* Chat Modal */}
      {isModalOpen && selectedChat && chatPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full h-full max-w-5xl max-h-[90vh] bg-(--color-background) md:rounded-2xl shadow-2xl flex overflow-hidden">
            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
              {/* Header */}
              <div className="h-16 border-b border-(--color-border) flex items-center justify-between px-6 bg-(--color-surface)">
                <div className="flex items-center flex-1">
                  <Avatar
                    size="md"
                    status={chatPartner?.status}
                    fallback={chatPartner?.name?.charAt(0)}
                  />
                  <div className="ml-4 flex-1">
                    <h2 className="text-base font-semibold">
                      {chatPartner?.name}
                    </h2>
                    <p className="text-xs text-(--color-text-muted) mt-0.5">
                      {chatPartner?.status === "online" && "Active now"}
                      {chatPartner?.status === "offline" &&
                        chatPartner?.lastSeen}
                      {chatPartner?.status === "busy" && "Busy"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Phone className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Search className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 ml-4"
                    onClick={() => setIsModalOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar flex flex-col bg-(--color-background)">
                {activeMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-(--color-text-muted)">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  activeMessages.map((msg) => {
                    const isMine = msg.senderId === currentUser.id;
                    const sender = msg.sender;
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex max-w-[85%] md:max-w-[75%]",
                          isMine ? "self-end" : "self-start"
                        )}
                      >
                        {!isMine && selectedChat.type === "group" && (
                          <Avatar
                            size="sm"
                            className="mr-3 self-end mb-1"
                            fallback={sender?.name?.charAt(0)}
                          />
                        )}
                        <div className="flex flex-col">
                          {!isMine && selectedChat.type === "group" && (
                            <p className="text-xs text-(--color-text-muted) mb-1 ml-0.5">
                              {sender?.name}
                            </p>
                          )}
                          <div
                            className={cn(
                              "px-4 py-2.5 rounded-2xl text-sm break-words shadow-sm",
                              isMine
                                ? "bg-(--color-primary) text-white rounded-br-none"
                                : "bg-(--color-elevated) text-(--color-text-primary) rounded-bl-none border border-(--color-border)",
                              msg.status === "sending" && "opacity-70"
                            )}
                          >
                            {msg.type === "text" ? (
                              <p className="leading-relaxed">{msg.content}</p>
                            ) : (
                              <div className="space-y-1">
                                {msg.content?.startsWith("🎤") || msg.file?.name?.includes("voice-") ? (
                                  <div className="p-2">
                                    <AudioMessage
                                      src={msg.file?.url || (msg.file?.name ? `/uploads/${msg.file.name}` : "")}
                                      duration={0}
                                      isMine={isMine}
                                    />
                                  </div>
                                ) : isImageFile(msg.file?.name) || msg.file?.url?.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i) ? (
                                  <div className="p-1">
                                    <ImageMessage
                                      src={msg.file?.url || (msg.file?.name ? `/uploads/${msg.file.name}` : "")}
                                      alt={msg.file?.name || "Image"}
                                      isMine={isMine}
                                      onClick={() => {
                                        setLightboxImage(msg.file?.url || (msg.file?.name ? `/uploads/${msg.file.name}` : ""));
                                        setLightboxAlt(msg.file?.name || "Image");
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-3 bg-black/20 p-3 rounded-lg">
                                    <div className="h-10 w-10 bg-white/10 rounded flex items-center justify-center">
                                      <Paperclip className="h-5 w-5" />
                                    </div>
                                    <div>
                                      <p className="font-medium text-sm">
                                        {msg.file?.name}
                                      </p>
                                      <p className="text-xs opacity-70">
                                        {msg.file?.size}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-[11px] text-(--color-text-muted) mt-1 px-1",
                              isMine ? "text-right" : "text-left"
                            )}
                          >
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {isMine && msg.status === "sending" && " ⏳"}
                            {isMine && msg.status === "sent" && " ✓"}
                            {isMine && msg.status === "delivered" && " ✓✓"}
                            {isMine && msg.status === "read" && " ✓✓"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <div className="px-4 py-3 bg-(--color-surface) border-t border-(--color-border)">
                {isRecordingVoice ? (
                  <VoiceRecorder
                    onSend={handleVoiceSend}
                    onCancel={() => setIsRecordingVoice(false)}
                  />
                ) : (
                  <div className="flex items-center space-x-2 bg-(--color-background) rounded-full px-3 py-2 border border-(--color-border) focus-within:border-(--color-primary) focus-within:ring-1 focus-within:ring-(--color-primary)/20 transition-all">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-(--color-text-muted) hover:text-(--color-primary) transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      title="Attach file"
                    >
                      {isUploading ? (
                        <div className="h-4 w-4 border-2 border-(--color-primary) border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Paperclip className="h-5 w-5" />
                      )}
                    </Button>
                    <Input
                      placeholder="Type a message..."
                      className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 px-1 text-sm placeholder:text-(--color-text-muted)"
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping();
                      }}
                      onKeyDown={handleKeyDown}
                    />
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-(--color-text-muted) hover:text-(--color-primary) transition-colors"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        title="Emoji"
                      >
                        <Smile className="h-5 w-5" />
                      </Button>
                      {showEmojiPicker && (
                        <EmojiPicker
                          onSelect={handleEmojiSelect}
                          onClose={() => setShowEmojiPicker(false)}
                        />
                      )}
                    </div>
                    {newMessage.trim() ? (
                      <Button
                        size="icon"
                        className="h-8 w-8 rounded-full bg-(--color-primary) text-white hover:bg-(--color-primary)/90 transition-all"
                        title="Send message"
                        onClick={handleSendMessage}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        className="h-8 w-8 rounded-full bg-(--color-primary) text-white hover:bg-(--color-primary)/90 transition-all"
                        title="Record voice message"
                        onClick={() => setIsRecordingVoice(true)}
                      >
                        <Mic className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel - Contact Info */}
            <div className="w-80 border-l border-(--color-border) bg-(--color-sidebar) flex-col overflow-y-auto custom-scrollbar hidden md:flex">
              <div className="p-6 flex flex-col items-center border-b border-(--color-border)">
                <Avatar
                  size="xl"
                  status={chatPartner?.status}
                  fallback={chatPartner?.name?.charAt(0)}
                  className="mb-4 shadow-xl"
                />
                <h2 className="text-lg font-semibold">{chatPartner?.name}</h2>
                <p className="text-sm text-(--color-text-muted) mb-4">
                  {chatPartner?.status === "online" && "🟢 Available"}
                  {chatPartner?.status === "offline" && "🔴 Away"}
                  {chatPartner?.status === "busy" && "🟠 Busy"}
                </p>

                {/* Quick Actions */}
                <div className="flex space-x-6 w-full justify-center mt-4">
                  <div className="flex flex-col items-center text-(--color-text-muted) hover:text-(--color-primary) cursor-pointer transition-colors">
                    <div className="h-10 w-10 bg-(--color-elevated) rounded-full flex items-center justify-center mb-1">
                      <Phone className="h-4 w-4" />
                    </div>
                    <span className="text-xs">Audio</span>
                  </div>
                  <div className="flex flex-col items-center text-(--color-text-muted) hover:text-(--color-primary) cursor-pointer transition-colors">
                    <div className="h-10 w-10 bg-(--color-elevated) rounded-full flex items-center justify-center mb-1">
                      <Search className="h-4 w-4" />
                    </div>
                    <span className="text-xs">Search</span>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Information Section */}
                <div>
                  <h3 className="text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider mb-4">
                    Information
                  </h3>
                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="text-xs text-(--color-text-muted) uppercase tracking-wider mb-1">
                        Address
                      </p>
                      <p>{partnerInfo?.address || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-(--color-text-muted) uppercase tracking-wider mb-1">
                        Email
                      </p>
                      <p className="text-(--color-primary) cursor-pointer hover:underline">
                        {partnerInfo?.email || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-(--color-text-muted) uppercase tracking-wider mb-1">
                        Phone
                      </p>
                      <p>{partnerInfo?.phone || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-(--color-text-muted) uppercase tracking-wider mb-1">
                        Last visited
                      </p>
                      <p>{partnerInfo?.lastVisited || "N/A"}</p>
                    </div>
                  </div>
                </div>

                {/* Notification Section */}
                <div className="border-t border-(--color-border) pt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Notification</h3>
                    <button
                      onClick={() =>
                        setNotificationEnabled(!notificationEnabled)
                      }
                      className={cn(
                        "relative inline-flex h-6 w-11 rounded-full transition-colors",
                        notificationEnabled
                          ? "bg-(--color-primary)"
                          : "bg-(--color-border)"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
                          notificationEnabled
                            ? "translate-x-6"
                            : "translate-x-0.5"
                        )}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxImage && (
        <Lightbox
          src={lightboxImage}
          alt={lightboxAlt}
          onClose={() => setLightboxImage(null)}
        />
      )}

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        token={token}
        currentUserId={currentUser?.id ?? ""}
        onChatCreated={(chatId) => {
          setSelectedChatId(chatId);
          setIsViewingProfileOnly(false);
          if (isMobile) setShowMobileSidebar(false);
          // Wait a tick for the UI to transition, then fetch fresh chats
          setTimeout(() => fetchChats(), 50);
        }}
      />
    </>
  );
}
