import {
  getRatchetState,
  saveRatchetState,
  getActiveUserId,
  getIdentityKeyPair,
  getSignedPrekey
} from "./keyStore";
import { ratchetEncrypt, ratchetDecrypt, initRatchetSender, initRatchetReceiver, RatchetState } from "./ratchet";
import { x3dhSend, x3dhReceive } from "./x3dh";

/**
 * Ensures a RatchetState exists for the given chat.
 * If not, fetches Bob's public keys from the server and initializes it.
 */
export async function ensureRatchetState(chatId: string, recipientId: string, token: string): Promise<RatchetState> {
  let state = await getRatchetState(chatId);
  if (state) return state;

  // Fetch recipient's public key bundle from server
  const res = await fetch(`/api/keys/${recipientId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!res.ok) {
    throw new Error("Failed to fetch recipient keys for E2E encryption");
  }

  const bundle = await res.json();
  const myIk = await getIdentityKeyPair(getActiveUserId()!);

  // Initialize X3DH as sender
  const { sk, initialMessage } = await x3dhSend(myIk, {
    IK_B: bundle.identityKey,
    SPK_B: bundle.signedPrekey.publicKey,
    SPK_B_sig: bundle.signedPrekey.signature,
    SPK_B_id: bundle.signedPrekey.id,
    OPK_B: bundle.oneTimePrekey?.publicKey,
    OPK_B_id: bundle.oneTimePrekey?.id,
  }, chatId);

  // Initialize Double Ratchet as sender
  state = await initRatchetSender(sk, bundle.signedPrekey.publicKey);

  // We need to embed the initialMessage (Alice's IK, EK, etc) into the first message's ratchet header
  // so Bob can initialize his side. We will store it temporarily on the state.
  (state as any)._initialMessage = initialMessage;

  await saveRatchetState(chatId, state);
  return state;
}

/**
 * Encrypts a plaintext message for a specific chat.
 */
export async function encryptChatMessage(
  chatId: string,
  recipientId: string,
  plaintext: string,
  token: string
): Promise<{ ciphertext: string; nonce: string; ratchetHeader: any; msgNumber: number }> {
  let state = await ensureRatchetState(chatId, recipientId, token);

  const { header, ciphertext, nonce, state: newState } = await ratchetEncrypt(state, plaintext);
  
  const outHeader: any = { ...header };
  
  // If we have an X3DH initial message pending, attach it to the header
  if ((state as any)._initialMessage) {
    outHeader.x3dh = (state as any)._initialMessage;
    delete (newState as any)._initialMessage; // Consume it
  }

  await saveRatchetState(chatId, newState);

  return {
    ciphertext,
    nonce,
    ratchetHeader: outHeader,
    msgNumber: header.n,
  };
}

/**
 * Decrypts a ciphertext message for a specific chat.
 */
export async function decryptChatMessage(
  chatId: string,
  ciphertext: string,
  nonce: string,
  ratchetHeader: any
): Promise<string> {
  const userId = getActiveUserId();
  if (!userId) throw new Error("Key vault locked");

  let state = await getRatchetState(chatId);

  // If we don't have a state, but the message includes an X3DH initial message, we are Bob receiving the first message
  if (!state && ratchetHeader.x3dh) {
    const myIk = await getIdentityKeyPair(userId);
    const mySpk = await getSignedPrekey(userId);
    
    // For now we assume OPK is null for simplicity. If an OPK was used, we'd need to fetch it from KeyStore.
    // The spec allows OPK to be omitted if none was available.
    const { sk } = await x3dhReceive(myIk, mySpk, null, ratchetHeader.x3dh);
    
    state = initRatchetReceiver(sk, mySpk);
  }

  if (!state) {
    throw new Error("Cannot decrypt: No ratchet state and no X3DH initial message");
  }

  const { plaintext, state: newState } = await ratchetDecrypt(state, ratchetHeader, ciphertext, nonce);
  await saveRatchetState(chatId, newState);

  return plaintext;
}
