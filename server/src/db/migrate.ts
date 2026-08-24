import { pool } from "./pool";

const SCHEMA = `
-- ============================================================
-- ChatX Schema v2 — phone-based auth + file uploads
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(30)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL DEFAULT 'otp-auth',
  phone_number  VARCHAR(20)  UNIQUE,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- OTP codes for phone verification
CREATE TABLE IF NOT EXISTS otp_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number  VARCHAR(20)  NOT NULL,
  code          VARCHAR(10)  NOT NULL,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ  NOT NULL,
  used          BOOLEAN      NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Index for OTP lookups (phone + unused + not expired)
CREATE INDEX IF NOT EXISTS idx_otp_lookup
  ON otp_codes(phone_number, code, used)
  WHERE used = false;

-- Conversations (direct or group)
CREATE TABLE IF NOT EXISTS conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       VARCHAR(10) NOT NULL CHECK (type IN ('direct', 'group')),
  name       VARCHAR(100), -- NULL for direct chats
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Conversation membership
CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  message_type    VARCHAR(10) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'image', 'video')),
  file_url        TEXT,
  file_name       TEXT,
  file_size       BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_sender
  ON messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_conv_members_user
  ON conversation_members(user_id);

CREATE INDEX IF NOT EXISTS idx_users_phone
  ON users(phone_number);
`;

async function migrate() {
  console.log("Running migration v2...");
  try {
    await pool.query(SCHEMA);
    console.log("✓ Migration complete — schema v2 applied");
  } catch (err) {
    console.error("✗ Migration failed:", (err as Error).message);
    process.exit(1);
  }
  // NOTE: Do NOT call pool.end() here.
  // When called from index.ts the pool must stay open for the whole server lifetime.
  // pool.end() is only called in the script-only branch below.
}

export { migrate as runMigration };

// Run directly if called as a standalone script (e.g. `ts-node src/db/migrate.ts`)
if (require.main === module || process.argv[1]?.endsWith("migrate.ts")) {
  migrate().finally(() => pool.end());
}
