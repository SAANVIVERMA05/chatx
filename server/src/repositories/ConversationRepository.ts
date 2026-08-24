/**
 * ConversationRepository — owns all SQL queries touching `conversations`
 * and `conversation_members`.
 *
 * SOLID:
 *   - SRP: All conversation persistence logic lives here.
 *   - OCP: Add features (pinning, archiving) without touching route handlers.
 */

import { Pool, PoolClient } from "pg";

export interface DbConversation {
  id: string;
  type: "direct" | "group";
  name: string | null;
  created_at: string;
  members?: DbConversationMember[];
  last_message?: DbLastMessage | null;
  unread_count?: number;
}

export interface DbConversationMember {
  id: string;
  username: string;
  avatar_url: string | null;
}

export interface DbLastMessage {
  id: string;
  content: string;
  sender_id: string;
  sender_username: string;
  created_at: string;
}

export class ConversationRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Check if a user is a member of a conversation.
   */
  async isMember(conversationId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      "SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Find all conversations for a user, ordered by most recent message.
   * Includes last message, member list, and unread count.
   */
  async findForUser(userId: string): Promise<DbConversation[]> {
    const result = await this.pool.query<DbConversation>(
      `SELECT
        c.id, c.type, c.name, c.created_at, cm.joined_at,
        (SELECT json_build_object(
          'id', m.id, 'content', m.content,
          'sender_id', m.sender_id, 'sender_username', u2.username,
          'created_at', m.created_at
        )
        FROM messages m
        JOIN users u2 ON u2.id = m.sender_id
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC LIMIT 1
        ) AS last_message,
        (SELECT json_agg(json_build_object(
          'id', u3.id, 'username', u3.username, 'avatar_url', u3.avatar_url
        ))
        FROM conversation_members cm2
        JOIN users u3 ON u3.id = cm2.user_id
        WHERE cm2.conversation_id = c.id
        ) AS members,
        (SELECT COUNT(*)
        FROM messages m2
        WHERE m2.conversation_id = c.id
          AND m2.sender_id != $1
          AND m2.read_at IS NULL
        )::int AS unread_count
      FROM conversations c
      JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = $1
      ORDER BY
        (SELECT MAX(m3.created_at) FROM messages m3 WHERE m3.conversation_id = c.id) DESC NULLS LAST,
        c.created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Find a single conversation with its members.
   * Returns null if not found.
   */
  async findById(conversationId: string): Promise<DbConversation | null> {
    const result = await this.pool.query<DbConversation>(
      `SELECT c.*, json_agg(json_build_object(
         'id', u.id, 'username', u.username, 'avatar_url', u.avatar_url
       )) AS members
       FROM conversations c
       JOIN conversation_members cm ON cm.conversation_id = c.id
       JOIN users u ON u.id = cm.user_id
       WHERE c.id = $1
       GROUP BY c.id`,
      [conversationId]
    );
    return result.rows[0] ?? null;
  }

  /**
   * Find an existing direct conversation between two users.
   * Returns the conversation id or null.
   */
  async findDirectBetween(userId1: string, userId2: string): Promise<string | null> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT c.id
       FROM conversations c
       WHERE c.type = 'direct'
         AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = $1)
         AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = $2)
       LIMIT 1`,
      [userId1, userId2]
    );
    return result.rows[0]?.id ?? null;
  }

  /**
   * Create a new conversation and add all given members.
   * Runs in a transaction for atomicity.
   */
  async create(
    type: "direct" | "group",
    name: string | null,
    memberIds: string[]
  ): Promise<DbConversation> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const convResult = await client.query<DbConversation>(
        "INSERT INTO conversations (type, name) VALUES ($1, $2) RETURNING id, type, name, created_at",
        [type, type === "group" ? name : null]
      );
      const conversation = convResult.rows[0];

      for (const memberId of memberIds) {
        await client.query(
          "INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2)",
          [conversation.id, memberId]
        );
      }

      await client.query("COMMIT");

      // Fetch full conversation with members
      const full = await this.findById(conversation.id);
      return full!;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
