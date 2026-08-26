/**
 * MessageRepository — owns all SQL queries touching the `messages` table.
 *
 * SOLID:
 *   - SRP: Message persistence is fully isolated.
 *   - OCP: Add search, reactions, etc. here without touching socket.ts or routes.
 *   - DIP: socket.ts and routes depend on this, not on `pool` directly.
 */

import { Pool } from "pg";

export interface DbMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_username: string;
  sender_avatar_url?: string;
  ciphertext: string;
  nonce: string;
  ratchet_header: Record<string, unknown>;
  msg_number: number;
  message_type: "text" | "file" | "image" | "video";
  file_url: string | null;
  file_name: string | null;
  file_size: bigint | null;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
}

export interface InsertMessageParams {
  conversationId: string;
  senderId: string;
  ciphertext: string;
  nonce: string;
  ratchetHeader: Record<string, unknown>;
  msgNumber: number;
  messageType?: string;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: string | null;
}

export class MessageRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Insert a new message and return it with sender info joined.
   */
  async insert(params: InsertMessageParams): Promise<DbMessage> {
    const result = await this.pool.query<DbMessage>(
      `INSERT INTO messages
         (conversation_id, sender_id, ciphertext, nonce, ratchet_header, msg_number, message_type, file_url, file_name, file_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, conversation_id, sender_id, ciphertext, nonce, ratchet_header, msg_number, created_at,
                 delivered_at, read_at, message_type, file_url, file_name, file_size`,
      [
        params.conversationId,
        params.senderId,
        params.ciphertext,
        params.nonce,
        params.ratchetHeader,
        params.msgNumber,
        params.messageType || "text",
        params.fileUrl ?? null,
        params.fileName ?? null,
        params.fileSize ?? null,
      ]
    );
    return result.rows[0];
  }

  /**
   * Get messages for a conversation (newest first), with optional cursor-based pagination.
   */
  async getForConversation(
    conversationId: string,
    limit: number,
    beforeMessageId?: string
  ): Promise<DbMessage[]> {
    const params: unknown[] = [conversationId];
    let query = `
      SELECT
        m.id, m.conversation_id, m.sender_id,
        u.username AS sender_username,
        u.avatar_url AS sender_avatar_url,
        m.ciphertext, m.nonce, m.ratchet_header, m.msg_number, m.created_at, m.delivered_at, m.read_at,
        m.message_type, m.file_url, m.file_name, m.file_size
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = $1
    `;

    if (beforeMessageId) {
      params.push(beforeMessageId);
      query += ` AND m.created_at < (SELECT created_at FROM messages WHERE id = $${params.length})`;
    }

    params.push(limit);
    query += ` ORDER BY m.created_at DESC LIMIT $${params.length}`;

    const result = await this.pool.query<DbMessage>(query, params);
    return result.rows;
  }

  /**
   * Mark all unread messages in a conversation (not sent by the given user) as read.
   * Returns the id and sender_id of each newly-read message so the caller can
   * fan-out individual { type:"read", msgId } events to sender personal rooms.
   */
  async markRead(
    conversationId: string,
    readerUserId: string
  ): Promise<Array<{ id: string; sender_id: string }>> {
    const result = await this.pool.query<{ id: string; sender_id: string }>(
      `UPDATE messages
       SET read_at = now()
       WHERE conversation_id = $1
         AND sender_id != $2
         AND read_at IS NULL
       RETURNING id, sender_id`,
      [conversationId, readerUserId]
    );
    return result.rows;
  }

  /**
   * Mark all un-delivered messages in a conversation (not sent by the given user)
   * as delivered. Returns the id and sender_id of each newly-delivered message so
   * the caller can fan-out individual { type:"delivered", msgId } events.
   */
  async markDelivered(
    conversationId: string,
    viewerUserId: string
  ): Promise<Array<{ id: string; sender_id: string }>> {
    const result = await this.pool.query<{ id: string; sender_id: string }>(
      `UPDATE messages
       SET delivered_at = now()
       WHERE conversation_id = $1
         AND sender_id != $2
         AND delivered_at IS NULL
       RETURNING id, sender_id`,
      [conversationId, viewerUserId]
    );
    return result.rows;
  }
  /**
   * Find all un-delivered messages across every conversation the given user
   * is a member of (excluding messages they sent themselves).
   * Used on socket reconnect to fan-out any pending delivery notifications.
   */
  async getPendingDelivered(
    userId: string
  ): Promise<Array<{ id: string; sender_id: string; conversation_id: string }>> {
    const result = await this.pool.query<{
      id: string;
      sender_id: string;
      conversation_id: string;
    }>(
      `SELECT m.id, m.sender_id, m.conversation_id
       FROM messages m
       JOIN conversation_members cm
         ON cm.conversation_id = m.conversation_id
        AND cm.user_id = $1
       WHERE m.sender_id != $1
         AND m.delivered_at IS NULL`,
      [userId]
    );
    return result.rows;
  }
}
