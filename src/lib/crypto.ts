/**
 * crypto.ts — Pure crypto primitives for ChatX E2E key management.
 *
 * Responsibilities:
 *   - KDF: Argon2id (password = OTP, salt = userId+random) → 256-bit AES-GCM key
 *   - Wrap / unwrap: AES-256-GCM encrypt/decrypt of raw key bytes
 *   - Key generation: Ed25519 identity keypair, X25519 prekeys (via libsodium)
 *   - Signing: Ed25519 sign (for signed-prekey signature)
 *
 * This module has NO React or Dexie dependency and is SSR-safe (guarded below).
 * All keys are raw Uint8Array in/out. Base64 encoding lives in keyStore.ts.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface WrappedKey {
  ciphertext: Uint8Array;
  iv: Uint8Array;
}

export interface SignedPrekeyPair extends KeyPair {
  id: number;
  signature: Uint8Array; // Ed25519 signature over publicKey
}

export interface OneTimePrekeyPair extends KeyPair {
  id: number;
}

// ── KDF — Argon2id ─────────────────────────────────────────────────────────

/**
 * Derive a 256-bit AES-GCM CryptoKey from the user's OTP + a random salt.
 *
 * Parameters (OWASP Argon2id minimum):
 *   time:  3 iterations
 *   mem:   65536 KiB (64 MB)
 *   hashLen: 32 bytes
 */
export async function deriveStorageKey(
  otp: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  if (typeof window === "undefined") throw new Error("KDF only runs in the browser");

  // Dynamic import keeps WASM out of SSR bundle
  const argon2 = await import("argon2-browser");

  const result = await argon2.hash({
    pass: otp,
    salt,
    time: 3,
    mem: 65536,
    hashLen: 32,
    parallelism: 1,
    type: argon2.ArgonType.Argon2id,
  });

  return crypto.subtle.importKey(
    "raw",
    buf(result.hash),
    { name: "AES-GCM", length: 256 },
    false,        // not extractable — stays in memory only
    ["wrapKey", "unwrapKey", "encrypt", "decrypt"]
  );
}

// ── Wrap / Unwrap ─────────────────────────────────────────────────────────────

/**
 * AES-256-GCM encrypt raw key bytes under the storage key.
 * Returns { ciphertext, iv } — both Uint8Array.
 */
export async function wrapRawKey(
  storageKey: CryptoKey,
  rawKeyBytes: Uint8Array
): Promise<WrappedKey> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    storageKey,
    buf(rawKeyBytes)
  );
  return { ciphertext: new Uint8Array(ciphertext), iv };
}

/**
 * AES-256-GCM decrypt raw key bytes previously wrapped with wrapRawKey.
 */
export async function unwrapRawKey(
  storageKey: CryptoKey,
  ciphertext: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: buf(iv) },
    storageKey,
    buf(ciphertext)
  );
  return new Uint8Array(plaintext);
}

// ── Key generation ─────────────────────────────────────────────────────────────

/**
 * Generate an Ed25519 identity keypair.
 * Used for: long-term identity signing key.
 */
export async function generateIdentityKeyPair(): Promise<KeyPair> {
  const sodium = await getSodium();
  const kp = sodium.crypto_sign_keypair();
  return { publicKey: kp.publicKey, privateKey: kp.privateKey };
}

/**
 * Generate an X25519 (curve25519) keypair.
 * Used for: signed prekey and one-time prekeys.
 */
export async function generateX25519KeyPair(): Promise<KeyPair> {
  const sodium = await getSodium();
  const kp = sodium.crypto_box_keypair();
  return { publicKey: kp.publicKey, privateKey: kp.privateKey };
}

/**
 * Sign the signed-prekey public key bytes with the Ed25519 identity private key.
 * Returns a 64-byte Ed25519 signature.
 */
export async function signPrekey(
  prekeyPublicKey: Uint8Array,
  identityPrivateKey: Uint8Array
): Promise<Uint8Array> {
  const sodium = await getSodium();
  // Sign the raw public key bytes
  return sodium.crypto_sign_detached(prekeyPublicKey, identityPrivateKey);
}

/**
 * Generate a signed prekey (X25519 keypair + Ed25519 signature).
 * @param id         — monotonically increasing integer for server lookup
 * @param identityPrivateKey — Ed25519 private key to sign with
 */
export async function generateSignedPrekey(
  id: number,
  identityPrivateKey: Uint8Array
): Promise<SignedPrekeyPair> {
  const kp = await generateX25519KeyPair();
  const signature = await signPrekey(kp.publicKey, identityPrivateKey);
  return { id, publicKey: kp.publicKey, privateKey: kp.privateKey, signature };
}

/**
 * Generate a batch of one-time prekeys.
 * Uses setTimeout(0) between batches of 10 to yield to the renderer.
 * @param startId — starting ID for this batch (increment server-side counter)
 * @param count   — number of prekeys to generate (recommended: 100)
 */
export async function generateOneTimePrekeys(
  count: number,
  startId = 1
): Promise<OneTimePrekeyPair[]> {
  const sodium = await getSodium();
  const prekeys: OneTimePrekeyPair[] = [];
  const BATCH = 10;

  for (let i = 0; i < count; i++) {
    if (i > 0 && i % BATCH === 0) {
      // Yield to the renderer between batches to avoid janking the UI
      await new Promise((r) => setTimeout(r, 0));
    }
    const kp = sodium.crypto_box_keypair();
    prekeys.push({
      id: startId + i,
      publicKey: kp.publicKey,
      privateKey: kp.privateKey,
    });
  }

  return prekeys;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Lazy-loaded libsodium instance (WASM init is async). */
let _sodiumReady: Promise<typeof import("libsodium-wrappers")> | null = null;

async function getSodium() {
  if (typeof window === "undefined") throw new Error("libsodium only runs in the browser");
  if (!_sodiumReady) {
    _sodiumReady = import("libsodium-wrappers").then(async (s) => {
      await s.ready;
      return s;
    });
  }
  return _sodiumReady;
}

/** Ensure a Uint8Array is backed by a plain ArrayBuffer (required by WebCrypto BufferSource). */
function buf(u: Uint8Array): Uint8Array<ArrayBuffer> {
  // .slice() always returns a Uint8Array<ArrayBuffer>, never SharedArrayBuffer
  return (u.buffer instanceof ArrayBuffer ? u : u.slice()) as Uint8Array<ArrayBuffer>;
}

/** Generate a cryptographically random salt (16 bytes). */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

/** Encode Uint8Array → base64 string for IDB storage. */
export function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

/** Decode base64 string → Uint8Array from IDB storage. */
export function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// ── X3DH / Ratchet primitives ─────────────────────────────────────────────────

/**
 * X25519 Diffie-Hellman.
 * Returns a 32-byte shared secret: crypto_scalarmult(myPriv, theirPub).
 */
export async function dhX25519(
  myPriv: Uint8Array,
  theirPub: Uint8Array
): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.crypto_scalarmult(myPriv, theirPub);
}

/**
 * Convert an Ed25519 public key to its X25519 (Curve25519) equivalent.
 * Needed so the Ed25519 identity key can participate in X3DH DH computations.
 */
export async function edToX25519Pub(ed25519Pk: Uint8Array): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.crypto_sign_ed25519_pk_to_curve25519(ed25519Pk);
}

/**
 * Convert an Ed25519 private key to its X25519 (Curve25519) equivalent.
 * libsodium stores Ed25519 sk as 64 bytes (seed || pk); this handles that.
 */
export async function edToX25519Priv(ed25519Sk: Uint8Array): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.crypto_sign_ed25519_sk_to_curve25519(ed25519Sk);
}

/**
 * HKDF-SHA-256.
 * @param ikm   input keying material
 * @param salt  optional salt (use 0-byte array if absent)
 * @param info  context string
 * @param len   output length in bytes
 */
export async function hkdfSha256(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: string,
  len: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", buf(ikm), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: buf(salt),
      info: new TextEncoder().encode(info),
    },
    key,
    len * 8
  );
  return new Uint8Array(bits);
}

/**
 * HMAC-SHA-256(key, data) → 32-byte MAC.
 * Used by the Double Ratchet symmetric chain KDF.
 */
export async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    "raw",
    buf(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", k, buf(data));
  return new Uint8Array(sig);
}

/**
 * Verify an Ed25519 detached signature.
 * Returns true iff the signature is valid over msg under pk.
 */
export async function verifyEd25519(
  sig: Uint8Array,
  msg: Uint8Array,
  pk: Uint8Array
): Promise<boolean> {
  const sodium = await getSodium();
  return sodium.crypto_sign_verify_detached(sig, msg, pk);
}
