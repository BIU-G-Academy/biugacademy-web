// Unit tests: validation rules, field encryption, keyed hashing, Access JWT verification.
// Run: node --test test/unit.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  validateApplication,
  validateSupport,
  validatePrivacyRequest,
  normalisePhone,
  sanitiseReferral,
  isHoneypotFilled,
} from "../src/validate.js";
import {
  encryptField,
  decryptField,
  keyedHash,
  timingSafeEqual,
  newReference,
} from "../src/crypto.js";
import { verifyAccessJwt } from "../src/index.js";

const KEY = Buffer.alloc(32, 7).toString("base64");
const KEY2 = Buffer.alloc(32, 9).toString("base64");

export const validApplication = () => ({
  full_name: "Maria João Teste",
  email: "maria.teste@example.com",
  phone_number: "923 456 789",
  phone_has_whatsapp: true,
  province: "Huíla",
  age_range: "18-24",
  primary_language: "Portuguese",
  education_level: "Secondary",
  areas_of_interest: ["digital-skills", "financial-literacy"],
  internet_access_level: "Mobile data only",
  device_access: "Smartphone only",
  consent_privacy: true,
  consent_version: "2026-10-19",
  form_language: "pt",
  referral_source: "https://www.facebook.com/some/path?fbclid=abc",
});

test("valid application passes and is minimised", () => {
  const r = validateApplication(validApplication());
  assert.equal(r.ok, true);
  assert.equal(r.value.phone, "+244923456789");
  assert.equal(r.value.referral_source, "www.facebook.com"); // query string dropped
  assert.equal(r.value.email, "maria.teste@example.com");
});

test("unknown fields are dropped (data minimisation)", () => {
  const body = Object.assign(validApplication(), {
    bi_number: "000123456LA042",
    motivation_statement: "x".repeat(50),
  });
  const r = validateApplication(body);
  assert.equal(r.ok, true);
  assert.equal("bi_number" in r.value, false);
  assert.equal("motivation_statement" in r.value, false);
});

test("missing consent is rejected", () => {
  const b = validApplication();
  b.consent_privacy = false;
  assert.deepEqual(validateApplication(b).errors, ["consent_privacy"]);
});

test("stale consent version is rejected", () => {
  const b = validApplication();
  b.consent_version = "2020-01-01";
  assert.deepEqual(validateApplication(b).errors, ["consent_version"]);
});

test("16-17 requires guardian consent", () => {
  const b = validApplication();
  b.age_range = "16-17";
  assert.deepEqual(validateApplication(b).errors, ["guardian_consent"]);
  b.guardian_consent = true;
  assert.equal(validateApplication(b).ok, true);
});

test("at least one contact channel is required", () => {
  const b = validApplication();
  delete b.email;
  delete b.phone_number;
  assert.deepEqual(validateApplication(b).errors, ["contact"]);
  b.phone_number = "+244 912 000 111";
  assert.equal(validateApplication(b).ok, true);
});

test("enum and format violations are reported per field", () => {
  const b = validApplication();
  b.province = "Atlantis";
  b.email = "not-an-email";
  b.areas_of_interest = ["hacking"];
  b.full_name = "<script>";
  const r = validateApplication(b);
  assert.equal(r.ok, false);
  for (const f of ["province", "email", "areas_of_interest", "full_name"])
    assert.ok(r.errors.includes(f), f);
});

test("phone normalisation", () => {
  assert.equal(normalisePhone("923456789"), "+244923456789");
  assert.equal(normalisePhone("+351 912 345 678"), "+351912345678");
  assert.equal(normalisePhone("00244923456789"), "+244923456789");
  assert.equal(normalisePhone("abc"), null);
  assert.equal(normalisePhone(""), "");
});

test("referral sanitiser keeps hostname or short tag only", () => {
  assert.equal(sanitiseReferral("https://t.co/xyz?ref=1"), "t.co");
  assert.equal(sanitiseReferral("whatsapp-group-luanda"), "whatsapp-group-luanda");
  assert.equal(sanitiseReferral("direct"), "direct");
  assert.equal(sanitiseReferral(""), null);
});

test("honeypot detection", () => {
  assert.equal(isHoneypotFilled({ website: "http://spam" }), true);
  assert.equal(isHoneypotFilled({ website: "" }), false);
});

test("support and privacy-request validation", () => {
  assert.equal(
    validateSupport({
      name: "Ana",
      email: "ana@example.com",
      message: "Olá, preciso de ajuda.",
      consent_privacy: true,
    }).ok,
    true
  );
  assert.deepEqual(
    validateSupport({ name: "Ana", email: "ana@example.com", message: "hi", consent_privacy: true })
      .errors,
    ["message"]
  );
  assert.equal(validatePrivacyRequest({ email: "ana@example.com" }).ok, true);
  assert.deepEqual(validatePrivacyRequest({}).errors, ["contact"]);
  assert.deepEqual(validatePrivacyRequest({ email: "a@b.co", request_type: "sell" }).errors, [
    "request_type",
  ]);
});

test("AES-GCM round trip; ciphertext is randomised and tamper-evident", async () => {
  const a = await encryptField(KEY, "maria@example.com");
  const b = await encryptField(KEY, "maria@example.com");
  assert.notEqual(a, b);
  assert.ok(!a.includes("maria"));
  assert.equal(await decryptField(KEY, a), "maria@example.com");
  await assert.rejects(decryptField(KEY2, a)); // wrong key
  const tampered = a.slice(0, -2) + (a.endsWith("A") ? "BB" : "AA");
  await assert.rejects(decryptField(KEY, tampered));
});

test("keyed hash is deterministic per key and does not reveal input", async () => {
  const h1 = await keyedHash(KEY, "maria@example.com");
  assert.equal(h1, await keyedHash(KEY, "maria@example.com"));
  assert.notEqual(h1, await keyedHash(KEY2, "maria@example.com"));
  assert.ok(!h1.includes("maria"));
});

test("timingSafeEqual and references", () => {
  assert.equal(timingSafeEqual("abc", "abc"), true);
  assert.equal(timingSafeEqual("abc", "abd"), false);
  assert.equal(timingSafeEqual("abc", "abcd"), false);
  assert.match(newReference("BIUG"), /^BIUG-[2-9A-Z]{10}$/);
});

test("Cloudflare Access JWT verification (RS256)", async () => {
  const kp = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  );
  const jwk = Object.assign(await crypto.subtle.exportKey("jwk", kp.publicKey), { kid: "k1" });
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const sign = async (payload) => {
    const h = b64u({ alg: "RS256", kid: "k1" });
    const p = b64u(payload);
    const sig = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      kp.privateKey,
      new TextEncoder().encode(h + "." + p)
    );
    return h + "." + p + "." + Buffer.from(sig).toString("base64url");
  };
  const opts = { teamDomain: "biug.cloudflareaccess.com", aud: "AUD1", jwks: [jwk] };
  const exp = Math.floor(Date.now() / 1000) + 600;
  const good = await sign({
    aud: ["AUD1"],
    email: "admin@biugacademy.org",
    exp,
    iss: "https://biug.cloudflareaccess.com",
  });
  assert.equal(await verifyAccessJwt(good, opts), "admin@biugacademy.org");
  const wrongAud = await sign({
    aud: ["OTHER"],
    email: "x@y.z",
    exp,
    iss: "https://biug.cloudflareaccess.com",
  });
  assert.equal(await verifyAccessJwt(wrongAud, opts), false);
  const expired = await sign({
    aud: ["AUD1"],
    email: "x@y.z",
    exp: 1,
    iss: "https://biug.cloudflareaccess.com",
  });
  assert.equal(await verifyAccessJwt(expired, opts), false);
  assert.equal(await verifyAccessJwt(good.slice(0, -4) + "AAAA", opts), false);
  assert.equal(await verifyAccessJwt(undefined, opts), false);
});
