"use strict";

const crypto = require("crypto");

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 32;

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      KEYLEN,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      }
    );
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync(password, salt);
  return [
    "scrypt",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

async function verifyPassword(password, encoded) {
  const parts = String(encoded || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  if (n !== String(SCRYPT_N) || r !== String(SCRYPT_R) || p !== String(SCRYPT_P)) return false;
  let salt;
  let expected;
  try {
    salt = Buffer.from(saltB64, "base64url");
    expected = Buffer.from(keyB64, "base64url");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length !== KEYLEN) return false;
  const actual = await scryptAsync(password, salt);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function newSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

module.exports = {
  hashPassword,
  verifyPassword,
  hashToken,
  newSessionToken,
};
