import { pool } from "./pool";

const SCHEMA = `
-- ============================================================
-- ChatX Schema v3 — E2E Encryption
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

CREATE INDEX IF NOT EXISTS idx_otp_lookup
  ON otp_codes(phone_number, code, used)
  WHERE used = false;

-- Public Keys for E2E Enc
CREATE TABLE IF NOT EXISTS public_keys (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  identity_key      TEXT NOT NULL,
  signed_prekey     TEXT NOT NULL,
  signed_prekey_sig TEXT NOT NULL,
  signed_prekey_id  INT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS one_time_prekeys (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_id     INT NOT NULL,
  public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opk_user ON one_time_prekeys(user_id);

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
-- Replaced plaintext 'content' with E2E encrypted fields
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ciphertext      TEXT NOT NULL,
  nonce           TEXT NOT NULL,
  ratchet_header  JSONB NOT NULL,
  msg_number      INT NOT NULL DEFAULT 0,
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
  console.log("Running migration v3...");
  try {
    // Drop the old messages table completely to start fresh for v3 
    // since we changed the schema destructively (this is acceptable for this step)
    await pool.query(`DROP TABLE IF EXISTS messages CASCADE;`);
    await pool.query(SCHEMA);
    console.log("✓ Migration complete — schema v3 applied");
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
