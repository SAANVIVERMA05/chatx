/**
 * ratchet.ts — Double Ratchet Algorithm (Signal spec).
 *
 * https://signal.org/docs/specifications/doubleratchet/
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS FILE IMPLEMENTS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   DH Ratchet (forward secrecy + post-compromise security)
 *   ─────────────────────────────────────────────────────────
 *   Each side maintains a DH ratchet keypair (DHs = ours, DHr = theirs).
 *   When a message header arrives carrying a NEW DHr:
 *
 *     1.  PN  = Ns                              // save current chain length
 *     2.  Ns = Nr = 0                           // reset counters
 *     3.  RK, CKr = KDF_RK(RK, DH(DHs, DHr))   // derive new receive chain
 *     4.  DHs     = generateX25519Keypair()      // rotate our ratchet key
 *     5.  RK, CKs = KDF_RK(RK, DH(DHs, DHr))   // derive new send chain
 *
 *   After the DH step both sides share the same new RK.  Compromise of any
 *   previously-seen DHs private key reveals nothing about future messages
 *   (forward secrecy).  After a local compromise, the next ratchet step
 *   re-establishes security (post-compromise security / "healing").
 *
 *   Symmetric Ratchet (per-message)
 *   ─────────────────────────────────
 *   Each message advances the chain key one step:
 *     mk      = HMAC-SHA256(CK, 0x01)   // message key (ephemeral)
 *     CK_next = HMAC-SHA256(CK, 0x02)   // next chain key
 *
 *   KDF_RK uses HKDF-SHA-256:
 *     in:   DH output (32 bytes)
 *     salt: current RK
 *     info: "ChatX RK"
 *     out:  64 bytes → split [0:32]=new_RK, [32:64]=new_CK
 *
 *   Message encryption uses AES-256-GCM:
 *     key  = mk
 *     nonce = 12 random bytes
 *     AD   = caller-supplied associated data (e.g., conversation metadata)
 *          + encoded header (for header authentication)
 *
 *   Out-of-order messages
 *   ──────────────────────
 *   Message keys for skipped messages are cached in MKSKIPPED.
 *   Key: base64(DHr_pub) + ":" + messageNumber
 *   Limit: MAX_SKIP = 1000 (prevents unbounded growth).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * INITIALIZATION
 * ─────────────────────────────────────────────────────────────────────────────
 *   Sender (Alice):
 *     DHs = fresh X25519 keypair (NOT EK_A — EK_A was consumed by X3DH)
 *     DHr = Bob's SPK public key (first "their" ratchet key)
 *     RK, CKs = KDF_RK(SK, DH(DHs, DHr))
 *     CKr = null, Ns = Nr = PN = 0
 *
 *   Receiver (Bob):
 *     DHs = SPK_B keypair (his ratchet key, matches Alice's DHr)
 *     DHr = null (unknown until first message arrives)
 *     RK  = SK
 *     CKs = CKr = null, Ns = Nr = PN = 0
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  dhX25519,
  hkdfSha256,
  hmacSha256,
  generateX25519KeyPair,
  toBase64,
  type KeyPair,
} from "./crypto";

// ── Constants ─────────────────────────────────────────────────────────────────

const RK_INFO   = "ChatX RK";    // HKDF info for root-key KDF
const MAX_SKIP  = 1000;           // max skipped message keys to buffer

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Full Double Ratchet state for one side of a conversation.
 *
 * This is an IMMUTABLE VALUE — every encrypt/decrypt call returns a NEW
 * RatchetState rather than mutating in place.  Callers are responsible for
 * persisting the updated state (serialise to Dexie or pass through React state).
 */
export interface RatchetState {
  /** Our current DH ratchet keypair. */
  DHs: KeyPair;
  /** Their current DH ratchet public key. null before first message received. */
  DHr: Uint8Array | null;
  /** 32-byte root key. Evolves with every DH ratchet step. */
  RK: Uint8Array;
  /** Sending chain key. null until the first DH step. */
  CKs: Uint8Array | null;
  /** Receiving chain key. null until the first DH step from their side. */
  CKr: Uint8Array | null;
  /** Number of messages sent in the current sending chain. */
  Ns: number;
  /** Number of messages received in the current receiving chain. */
  Nr: number;
  /** Number of messages sent in the PREVIOUS sending chain. */
  PN: number;
  /**
   * Skipped message keys, keyed by `${base64(dh_pub)}:${n}`.
   * Allows decrypting out-of-order messages.
   */
  MKSKIPPED: Record<string, Uint8Array>;
}

/** JSON-serializable representation of RatchetState */
export interface SerializedRatchetState {
  DHs: { publicKey: string; privateKey: string };
  DHr: string | null;
  RK: string;
  CKs: string | null;
  CKr: string | null;
  Ns: number;
  Nr: number;
  PN: number;
  MKSKIPPED: Record<string, string>;
}

import { fromBase64 } from "./crypto";

export function serializeRatchetState(state: RatchetState): SerializedRatchetState {
  const mkSkippedB64: Record<string, string> = {};
  for (const [key, value] of Object.entries(state.MKSKIPPED)) {
    mkSkippedB64[key] = toBase64(value);
  }

  return {
    DHs: {
      publicKey: toBase64(state.DHs.publicKey),
      privateKey: toBase64(state.DHs.privateKey),
    },
    DHr: state.DHr ? toBase64(state.DHr) : null,
    RK: toBase64(state.RK),
    CKs: state.CKs ? toBase64(state.CKs) : null,
    CKr: state.CKr ? toBase64(state.CKr) : null,
    Ns: state.Ns,
    Nr: state.Nr,
    PN: state.PN,
    MKSKIPPED: mkSkippedB64,
  };
}

export function deserializeRatchetState(serialized: SerializedRatchetState): RatchetState {
  const mkSkippedRaw: Record<string, Uint8Array> = {};
  for (const [key, value] of Object.entries(serialized.MKSKIPPED)) {
    mkSkippedRaw[key] = fromBase64(value);
  }

  return {
    DHs: {
      publicKey: fromBase64(serialized.DHs.publicKey),
      privateKey: fromBase64(serialized.DHs.privateKey),
    },
    DHr: serialized.DHr ? fromBase64(serialized.DHr) : null,
    RK: fromBase64(serialized.RK),
    CKs: serialized.CKs ? fromBase64(serialized.CKs) : null,
    CKr: serialized.CKr ? fromBase64(serialized.CKr) : null,
    Ns: serialized.Ns,
    Nr: serialized.Nr,
    PN: serialized.PN,
    MKSKIPPED: mkSkippedRaw,
  };
}

/**
 * Header transmitted with every encrypted message.
 * Encoded and included in AES-GCM associated data for integrity.
 */
export interface MessageHeader {
  /** Our current DH ratchet public key (32 bytes, base64). */
  dh: string;
  /** Previous sending chain length. */
  pn: number;
  /** Message index within the current sending chain. */
  n: number;
}

/** Output of ratchetEncrypt. */
export interface EncryptResult {
  header: MessageHeader;
  ciphertext: string;   // base64 AES-GCM ciphertext + tag
  nonce: string;        // base64 AES-GCM nonce (12 bytes)
  /** Updated ratchet state — replace the old one with this. */
  state: RatchetState;
}

/** Output of ratchetDecrypt. */
export interface DecryptResult {
  plaintext: string;
  /** Updated ratchet state — replace the old one with this. */
  state: RatchetState;
}

// ── Initializers ──────────────────────────────────────────────────────────────

/**
 * Initialize the ratchet for the SENDER (Alice).
 * Called after x3dhSend returns SK.
 *
 * Alice immediately performs one DH ratchet step using a fresh DHs and
 * Bob's SPK as DHr, establishing the first sending chain.
 *
 * @param sk         32-byte shared secret from X3DH.
 * @param bobSPKpub  Bob's signed-prekey public key (X25519, 32 bytes).
 *                   This becomes Alice's initial DHr.
 */
export async function initRatchetSender(
  sk: Uint8Array,
  bobSPKpub: Uint8Array
): Promise<RatchetState> {
  // Generate our first DH ratchet keypair (independent of X3DH EK_A)
  const DHs = await generateX25519KeyPair();
  const DHr = bobSPKpub;

  // First DH ratchet step: derive RK and CKs
  const dhOut = await dhX25519(DHs.privateKey, DHr);
  const [RK, CKs] = await kdfRK(sk, dhOut);

  return {
    DHs,
    DHr,
    RK,
    CKs,
    CKr: null,
    Ns: 0,
    Nr: 0,
    PN: 0,
    MKSKIPPED: {},
  };
}

/**
 * Initialize the ratchet for the RECEIVER (Bob).
 * Called after x3dhReceive returns SK.
 *
 * Bob hasn't received Alice's first message yet, so DHr is null and CKs/CKr
 * are both null.  The first DHRatchetStep (triggered by Alice's first message)
 * will populate them.
 *
 * @param sk            32-byte shared secret from X3DH.
 * @param bobSPKkeypair Bob's signed-prekey keypair (DHs₀).
 */
export function initRatchetReceiver(sk: Uint8Array, bobSPKkeypair: KeyPair): RatchetState {
  return {
    DHs:       bobSPKkeypair,
    DHr:       null,
    RK:        sk,
    CKs:       null,
    CKr:       null,
    Ns:        0,
    Nr:        0,
    PN:        0,
    MKSKIPPED: {},
  };
}

// ── Encrypt ───────────────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext message using the Double Ratchet.
 *
 * Advances the symmetric sending chain by one step:
 *   CKs_new, mk = KDF_CK(CKs)
 *   ciphertext  = AES-GCM(mk, plaintext, AD = ad || encode(header))
 *
 * @param state     Current ratchet state.
 * @param plaintext Message to encrypt.
 * @param ad        Additional data (e.g., conversation ID bytes). Optional.
 */
export async function ratchetEncrypt(
  state: RatchetState,
  plaintext: string,
  ad: Uint8Array = new Uint8Array(0)
): Promise<EncryptResult> {
  if (!state.CKs) throw new Error("Ratchet: sending chain not yet initialized");

  // Advance the sending chain
  const [mk, CKs_new] = await kdfCK(state.CKs);

  // Build header
  const header: MessageHeader = {
    dh: toBase64(state.DHs.publicKey),
    pn: state.PN,
    n:  state.Ns,
  };

  // Encrypt: AD = caller's ad || encoded header
  const headerBytes = encodeHeader(header);
  const fullAD = concatBytes(ad, headerBytes);
  const { ciphertext, nonce } = await aeadEncrypt(mk, plaintext, fullAD);

  const newState: RatchetState = {
    ...state,
    CKs: CKs_new,
    Ns:  state.Ns + 1,
  };

  return { header, ciphertext: toBase64(ciphertext), nonce: toBase64(nonce), state: newState };
}

// ── Decrypt ───────────────────────────────────────────────────────────────────

/**
 * Decrypt a message using the Double Ratchet.
 *
 * Handles three cases:
 *   1. Header DHr matches a cached skipped key → use it directly.
 *   2. Header DHr is new → trigger DH ratchet step, skip intervening keys.
 *   3. Header DHr matches current DHr → skip to message n in receiving chain.
 *
 * @param state  Current ratchet state.
 * @param header MessageHeader from the received message.
 * @param ct     base64 AES-GCM ciphertext.
 * @param nonce  base64 AES-GCM nonce.
 * @param ad     Additional data (must match what was passed to ratchetEncrypt).
 */
export async function ratchetDecrypt(
  state: RatchetState,
  header: MessageHeader,
  ct: string,
  nonce: string,
  ad: Uint8Array = new Uint8Array(0)
): Promise<DecryptResult> {
  const headerBytes = encodeHeader(header);
  const fullAD = concatBytes(ad, headerBytes);

  // ── Case 1: skipped message key ───────────────────────────────────────────
  const skippedKey = `${header.dh}:${header.n}`;
  if (state.MKSKIPPED[skippedKey]) {
    const mk  = state.MKSKIPPED[skippedKey];
    const newSkipped = { ...state.MKSKIPPED };
    delete newSkipped[skippedKey];
    const newState = { ...state, MKSKIPPED: newSkipped };
    const plaintext = await aeadDecrypt(mk, ct, nonce, fullAD);
    return { plaintext, state: newState };
  }

  // ── Case 2 or 3: live message ─────────────────────────────────────────────
  let s = state;
  const isNewRatchetKey = header.dh !== (state.DHr ? toBase64(state.DHr) : null);

  if (isNewRatchetKey) {
    // Skip any remaining messages in the current receiving chain
    s = await skipMessageKeys(s, header.pn);
    // DH ratchet step — this is the heart of forward secrecy
    s = await dhRatchetStep(s, header.dh);
  }

  // Skip to this message's position in the current receiving chain
  s = await skipMessageKeys(s, header.n);

  // Advance the receiving chain to get this message's key
  if (!s.CKr) throw new Error("Ratchet: receiving chain not initialized after ratchet step");
  const [mk, CKr_new] = await kdfCK(s.CKr);

  const newState: RatchetState = { ...s, CKr: CKr_new, Nr: s.Nr + 1 };
  const plaintext = await aeadDecrypt(mk, ct, nonce, fullAD);
  return { plaintext, state: newState };
}

// ── DH Ratchet step ───────────────────────────────────────────────────────────

/**
 * Perform a DH ratchet step on receiving a message with a new DHr.
 *
 * This is the mechanism that provides:
 *   - FORWARD SECRECY: old DHs private key is discarded; future keys can't
 *     be derived even if the old private key is later exposed.
 *   - POST-COMPROMISE SECURITY: after an attacker compromises DHs, the
 *     next ratchet step (with a fresh DHs) re-establishes security.
 *
 * Spec steps (§3.5 / Algorithm 1):
 *   state.PN  = state.Ns
 *   state.Ns = state.Nr = 0
 *   state.DHr = new_DHr_pub
 *   state.RK, state.CKr = KDF_RK(state.RK, DH(state.DHs.priv, new_DHr_pub))
 *   state.DHs = new X25519 keypair
 *   state.RK, state.CKs = KDF_RK(state.RK, DH(state.DHs.priv, new_DHr_pub))
 *
 * Note: Two KDF_RK calls — one for the receive chain (before key rotation),
 * one for the new send chain (after key rotation).
 */
async function dhRatchetStep(state: RatchetState, newDHrB64: string): Promise<RatchetState> {
  const newDHr = base64ToBytes(newDHrB64);

  // ── Derive new receiving chain ────────────────────────────────────────────
  const dhOut1 = await dhX25519(state.DHs.privateKey, newDHr);
  const [RK1, CKr] = await kdfRK(state.RK, dhOut1);

  // ── Rotate our ratchet keypair ────────────────────────────────────────────
  // The old DHs private key is NOW GONE from this state — forward secrecy.
  const newDHs = await generateX25519KeyPair();

  // ── Derive new sending chain ──────────────────────────────────────────────
  const dhOut2 = await dhX25519(newDHs.privateKey, newDHr);
  const [RK2, CKs] = await kdfRK(RK1, dhOut2);

  return {
    ...state,
    PN:  state.Ns,
    Ns:  0,
    Nr:  0,
    DHr: newDHr,
    DHs: newDHs,  // ← old private key discarded
    RK:  RK2,
    CKr,
    CKs,
  };
}

// ── Symmetric chain KDFs ──────────────────────────────────────────────────────

/**
 * KDF_RK — Root key derivation using HKDF-SHA-256.
 *
 * @param rk    Current 32-byte root key (used as HKDF salt).
 * @param dhOut 32-byte DH output (used as HKDF IKM).
 * @returns [new_rk (32 bytes), new_ck (32 bytes)]
 */
async function kdfRK(rk: Uint8Array, dhOut: Uint8Array): Promise<[Uint8Array, Uint8Array]> {
  const out = await hkdfSha256(dhOut, rk, RK_INFO, 64);
  return [out.subarray(0, 32), out.subarray(32, 64)];
}

/**
 * KDF_CK — Chain key ratchet using HMAC-SHA-256.
 *
 * @param ck  Current 32-byte chain key.
 * @returns [message_key (32 bytes), next_chain_key (32 bytes)]
 *
 * Using HMAC(CK, constant) rather than HKDF because the spec specifies it:
 *   mk      = HMAC-SHA256(CK, 0x01)
 *   CK_next = HMAC-SHA256(CK, 0x02)
 */
async function kdfCK(ck: Uint8Array): Promise<[Uint8Array, Uint8Array]> {
  const mk      = await hmacSha256(ck, new Uint8Array([0x01]));
  const ck_next = await hmacSha256(ck, new Uint8Array([0x02]));
  return [mk, ck_next];
}

// ── Skipped-key buffer ────────────────────────────────────────────────────────

/**
 * Advance the receiving chain to position `until`, caching skipped message keys.
 * Throws if this would require skipping more than MAX_SKIP keys.
 */
async function skipMessageKeys(state: RatchetState, until: number): Promise<RatchetState> {
  if (!state.CKr) return state;
  if (until < state.Nr) return state;
  if (until - state.Nr > MAX_SKIP) {
    throw new Error(`Ratchet: refusing to skip ${until - state.Nr} message keys (max ${MAX_SKIP})`);
  }

  let { CKr, Nr, DHr, MKSKIPPED } = state;
  const dhKey = DHr ? toBase64(DHr) : "null";

  while (Nr < until) {
    const [mk, nextCK] = await kdfCK(CKr!);
    MKSKIPPED = { ...MKSKIPPED, [`${dhKey}:${Nr}`]: mk };
    CKr = nextCK;
    Nr++;
  }

  return { ...state, CKr, Nr, MKSKIPPED };
}

// ── AEAD (AES-256-GCM) ────────────────────────────────────────────────────────

async function aeadEncrypt(
  mk: Uint8Array,
  plaintext: string,
  ad: Uint8Array
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const key   = await importAesGcm(mk);
  const ct    = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: asAB(ad) },
    key,
    new TextEncoder().encode(plaintext)
  );
  return { ciphertext: new Uint8Array(ct), nonce };
}

async function aeadDecrypt(
  mk: Uint8Array,
  ct: string,
  nonce: string,
  ad: Uint8Array
): Promise<string> {
  const key = await importAesGcm(mk);
  const pt  = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asAB(base64ToBytes(nonce)), additionalData: asAB(ad) },
    key,
    asAB(base64ToBytes(ct))
  );
  return new TextDecoder().decode(pt);
}

async function importAesGcm(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", asAB(raw), { name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

// ── Encoding helpers ──────────────────────────────────────────────────────────

/**
 * Deterministically encode a MessageHeader to bytes.
 * Used as part of AES-GCM associated data — ensures header integrity.
 */
function encodeHeader(h: MessageHeader): Uint8Array {
  // Simple length-prefixed encoding: dh(32B) || pn(4B BE) || n(4B BE)
  const dhBytes = base64ToBytes(h.dh);
  const out     = new Uint8Array(32 + 4 + 4);
  out.set(dhBytes.subarray(0, 32), 0);
  new DataView(out.buffer).setUint32(32, h.pn, false);
  new DataView(out.buffer).setUint32(36, h.n,  false);
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out   = new Uint8Array(total);
  let offset  = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

function asAB(u: Uint8Array): Uint8Array<ArrayBuffer> {
  return (u.buffer instanceof ArrayBuffer ? u : u.slice()) as Uint8Array<ArrayBuffer>;
}

// ── DEV-only self-test ─────────────────────────────────────────────────────────

/**
 * Self-test: Alice and Bob exchange 4 messages across 2 turns.
 * Verifies DH ratchet steps fire at turn boundaries and decryption round-trips.
 * STRIP THIS BEFORE SHIPPING.
 */
export async function _ratchetSelfTest(): Promise<void> {
  const { generateIdentityKeyPair, generateSignedPrekey } = await import("./crypto");
  const { x3dhSend, x3dhReceive } = await import("./x3dh");

  // ── Shared setup via X3DH ─────────────────────────────────────────────────
  const bobIK  = await generateIdentityKeyPair();
  const bobSPK = await generateSignedPrekey(1, bobIK.privateKey);
  const aliceIK = await generateIdentityKeyPair();

  const bobBundle = {
    IK_B: bobIK.publicKey,
    SPK_B: bobSPK.publicKey,
    SPK_B_id: bobSPK.id,
    SPK_B_sig: bobSPK.signature,
  };

  // X3DH: one send call, its initialMessage fed to receive so SKs match
  const { sk: skAlice, initialMessage } = await x3dhSend(aliceIK, bobBundle, "__ratchet_test__");
  const { sk: skBob }                   = await x3dhReceive(bobIK, bobSPK, null, initialMessage);

  const { toBase64: b64 } = await import("./crypto");
  if (b64(skAlice) !== b64(skBob)) throw new Error("Ratchet self-test: X3DH SK mismatch");
  const sharedSK = skAlice;

  // Init ratchets
  let aliceState = await initRatchetSender(sharedSK, bobSPK.publicKey);
  let bobState   = initRatchetReceiver(sharedSK, bobSPK);

  console.group("[DEV] Double Ratchet self-test (with out-of-order)");

  const aliceSends = async (text: string) => {
    const { header, ciphertext, nonce, state } = await ratchetEncrypt(aliceState, text);
    aliceState = state;
    const { plaintext, state: nextBob } = await ratchetDecrypt(bobState, header, ciphertext, nonce);
    bobState = nextBob;
    console.log("A→B:", plaintext);
  };
  const bobSends = async (text: string) => {
    const { header, ciphertext, nonce, state } = await ratchetEncrypt(bobState, text);
    bobState = state;
    const { plaintext, state: nextAlice } = await ratchetDecrypt(aliceState, header, ciphertext, nonce);
    aliceState = nextAlice;
    console.log("B→A:", plaintext);
  };

  // Turn 1: Alice sends two messages (single DH chain, no ratchet step yet)
  await aliceSends("Hello Bob — message 1");
  
  // Alice encrypts message 2, but we simulate it getting delayed in transit
  const delayedMsg = await ratchetEncrypt(aliceState, "Hello Bob — message 2 (DELAYED)");
  aliceState = delayedMsg.state;
  console.log("A→B encrypts message 2, but delays transmission...");

  // Alice sends message 3
  await aliceSends("Hello Bob — message 3 (arrives before msg 2)");

  // Turn 2: Bob replies — triggers Bob's first DH ratchet step
  await bobSends("Hey Alice — reply 1");

  // Now the delayed message 2 arrives at Bob
  console.log("Delayed message 2 arrives at Bob...");
  const { plaintext: delayedPt, state: bobAfterDelayed } = await ratchetDecrypt(
    bobState, 
    delayedMsg.header, 
    delayedMsg.ciphertext, 
    delayedMsg.nonce
  );
  bobState = bobAfterDelayed;
  const delayedOk = delayedPt === "Hello Bob — message 2 (DELAYED)";
  console.log(`B receives delayed msg:`, delayedOk ? "✅" : `❌ got "${delayedPt}"`);
  if (!delayedOk) throw new Error("Ratchet self-test decrypt mismatch on delayed message");

  // Turn 3: Alice replies — triggers Alice's DH ratchet step
  await aliceSends("Got it — message 4");

  console.log("✅ All messages round-tripped. DH ratchet and skipped-key handling are working.");
  console.log(`Alice chains: Ns=${aliceState.Ns}  Bob chains: Ns=${bobState.Ns}`);
  console.groupEnd();
}
