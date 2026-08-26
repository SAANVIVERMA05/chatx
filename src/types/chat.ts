/**
 * Canonical frontend type definitions.
 *
 * Single source of truth for all chat-related types in the client.
 * Import from here — never redefine these types in component or hook files.
 *
 * Note: The server uses snake_case field names (e.g. `sender_id`).
 * The frontend normalizes these to camelCase via `normalizeMessage()` in
 * SecureChatApp.tsx. Types here represent the normalized client-side shape.
 */

export type UserStatus = "online" | "offline" | "busy";

export interface ChatUser {
  id: string;
  name: string;
  avatar?: string;
  status: UserStatus;
}

export interface MessageFile {
  name: string;
  size: string;
  url?: string;
  progress?: number;
}

export interface ReplyTo {
  id: string;
  content: string;
  senderName: string;
}

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";
export type MessageType = "text" | "file" | "image" | "audio";

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  ciphertext: string;
  nonce: string;
  ratchetHeader: Record<string, unknown>;
  msgNumber: number;
  timestamp: string;
  status: MessageStatus;
  type: MessageType;
  file?: MessageFile;
  sender?: ChatUser;
  replyTo?: ReplyTo;
  // plaintext is populated on the client side after decryption
  plaintext?: string;
  content?: string;
}

export interface Chat {
  id: string;
  type: "direct" | "group";
  participants: ChatUser[];
  name?: string;
  avatar?: string;
  lastMessage?: Message;
  unreadCount: number;
  isEncrypted: boolean;
}

/**
 * Normalize a raw server message (snake_case) to the client Message shape.
 * Centralised here so it's easy to update when the API changes.
 */
export function normalizeMessage(raw: Record<string, unknown>): Message {
  return {
    id: raw.id as string,
    chatId:
      (raw.chatId as string) ||
      (raw.conversation_id as string) ||
      (raw.chat_id as string) ||
      "",
    senderId: (raw.senderId as string) || (raw.sender_id as string) || "",
    ciphertext: (raw.ciphertext as string) || "",
    nonce: (raw.nonce as string) || "",
    ratchetHeader: (raw.ratchetHeader as Record<string, unknown>) || (raw.ratchet_header as Record<string, unknown>) || {},
    msgNumber: (raw.msgNumber as number) || (raw.msg_number as number) || 0,
    plaintext: (raw.plaintext as string) || undefined,
    timestamp:
      (raw.timestamp as string) ||
      (raw.created_at as string) ||
      new Date().toISOString(),
    status: (raw.status as MessageStatus) || "sent",
    type:
      (raw.type as MessageType) ||
      (raw.message_type as MessageType) ||
      "text",
    file:
      (raw.file as MessageFile) ||
      (raw.file_url
        ? {
            name: (raw.file_name as string) || "file",
            size: (raw.file_size as string) || "",
            url: raw.file_url as string,
          }
        : undefined),
    sender:
      (raw.sender as ChatUser) ||
      (raw.sender_username
        ? {
            id: raw.sender_id as string,
            name: raw.sender_username as string,
            status: "online",
          }
        : undefined),
    replyTo:
      (raw.replyTo as ReplyTo) ||
      (raw.reply_to as ReplyTo) ||
      undefined,
  };
}
