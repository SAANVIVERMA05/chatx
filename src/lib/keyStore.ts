/**
 * keyStore.ts — Dexie.js (IndexedDB) encrypted key vault for ChatX.
 *
 * All private key bytes are wrapped (AES-256-GCM) before storage.
 * The master AES key lives in memory only; it is zeroed on lockVault().
 *
 * DB name:  chatx-keys   (separate from chatx-offline used by offlineQueue)
 * Version:  1
 *
 * Tables:
 *   meta           — salt + wrapped master key per userId
 *   identityKey    — wrapped Ed25519 identity keypair
 *   signedPrekey   — wrapped X25519 signed prekey (+ signature)
 *   oneTimePrekeys — wrapped X25519 one-time prekeys (+ used flag)
 */

import Dexie, { type Table } from "dexie";
import {
  deriveStorageKey,
  wrapRawKey,
  unwrapRawKey,
  generateSalt,
  toBase64,
  fromBase64,
  type KeyPair,
  type SignedPrekeyPair,
  type OneTimePrekeyPair,
} from "./crypto";

// ── Dexie record shapes (all private key fields are base64-encoded ciphertext) ─

interface MetaRecord {
  userId: string;
  salt: string;                    // base64 Argon2 salt
  wrappedMasterKey: string;        // base64 AES-GCM ciphertext of 32-byte master key
  wrappedMasterKeyIv: string;      // base64 AES-GCM IV
}

interface IdentityKeyRecord {
  userId: string;
  publicKey: string;               // base64 Ed25519 public key (32 bytes)
  wrappedPrivateKey: string;       // base64 encrypted Ed25519 private key (64 bytes)
  wrappedPrivateKeyIv: string;
}

interface SignedPrekeyRecord {
  userId: string;
  id: number;
  publicKey: string;               // base64 X25519 public key
  signature: string;               // base64 Ed25519 signature over publicKey
  wrappedPrivateKey: string;
  wrappedPrivateKeyIv: string;
  createdAt: string;               // ISO timestamp
}

interface OneTimePrekeyRecord {
  userId: string;
  id: number;
  publicKey: string;               // base64 X25519 public key
  wrappedPrivateKey: string;
  wrappedPrivateKeyIv: string;
  used: boolean;
}

interface RatchetStateRecord {
  userId: string;
  chatId: string;
  wrappedState: string;            // base64 AES-GCM ciphertext of JSON-serialized state
  wrappedStateIv: string;
}

// ── Exported public types (callers work with these) ────────────────────────────

export interface StoredIdentityKey {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface StoredSignedPrekey {
  id: number;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  signature: Uint8Array;
  createdAt: string;
}

export interface StoredOneTimePrekey {
  id: number;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

// ── Dexie database class ───────────────────────────────────────────────────────

class KeyVaultDB extends Dexie {
  meta!: Table<MetaRecord, string>;
  identityKey!: Table<IdentityKeyRecord, string>;
  signedPrekey!: Table<SignedPrekeyRecord, string>;
  oneTimePrekeys!: Table<OneTimePrekeyRecord, [string, number]>;
  ratchetStates!: Table<RatchetStateRecord, [string, string]>;

  constructor() {
    super("chatx-keys");
    this.version(2).stores({
      meta: "userId",
      identityKey: "userId",
      signedPrekey: "userId",
      oneTimePrekeys: "[userId+id], userId, used",
      ratchetStates: "[userId+chatId], userId",
    });
  }
}

// ── Module-level state ─────────────────────────────────────────────────────────

let _db: KeyVaultDB | null = null;
/** In-memory master AES-GCM key. Never leaves JS heap. Zeroed on lockVault(). */
let _masterKey: CryptoKey | null = null;
let _activeUserId: string | null = null;

function getDB(): KeyVaultDB {
  if (!_db) _db = new KeyVaultDB();
  return _db;
}

function requireMasterKey(): CryptoKey {
  if (!_masterKey) throw new Error("Key vault is locked — call setupKeyStore() first");
  return _masterKey;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Open (or create) the vault for a user.
 *
 * For NEW users: generates a random master key + salt, derives a storage key
 *   from the OTP via Argon2id, wraps the master key, persists to IDB.
 *
 * For RETURNING users: loads the salt from IDB, re-derives the storage key
 *   from the OTP, unwraps the master key into memory.
 *
 * After this call, _masterKey is available for wrap/unwrap.
 */
export async function setupKeyStore(userId: string, otp: string): Promise<void> {
  const db = getDB();
  const existing = await db.meta.get(userId);

  if (existing) {
    // Returning user — re-derive and unwrap
    const salt = fromBase64(existing.salt);
    const storageKey = await deriveStorageKey(otp, salt);
    const wrappedMasterKey = fromBase64(existing.wrappedMasterKey);
    const wrappedMasterKeyIv = fromBase64(existing.wrappedMasterKeyIv);
    const rawMasterKey = await unwrapRawKey(storageKey, wrappedMasterKey, wrappedMasterKeyIv);
    _masterKey = await crypto.subtle.importKey(
      "raw",
      // .slice() ensures plain ArrayBuffer backing required by WebCrypto
      rawMasterKey.slice(),
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  } else {
    // New user — generate and persist
    const salt = generateSalt();
    const storageKey = await deriveStorageKey(otp, salt);

    // Generate a random 256-bit master key
    const rawMasterKey = crypto.getRandomValues(new Uint8Array(32));
    const { ciphertext, iv } = await wrapRawKey(storageKey, rawMasterKey);

    await db.meta.put({
      userId,
      salt: toBase64(salt),
      wrappedMasterKey: toBase64(ciphertext),
      wrappedMasterKeyIv: toBase64(iv),
    });

    _masterKey = await crypto.subtle.importKey(
      "raw",
      rawMasterKey.slice(),
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  _activeUserId = userId;
}

/**
 * Returns true if key material already exists for this user in IDB.
 * Use this to decide whether to run initializeKeys (new) or unlockKeys (returning).
 */
export async function hasKeys(userId: string): Promise<boolean> {
  const db = getDB();
  const meta = await db.meta.get(userId);
  const identity = await db.identityKey.get(userId);
  return !!(meta && identity);
}

/**
 * Store an Ed25519 identity keypair (wrapped with master key).
 */
export async function storeIdentityKey(userId: string, kp: KeyPair): Promise<void> {
  const masterKey = requireMasterKey();
  const db = getDB();
  const { ciphertext, iv } = await wrapRawKey(masterKey, kp.privateKey);
  await db.identityKey.put({
    userId,
    publicKey: toBase64(kp.publicKey),
    wrappedPrivateKey: toBase64(ciphertext),
    wrappedPrivateKeyIv: toBase64(iv),
  });
}

/**
 * Retrieve and decrypt the Ed25519 identity keypair.
 */
export async function getIdentityKeyPair(userId: string): Promise<StoredIdentityKey> {
  const masterKey = requireMasterKey();
  const db = getDB();
  const record = await db.identityKey.get(userId);
  if (!record) throw new Error(`No identity key for user ${userId}`);
  const privateKey = await unwrapRawKey(
    masterKey,
    fromBase64(record.wrappedPrivateKey),
    fromBase64(record.wrappedPrivateKeyIv)
  );
  return {
    publicKey: fromBase64(record.publicKey),
    privateKey,
  };
}

/**
 * Store a signed prekey (wrapped with master key).
 */
export async function storeSignedPrekey(userId: string, spk: SignedPrekeyPair): Promise<void> {
  const masterKey = requireMasterKey();
  const db = getDB();
  const { ciphertext, iv } = await wrapRawKey(masterKey, spk.privateKey);
  await db.signedPrekey.put({
    userId,
    id: spk.id,
    publicKey: toBase64(spk.publicKey),
    signature: toBase64(spk.signature),
    wrappedPrivateKey: toBase64(ciphertext),
    wrappedPrivateKeyIv: toBase64(iv),
    createdAt: new Date().toISOString(),
  });
}

/**
 * Retrieve and decrypt the current signed prekey.
 */
export async function getSignedPrekey(userId: string): Promise<StoredSignedPrekey> {
  const masterKey = requireMasterKey();
  const db = getDB();
  const record = await db.signedPrekey.get(userId);
  if (!record) throw new Error(`No signed prekey for user ${userId}`);
  const privateKey = await unwrapRawKey(
    masterKey,
    fromBase64(record.wrappedPrivateKey),
    fromBase64(record.wrappedPrivateKeyIv)
  );
  return {
    id: record.id,
    publicKey: fromBase64(record.publicKey),
    privateKey,
    signature: fromBase64(record.signature),
    createdAt: record.createdAt,
  };
}

/**
 * Store a batch of one-time prekeys (each wrapped individually with master key).
 */
export async function storeOneTimePrekeys(
  userId: string,
  prekeys: OneTimePrekeyPair[]
): Promise<void> {
  const masterKey = requireMasterKey();
  const db = getDB();

  const records: OneTimePrekeyRecord[] = await Promise.all(
    prekeys.map(async (pk) => {
      const { ciphertext, iv } = await wrapRawKey(masterKey, pk.privateKey);
      return {
        userId,
        id: pk.id,
        publicKey: toBase64(pk.publicKey),
        wrappedPrivateKey: toBase64(ciphertext),
        wrappedPrivateKeyIv: toBase64(iv),
        used: false,
      };
    })
  );

  await db.oneTimePrekeys.bulkPut(records);
}

/**
 * Claim (and mark used) the first available one-time prekey.
 * Returns null if none remain — caller should upload more.
 */
export async function claimOneTimePrekey(userId: string): Promise<StoredOneTimePrekey | null> {
  const masterKey = requireMasterKey();
  const db = getDB();

  const record = await db.oneTimePrekeys
    .where({ userId, used: 0 as any })
    .first();

  if (!record) return null;

  await db.oneTimePrekeys.update([userId, record.id], { used: true });

  const privateKey = await unwrapRawKey(
    masterKey,
    fromBase64(record.wrappedPrivateKey),
    fromBase64(record.wrappedPrivateKeyIv)
  );

  return {
    id: record.id,
    publicKey: fromBase64(record.publicKey),
    privateKey,
  };
}

/**
 * Count remaining (unused) one-time prekeys.
 */
export async function countUnusedPrekeys(userId: string): Promise<number> {
  const db = getDB();
  return db.oneTimePrekeys.where({ userId, used: 0 as any }).count();
}

/**
 * Lock the vault — zero the in-memory master key reference.
 * Call on logout. The IDB data persists (encrypted) for the next login.
 */
export function lockVault(): void {
  _masterKey = null;
  _activeUserId = null;
}

/**
 * Completely wipe all key material for a user from IDB.
 * Use with caution — this is irreversible.
 */
export async function deleteKeyMaterial(userId: string): Promise<void> {
  const db = getDB();
  await Promise.all([
    db.meta.delete(userId),
    db.identityKey.delete(userId),
    db.signedPrekey.delete(userId),
    db.oneTimePrekeys.where("userId").equals(userId).delete(),
  ]);
  lockVault();
}

/** The userId of the currently unlocked vault, or null if locked. */
export function getActiveUserId(): string | null {
  return _activeUserId;
}

import type { RatchetState } from "./ratchet";
import { serializeRatchetState, deserializeRatchetState } from "./ratchet";

/**
 * Save the Double Ratchet state for a specific chat.
 */
export async function saveRatchetState(chatId: string, state: RatchetState): Promise<void> {
  const masterKey = requireMasterKey();
  const db = getDB();
  const userId = _activeUserId!;

  const serialized = serializeRatchetState(state);
  const jsonStr = JSON.stringify(serialized);
  const stateBytes = new TextEncoder().encode(jsonStr);

  const { ciphertext, iv } = await wrapRawKey(masterKey, stateBytes);

  await db.ratchetStates.put({
    userId,
    chatId,
    wrappedState: toBase64(ciphertext),
    wrappedStateIv: toBase64(iv),
  });
}

/**
 * Retrieve the Double Ratchet state for a specific chat.
 * Returns null if no state exists yet (e.g., before first message).
 */
export async function getRatchetState(chatId: string): Promise<RatchetState | null> {
  const masterKey = requireMasterKey();
  const db = getDB();
  const userId = _activeUserId;

  if (!userId) return null;

  const record = await db.ratchetStates.get([userId, chatId]);
  if (!record) return null;

  const stateBytes = await unwrapRawKey(
    masterKey,
    fromBase64(record.wrappedStateIv),
    fromBase64(record.wrappedState)
  );

  const jsonStr = new TextDecoder().decode(stateBytes);
  const serialized = JSON.parse(jsonStr);

  return deserializeRatchetState(serialized);
}
