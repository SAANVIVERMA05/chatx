/**
 * x3dh.ts — Extended Triple Diffie-Hellman (X3DH) key agreement.
 *
 * Implements the Signal X3DH specification exactly:
 *   https://signal.org/docs/specifications/x3dh/
 *
 * Key decisions:
 *   - Identity keys are Ed25519 (for signing/verification).
 *     For DH operations they are converted to X25519 on the fly using
 *     libsodium's crypto_sign_ed25519_*_to_curve25519 helpers.
 *   - Prekeys (SPK, OPK) are native X25519 — no conversion needed.
 *   - SK = HKDF-SHA-256(F || DH1 || DH2 || DH3 [|| DH4],
 *                        salt = F, info = "ChatX X3DH")
 *     where F = 0xFF × 32 (the X25519 constant from the spec).
 *   - The "first encrypted message" is AES-256-GCM under SK.
 *     Associated data = IK_A_pub_ed25519 || IK_B_pub_ed25519 (spec §3.3).
 *
 * Callers never touch raw DH output — only SK (32 bytes) leaves this module.
 */

import {
  dhX25519,
  edToX25519Pub,
  edToX25519Priv,
  hkdfSha256,
  verifyEd25519,
  generateX25519KeyPair,
  toBase64,
  fromBase64,
  type KeyPair,
} from "./crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Bob's public key bundle, fetched from the key server.
 * All keys are raw Uint8Array (caller decodes from base64 when fetching).
 */
export interface BobPreKeyBundle {
  /** Bob's Ed25519 identity public key (32 bytes). */
  IK_B: Uint8Array;
  /** Bob's X25519 signed-prekey public key (32 bytes). */
  SPK_B: Uint8Array;
  /** Bob's SPK id (for server-side tracking). */
  SPK_B_id: number;
  /** Ed25519 signature of SPK_B under IK_B (64 bytes). */
  SPK_B_sig: Uint8Array;
  /** Bob's X25519 one-time prekey public key (32 bytes). Optional. */
  OPK_B?: Uint8Array;
  /** Id of the one-time prekey used. */
  OPK_B_id?: number;
}

/**
 * Output of x3dhSend.
 * The caller stores ephemeralKP in the Double Ratchet state and
 * transmits initialMessage to Bob.
 */
export interface X3DHSendResult {
  /** 32-byte shared secret. Becomes the Double Ratchet root key. */
  sk: Uint8Array;
  /** Alice's ephemeral X25519 keypair (DHs₀ for the ratchet). */
  ephemeralKP: KeyPair;
  /** Serialised initial message to transmit to Bob. */
  initialMessage: InitialMessage;
}

/**
 * Output of x3dhReceive.
 */
export interface X3DHReceiveResult {
  /** 32-byte shared secret — must equal Alice's sk. */
  sk: Uint8Array;
  /** Decrypted first message plaintext. */
  plaintext: string;
}

/**
 * Wire format of the X3DH initial message (sent Alice → Bob).
 * All byte fields are base64-encoded for JSON transport.
 */
export interface InitialMessage {
  /** Alice's Ed25519 identity public key (base64). */
  IK_A: string;
  /** Alice's ephemeral X25519 public key (base64). */
  EK_A: string;
  /** Id of Bob's one-time prekey that Alice consumed. Absent if none used. */
  OPK_B_id?: number;
  /** AES-256-GCM ciphertext of the first message (base64). */
  ciphertext: string;
  /** AES-256-GCM IV / nonce (base64). */
  nonce: string;
}

// ── Internal constants ─────────────────────────────────────────────────────────

/**
 * F = 32 bytes of 0xFF — prepended to DH concat as per X3DH spec §2.3.
 * Provides domain separation from any all-zero DH output.
 */
const F = new Uint8Array(32).fill(0xff);

const X3DH_INFO = "ChatX X3DH v1";

// ── Sender (Alice) ─────────────────────────────────────────────────────────────

/**
 * Perform the sender-side X3DH handshake.
 *
 * Steps:
 *  1. Verify Bob's SPK signature — throws if invalid.
 *  2. Generate Alice's ephemeral keypair EK_A.
 *  3. Convert Alice's Ed25519 IK to X25519 for DH.
 *  4. Compute DH1..DH4 and derive SK via HKDF.
 *  5. Encrypt a first message under SK (proves key agreement).
 *  6. Return SK, EK_A, and the serialised InitialMessage.
 *
 * @param aliceIK   Alice's Ed25519 identity keypair (from keyStore).
 * @param bobBundle Bob's public prekey bundle (from key server).
 * @param firstMessage  Plaintext of the first message to send.
 */
export async function x3dhSend(
  aliceIK: KeyPair,
  bobBundle: BobPreKeyBundle,
  firstMessage: string
): Promise<X3DHSendResult> {
  // ── 1. Verify Bob's signed prekey signature ──────────────────────────────
  const sigValid = await verifyEd25519(bobBundle.SPK_B_sig, bobBundle.SPK_B, bobBundle.IK_B);
  if (!sigValid) {
    throw new Error("X3DH: Bob's SPK signature is invalid — possible key tampering");
  }

  // ── 2. Generate Alice's ephemeral X25519 keypair ─────────────────────────
  const ephemeralKP = await generateX25519KeyPair();

  // ── 3. Convert Alice's Ed25519 identity key to X25519 for DH ────────────
  const aliceIK_x25519_pub  = await edToX25519Pub(aliceIK.publicKey);
  const aliceIK_x25519_priv = await edToX25519Priv(aliceIK.privateKey);

  // Convert Bob's Ed25519 IK to X25519 (needed for DH2)
  const bobIK_x25519 = await edToX25519Pub(bobBundle.IK_B);

  // ── 4. Four DH computations ───────────────────────────────────────────────
  //   DH1 = DH(IK_A_x25519,  SPK_B)     — identity auth × signed prekey
  //   DH2 = DH(EK_A,         IK_B_x25519) — ephemeral auth × identity
  //   DH3 = DH(EK_A,         SPK_B)     — ephemeral × signed prekey
  //   DH4 = DH(EK_A,         OPK_B)     — ephemeral × one-time prekey (optional)
  const dh1 = await dhX25519(aliceIK_x25519_priv, bobBundle.SPK_B);
  const dh2 = await dhX25519(ephemeralKP.privateKey, bobIK_x25519);
  const dh3 = await dhX25519(ephemeralKP.privateKey, bobBundle.SPK_B);

  // Build IKM: F || DH1 || DH2 || DH3 [|| DH4]
  const parts: Uint8Array[] = [F, dh1, dh2, dh3];
  if (bobBundle.OPK_B) {
    const dh4 = await dhX25519(ephemeralKP.privateKey, bobBundle.OPK_B);
    parts.push(dh4);
  }
  const ikm = concat(...parts);

  // ── 5. Derive SK via HKDF-SHA-256 ────────────────────────────────────────
  // Salt = F (spec §2.3 — use same constant as domain separator)
  const sk = await hkdfSha256(ikm, F, X3DH_INFO, 32);

  // ── 6. Encrypt first message under SK ────────────────────────────────────
  // AD = IK_A_ed25519_pub || IK_B_ed25519_pub  (spec §3.3)
  const ad = concat(aliceIK.publicKey, bobBundle.IK_B);
  const { ciphertext, nonce } = await aeadEncrypt(sk, firstMessage, ad);

  const initialMessage: InitialMessage = {
    IK_A: toBase64(aliceIK.publicKey),
    EK_A: toBase64(ephemeralKP.publicKey),
    OPK_B_id: bobBundle.OPK_B_id,
    ciphertext: toBase64(ciphertext),
    nonce: toBase64(nonce),
  };

  return { sk, ephemeralKP, initialMessage };
}

// ── Receiver (Bob) ─────────────────────────────────────────────────────────────

/**
 * Perform the receiver-side X3DH handshake.
 *
 * Steps mirror Alice's DH computations with the roles swapped:
 *   DH1 = DH(SPK_B,   IK_A_x25519)   — matches Alice's DH1
 *   DH2 = DH(IK_B,    EK_A)           — matches Alice's DH2
 *   DH3 = DH(SPK_B,   EK_A)           — matches Alice's DH3
 *   DH4 = DH(OPK_B,   EK_A)           — matches Alice's DH4 (if present)
 *
 * @param bobIK      Bob's Ed25519 identity keypair.
 * @param bobSPK     Bob's X25519 signed prekey keypair.
 * @param bobOTPK    Bob's X25519 one-time prekey that Alice used. Pass null if none.
 * @param msg        The InitialMessage from Alice.
 */
export async function x3dhReceive(
  bobIK: KeyPair,
  bobSPK: KeyPair,
  bobOTPK: KeyPair | null,
  msg: InitialMessage
): Promise<X3DHReceiveResult> {
  // Decode wire-format fields
  const IK_A_ed = fromBase64(msg.IK_A);
  const EK_A    = fromBase64(msg.EK_A);

  // Convert Alice's Ed25519 IK and Bob's Ed25519 IK to X25519 for DH
  const IK_A_x25519 = await edToX25519Pub(IK_A_ed);
  const bobIK_x25519_priv = await edToX25519Priv(bobIK.privateKey);

  // ── DH computations (mirrored) ────────────────────────────────────────────
  const dh1 = await dhX25519(bobSPK.privateKey, IK_A_x25519);
  const dh2 = await dhX25519(bobIK_x25519_priv, EK_A);
  const dh3 = await dhX25519(bobSPK.privateKey, EK_A);

  const parts: Uint8Array[] = [F, dh1, dh2, dh3];
  if (bobOTPK) {
    const dh4 = await dhX25519(bobOTPK.privateKey, EK_A);
    parts.push(dh4);
  }
  const ikm = concat(...parts);

  // ── Derive SK ─────────────────────────────────────────────────────────────
  const sk = await hkdfSha256(ikm, F, X3DH_INFO, 32);

  // ── Decrypt first message ─────────────────────────────────────────────────
  const ad = concat(IK_A_ed, bobIK.publicKey);
  const plaintext = await aeadDecrypt(
    sk,
    fromBase64(msg.ciphertext),
    fromBase64(msg.nonce),
    ad
  );

  return { sk, plaintext };
}

// ── AEAD helpers (AES-256-GCM) ────────────────────────────────────────────────

async function aeadEncrypt(
  rawKey: Uint8Array,
  plaintext: string,
  ad: Uint8Array
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const key   = await importAesKey(rawKey);
  const ct    = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: asAB(ad) },
    key,
    asAB(new TextEncoder().encode(plaintext))
  );
  return { ciphertext: new Uint8Array(ct), nonce };
}

async function aeadDecrypt(
  rawKey: Uint8Array,
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  ad: Uint8Array
): Promise<string> {
  const key = await importAesKey(rawKey);
  const pt  = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asAB(nonce), additionalData: asAB(ad) },
    key,
    asAB(ciphertext)
  );
  return new TextDecoder().decode(pt);
}

async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", asAB(raw), { name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Ensure plain ArrayBuffer backing for WebCrypto. */
function asAB(u: Uint8Array): Uint8Array<ArrayBuffer> {
  return (u.buffer instanceof ArrayBuffer ? u : u.slice()) as Uint8Array<ArrayBuffer>;
}

/** Concatenate multiple Uint8Arrays into one. */
function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

// ── DEV-only self-test ─────────────────────────────────────────────────────────

/**
 * Self-test: generate two parties, run X3DH, assert SK equality.
 * STRIP THIS BEFORE SHIPPING — only for local verification.
 */
export async function _x3dhSelfTest(): Promise<void> {
  const { generateIdentityKeyPair, generateSignedPrekey, generateX25519KeyPair: genX } =
    await import("./crypto");

  // Bob's long-term keys
  const bobIK  = await generateIdentityKeyPair();
  const bobSPK = await generateSignedPrekey(1, bobIK.privateKey);
  const bobOTPK = await genX(); // one-time prekey (no id for test)

  const bobBundle: BobPreKeyBundle = {
    IK_B: bobIK.publicKey,
    SPK_B: bobSPK.publicKey,
    SPK_B_id: bobSPK.id,
    SPK_B_sig: bobSPK.signature,
    OPK_B: bobOTPK.publicKey,
    OPK_B_id: 1,
  };

  // Alice's long-term keys
  const aliceIK = await generateIdentityKeyPair();

  // Alice sends
  const { sk: skAlice, initialMessage } = await x3dhSend(aliceIK, bobBundle, "Hello Bob!");

  // Bob receives
  const { sk: skBob, plaintext } = await x3dhReceive(bobIK, bobSPK, bobOTPK, initialMessage);

  const skAliceB64 = toBase64(skAlice);
  const skBobB64   = toBase64(skBob);

  console.group("[DEV] X3DH self-test");
  console.log("SK (Alice):", skAliceB64);
  console.log("SK (Bob):  ", skBobB64);
  console.log("Match:     ", skAliceB64 === skBobB64 ? "✅ YES" : "❌ NO — BUG");
  console.log("Plaintext: ", plaintext);
  console.groupEnd();

  if (skAliceB64 !== skBobB64) {
    throw new Error("X3DH self-test FAILED: shared secrets do not match");
  }
}
