/**
 * UserRepository — owns all SQL queries touching the `users` table.
 *
 * SOLID:
 *   - SRP: Route handlers no longer contain SQL; this class does.
 *   - OCP: Add new queries here without touching any route file.
 *   - DIP: Routes depend on UserRepository (abstraction), not `pool` directly.
 */

import { Pool } from "pg";

export interface DbUser {
  id: string;
  username: string;
  phone_number: string | null;
  avatar_url: string | null;
  created_at: string;
  password_hash?: string;
}

export class UserRepository {
  constructor(private readonly pool: Pool) {}

  /** Find a user by their primary key. */
  async findById(id: string): Promise<DbUser | null> {
    const result = await this.pool.query<DbUser>(
      "SELECT id, username, phone_number, avatar_url, created_at FROM users WHERE id = $1",
      [id]
    );
    return result.rows[0] ?? null;
  }

  /** Find a user by phone number (normalized, no spaces). */
  async findByPhone(phoneNumber: string): Promise<DbUser | null> {
    const result = await this.pool.query<DbUser>(
      "SELECT id, username, phone_number, avatar_url, created_at FROM users WHERE phone_number = $1",
      [phoneNumber]
    );
    return result.rows[0] ?? null;
  }

  /** Find a user by username (for legacy password auth). */
  async findByUsername(username: string): Promise<(DbUser & { password_hash: string }) | null> {
    const result = await this.pool.query<DbUser & { password_hash: string }>(
      "SELECT id, username, password_hash, phone_number, avatar_url, created_at FROM users WHERE username = $1",
      [username]
    );
    return result.rows[0] ?? null;
  }

  /** Check if a username is already taken. */
  async usernameExists(username: string): Promise<boolean> {
    const result = await this.pool.query(
      "SELECT id FROM users WHERE username = $1",
      [username]
    );
    return result.rows.length > 0;
  }

  /** Create a new user with a hashed password (legacy auth). */
  async createWithPassword(username: string, passwordHash: string): Promise<DbUser> {
    const result = await this.pool.query<DbUser>(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, avatar_url, created_at",
      [username, passwordHash]
    );
    return result.rows[0];
  }

  /** Create a new user identified by phone number (OTP auth). */
  async createWithPhone(username: string, phoneNumber: string): Promise<DbUser> {
    const result = await this.pool.query<DbUser>(
      `INSERT INTO users (username, password_hash, phone_number)
       VALUES ($1, 'otp-auth', $2)
       RETURNING id, username, phone_number, avatar_url, created_at`,
      [username, phoneNumber]
    );
    return result.rows[0];
  }

  /** Update a user's username. */
  async updateUsername(id: string, username: string): Promise<DbUser | null> {
    const result = await this.pool.query<DbUser>(
      "UPDATE users SET username = $1 WHERE id = $2 RETURNING id, username, phone_number, avatar_url, created_at",
      [username, id]
    );
    return result.rows[0] ?? null;
  }
}
