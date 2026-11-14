/**
 * Field-level protection for personal data, using the Web Crypto API
 * (available in Cloudflare Workers and Node >= 20).
 *
 * - encryptField / decryptField: AES-256-GCM with a random 96-bit IV per value.
 *   Stored format: "v1.<base64url iv>.<base64url ciphertext+tag>".
 * - keyedHash: HMAC-SHA-256, used for dedupe and deletion lookups without plaintext.
 *
 * Keys come from Worker secrets (DATA_KEY, HASH_KEY), each 32 random bytes, base64.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64ToBytes(b64) {
  const s = String(b64 || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const bin = atob(s + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes) {
  let bin = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const keyCache = new Map();

async function importKey(secret, kind) {
  const cacheKey = kind + ":" + secret;
  if (keyCache.has(cacheKey)) return keyCache.get(cacheKey);
  const raw = b64ToBytes(secret);
  if (raw.length !== 32) throw new Error(kind + " key must be 32 bytes (base64)");
  const key =
    kind === "aes"
      ? await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
          "encrypt",
          "decrypt",
        ])
      : await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, [
          "sign",
        ]);
  keyCache.set(cacheKey, key);
  return key;
}

export async function encryptField(secret, plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === "") return null;
  const key = await importKey(secret, "aes");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(String(plaintext))
  );
  return "v1." + bytesToB64url(iv) + "." + bytesToB64url(ct);
}

export async function decryptField(secret, stored) {
  if (!stored) return null;
  const parts = String(stored).split(".");
  if (parts.length !== 3 || parts[0] !== "v1") throw new Error("unknown ciphertext format");
  const key = await importKey(secret, "aes");
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBytes(parts[1]) },
    key,
    b64ToBytes(parts[2])
  );
  return dec.decode(pt);
}

export async function keyedHash(secret, value) {
  if (value === null || value === undefined || value === "") return null;
  const key = await importKey(secret, "hmac");
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(String(value)));
  return bytesToB64url(sig);
}

/** Constant-time string comparison for bearer tokens. */
export function timingSafeEqual(a, b) {
  const x = enc.encode(String(a || ""));
  const y = enc.encode(String(b || ""));
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"; // no 0/O/1/I/L/U

export function newReference(prefix) {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += REF_ALPHABET[bytes[i] % REF_ALPHABET.length];
  return prefix + "-" + s;
}
