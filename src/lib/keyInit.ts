/**
 * keyInit.ts — Orchestrates key setup for new and returning users.
 *
 * This is the single entry point called from the login page.
 * It coordinates crypto.ts (generation) and keyStore.ts (storage).
 *
 * For NEW users:
 *   initializeKeys(userId, otp)
 *     1. setupKeyStore     — create vault, derive + store master key
 *     2. generateIdentityKeyPair  — Ed25519
 *     3. generateSignedPrekey     — X25519 + signature
 *     4. generateOneTimePrekeys   — 100 × X25519
 *     5. storeAll                 — encrypted write to Dexie
 *     Returns PublicKeyBundle for future upload to the key server.
 *
 * For RETURNING users:
 *   unlockKeys(userId, otp)
 *     — Re-derives master key from OTP, unlocks Dexie vault.
 */

import {
  generateIdentityKeyPair,
  generateSignedPrekey,
  generateOneTimePrekeys,
  toBase64,
} from "./crypto";

import {
  setupKeyStore,
  storeIdentityKey,
  storeSignedPrekey,
  storeOneTimePrekeys,
  hasKeys,
} from "./keyStore";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Public key material safe to upload to the key server. */
export interface PublicKeyBundle {
  identityKey: string;            // base64 Ed25519 public key
  signedPrekey: {
    id: number;
    publicKey: string;            // base64 X25519 public key
    signature: string;            // base64 Ed25519 signature
  };
  oneTimePrekeys: Array<{
    id: number;
    publicKey: string;            // base64 X25519 public key
  }>;
}

// ── New user ───────────────────────────────────────────────────────────────────

/**
 * Full key initialization for a new user.
 *
 * Generates:
 *   - 1 Ed25519 Identity Keypair
 *   - 1 Signed X25519 Prekey (signed with identity private key)
 *   - 100 One-Time X25519 Prekeys
 *
 * All private keys are AES-GCM wrapped and stored in Dexie.
 * Returns the public-only bundle for future server upload.
 *
 * @param userId — server-assigned UUID
 * @param otp    — 6-digit OTP (Argon2 password input; not persisted)
 * @param onProgress — optional callback for UI progress steps
 */
export async function initializeKeys(
  userId: string,
  otp: string,
  onProgress?: (step: string) => void
): Promise<PublicKeyBundle> {
  onProgress?.("Initializing secure vault…");
  await setupKeyStore(userId, otp);

  onProgress?.("Generating identity key…");
  const identityKP = await generateIdentityKeyPair();

  onProgress?.("Generating signed prekey…");
  const signedKP = await generateSignedPrekey(1, identityKP.privateKey);

  onProgress?.("Generating one-time prekeys…");
  const otPrekeys = await generateOneTimePrekeys(100, 1);

  onProgress?.("Storing keys securely…");
  await storeIdentityKey(userId, identityKP);
  await storeSignedPrekey(userId, signedKP);
  await storeOneTimePrekeys(userId, otPrekeys);

  onProgress?.("Done");

  return {
    identityKey: toBase64(identityKP.publicKey),
    signedPrekey: {
      id: signedKP.id,
      publicKey: toBase64(signedKP.publicKey),
      signature: toBase64(signedKP.signature),
    },
    oneTimePrekeys: otPrekeys.map((pk) => ({
      id: pk.id,
      publicKey: toBase64(pk.publicKey),
    })),
  };
}

// ── Returning user ─────────────────────────────────────────────────────────────

/**
 * Re-open the vault for a returning user using their OTP.
 * Must be called before any getIdentityKeyPair / getSignedPrekey calls.
 *
 * @param userId — server-assigned UUID
 * @param otp    — 6-digit OTP (Argon2 password input; not persisted)
 * @throws if keys don't exist (call initializeKeys instead)
 */
export async function unlockKeys(userId: string, otp: string): Promise<void> {
  const keysExist = await hasKeys(userId);
  if (!keysExist) {
    // First login on this device after account creation — treat as new
    // (keys may exist on another device). Just open the vault; caller
    // can optionally initializeKeys if they want to trigger key generation.
    await setupKeyStore(userId, otp);
    return;
  }
  await setupKeyStore(userId, otp);
}

// ── Re-export lock for convenience ────────────────────────────────────────────
export { lockVault } from "./keyStore";
export { hasKeys } from "./keyStore";
