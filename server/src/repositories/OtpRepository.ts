/**
 * OtpRepository — owns all SQL queries touching the `otp_codes` table.
 *
 * SOLID:
 *   - SRP: OTP persistence logic isolated; route/socket handlers don't know about DB columns.
 *   - OCP: Change OTP storage (e.g., Redis) by swapping this class alone.
 */

import { Pool } from "pg";

export interface DbOtp {
  id: string;
  phone_number: string;
  code: string;
  user_id: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

export class OtpRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Invalidate all unused OTPs for a phone number, then insert a new one.
   * Always call this before inserting a fresh OTP.
   */
  async invalidatePrevious(phoneNumber: string): Promise<void> {
    await this.pool.query(
      "UPDATE otp_codes SET used = true WHERE phone_number = $1 AND used = false",
      [phoneNumber]
    );
  }

  /** Persist a new OTP code. */
  async create(
    phoneNumber: string,
    code: string,
    userId: string,
    expiresAt: Date
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO otp_codes (phone_number, code, user_id, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [phoneNumber, code, userId, expiresAt]
    );
  }

  /**
   * Find the most recent unused OTP for the given phone + code combination.
   * Returns null if no valid match is found.
   */
  async findValid(phoneNumber: string, code: string): Promise<DbOtp | null> {
    const result = await this.pool.query<DbOtp>(
      `SELECT id, user_id, expires_at
       FROM otp_codes
       WHERE phone_number = $1 AND code = $2 AND used = false
       ORDER BY created_at DESC
       LIMIT 1`,
      [phoneNumber, code]
    );
    return result.rows[0] ?? null;
  }

  /** Mark a specific OTP record as used. */
  async markUsed(id: string): Promise<void> {
    await this.pool.query("UPDATE otp_codes SET used = true WHERE id = $1", [id]);
  }
}
