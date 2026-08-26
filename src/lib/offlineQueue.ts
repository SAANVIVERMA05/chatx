/**
 * offlineQueue — IndexedDB-backed outbox for outgoing messages.
 *
 * When the socket is disconnected, messages are persisted here so they
 * survive page refreshes. On reconnect, the caller flushes the queue by
 * reading all items, re-emitting them, and dequeuing each on ACK.
 *
 * Usage:
 *   import { offlineQueue, QueuedMessage } from "@/lib/offlineQueue";
 *   await offlineQueue.enqueue(item);
 *   const pending = await offlineQueue.getAll();
 *   await offlineQueue.dequeue(item.tempId);
 *
 * SSR-safe: all IDB access is guarded behind `typeof window !== "undefined"`.
 */

export interface QueuedMessage {
  tempId: string;
  conversationId: string;
  ciphertext?: string;
  nonce?: string;
  ratchetHeader?: Record<string, unknown>;
  msgNumber?: number;
  content?: string; // Optional for E2E
  messageType?: "text" | "file";
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  replyTo?: any;
  queuedAt: string;
}

const DB_NAME = "chatx-offline";
const DB_VERSION = 1;
const STORE = "outbox";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "tempId" });
      }
    };

    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

async function enqueue(item: QueuedMessage): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function dequeue(tempId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.delete(tempId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function getAll(): Promise<QueuedMessage[]> {
  if (typeof window === "undefined") return [];
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      db.close();
      const items = (req.result as QueuedMessage[]).sort(
        (a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime()
      );
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

async function clear(): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export const offlineQueue = { enqueue, dequeue, getAll, clear };
