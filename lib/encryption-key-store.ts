/**
 * IndexedDB persistence for the AES-GCM encryption CryptoKey.
 *
 * Stores the CryptoKey via structured clone (preserves `extractable: false`),
 * so the raw key bytes cannot be exported back out by JS — even though the
 * key object survives across reloads / browser restarts.
 */

const DB_NAME = "defai";
const DB_VERSION = 1;
const STORE_NAME = "keys";
const KEY_ID = "enc-key";

function isAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDB();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const req = fn(tx.objectStore(STORE_NAME));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function saveEncryptionKey(key: CryptoKey): Promise<void> {
  if (!isAvailable()) return;
  await withStore("readwrite", (store) => store.put(key, KEY_ID));
}

export async function loadEncryptionKey(): Promise<CryptoKey | null> {
  if (!isAvailable()) return null;
  try {
    const value = await withStore<unknown>("readonly", (store) => store.get(KEY_ID));
    return value instanceof CryptoKey ? value : null;
  } catch {
    return null;
  }
}

export async function clearEncryptionKey(): Promise<void> {
  if (!isAvailable()) return;
  try {
    await withStore("readwrite", (store) => store.delete(KEY_ID));
  } catch {
    // ignore
  }
}
