/**
 * Client-side AES-256-GCM encryption for chat messages.
 *
 * Key derivation:
 *   HKDF-SHA-256( signatureBytes, salt="dellm-enc-v1", info="" ) → AES-256-GCM key
 *
 * The signing input is a fixed message ("DeLLM Chat Encryption\nWallet: <addr>"),
 * so the same wallet always produces the same encryption key — no key storage needed.
 * The server never sees the key or the plaintext.
 */

const ENC_SALT = new TextEncoder().encode("dellm-enc-v1");

/** Derive a non-extractable AES-256-GCM key from a wallet signature. */
export async function deriveKeyFromSignature(signatureBytes: Uint8Array): Promise<CryptoKey> {
  // Copy into a plain ArrayBuffer to satisfy WebCrypto strict typing
  const buf = signatureBytes.buffer.slice(
    signatureBytes.byteOffset,
    signatureBytes.byteOffset + signatureBytes.byteLength
  ) as ArrayBuffer;

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    buf,
    { name: "HKDF" },
    false,
    ["deriveKey"]
  );

  const saltBuf = ENC_SALT.buffer.slice(
    ENC_SALT.byteOffset,
    ENC_SALT.byteOffset + ENC_SALT.byteLength
  ) as ArrayBuffer;

  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: saltBuf, info: new ArrayBuffer(0) },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Encrypt a plaintext string. Returns base64-encoded ciphertext + IV. */
export async function encryptMessage(
  key: CryptoKey,
  plaintext: string
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ivBuf = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer;
  const dataBuf = new TextEncoder().encode(plaintext).buffer as ArrayBuffer;

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ivBuf },
    key,
    dataBuf
  );

  return {
    ciphertext: uint8ToBase64(new Uint8Array(cipherBuffer)),
    iv: uint8ToBase64(iv),
  };
}

/** Decrypt a previously encrypted message. */
export async function decryptMessage(
  key: CryptoKey,
  ciphertext: string,
  iv: string
): Promise<string> {
  const cipherBuf = base64ToUint8(ciphertext).buffer as ArrayBuffer;
  const ivBuf = base64ToUint8(iv).buffer as ArrayBuffer;

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBuf },
    key,
    cipherBuf
  );
  return new TextDecoder().decode(decrypted);
}

function uint8ToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToUint8(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
