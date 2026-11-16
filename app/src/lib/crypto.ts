// Backup password: AES-256-GCM with a key made from the password (PBKDF2-SHA256).
// Encrypted file layout: "PEENC1\n" | salt (16 bytes) | iv (12 bytes) | ciphertext (with GCM tag).
// Without the password the file cannot be opened by anyone, including the app's makers.
const MAGIC = new TextEncoder().encode("PEENC1\n");
const ITER = 310_000;

const toBuf = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

async function keyFrom(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", toBuf(new TextEncoder().encode(password)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: toBuf(salt), iterations: ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export const isEncrypted = (u: Uint8Array): boolean => u.length > MAGIC.length && MAGIC.every((b, i) => u[i] === b);

export async function encryptBytes(plain: Uint8Array, password: string): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: toBuf(iv) }, await keyFrom(password, salt), toBuf(plain)));
  const out = new Uint8Array(MAGIC.length + 28 + ct.length);
  out.set(MAGIC, 0); out.set(salt, MAGIC.length); out.set(iv, MAGIC.length + 16); out.set(ct, MAGIC.length + 28);
  return out;
}

/** throws Error("wrong-password") when the password doesn't match */
export async function decryptBytes(data: Uint8Array, password: string): Promise<Uint8Array> {
  if (!isEncrypted(data)) throw new Error("not-encrypted");
  const o = MAGIC.length, salt = data.slice(o, o + 16), iv = data.slice(o + 16, o + 28), ct = data.slice(o + 28);
  try { return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: toBuf(iv) }, await keyFrom(password, salt), toBuf(ct))); }
  catch { throw new Error("wrong-password"); }
}
