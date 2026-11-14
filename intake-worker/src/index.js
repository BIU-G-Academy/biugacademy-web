/**
 * BIU.G Academy first-party intake API (Cloudflare Worker + D1 + Turnstile).
 *
 * Public endpoints (browser, CORS allow-list, Turnstile required):
 *   GET  /api/health
 *   POST /api/waitlist          first-cohort application (minimal data)
 *   POST /api/support           support message
 *   POST /api/privacy-request   deletion / access / rectification request
 *
 * Admin endpoints (Bearer ADMIN_TOKEN, plus Cloudflare Access JWT when configured):
 *   GET  /admin/stats
 *   GET  /admin/applications?format=json|csv
 *   GET  /admin/privacy-requests
 *   POST /admin/erase           { email?, phone_number?, reference?, privacy_request_id? }
 *   POST /admin/purge           run retention now (also runs daily via cron)
 *
 * Personal data never leaves Cloudflare except through the authenticated admin export.
 */

import {
  validateApplication,
  validateSupport,
  validatePrivacyRequest,
  isHoneypotFilled,
  normaliseEmail,
  normalisePhone,
} from "./validate.js";
import { encryptField, decryptField, keyedHash, timingSafeEqual, newReference } from "./crypto.js";

const MAX_BODY_BYTES = 8 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;
export const RETENTION_DAYS = {
  applications: 365,
  support_messages: 183,
  privacy_requests: 730,
  admin_audit: 730,
};

// ---------- helpers ----------

function securityHeaders(extra) {
  return Object.assign(
    {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    },
    extra || {}
  );
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(env, origin) {
  if (!origin || !allowedOrigins(env).includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function json(status, body, extraHeaders) {
  return new Response(JSON.stringify(body), { status, headers: securityHeaders(extraHeaders) });
}

function fail(status, error, cors, fields) {
  const body = { ok: false, error };
  if (fields) body.fields = fields;
  return json(status, body, cors);
}

function nowIso(_env) {
  return new Date().toISOString();
}

function plusDays(iso, days) {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

async function readJson(request) {
  const type = request.headers.get("Content-Type") || "";
  if (!type.toLowerCase().startsWith("application/json"))
    return { error: "unsupported_media_type", status: 415 };
  const len = Number(request.headers.get("Content-Length") || "0");
  if (len > MAX_BODY_BYTES) return { error: "payload_too_large", status: 413 };
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES)
    return { error: "payload_too_large", status: 413 };
  try {
    return { body: JSON.parse(text) };
  } catch (_e) {
    return { error: "invalid_json", status: 400 };
  }
}

function configReady(env) {
  return Boolean(env.DB && env.DATA_KEY && env.HASH_KEY && env.TURNSTILE_SECRET);
}

// ---------- anti-abuse ----------

async function verifyTurnstile(env, token, ip) {
  if (!token || typeof token !== "string" || token.length > 2048)
    return { ok: false, reason: "missing" };
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  form.append("idempotency_key", crypto.randomUUID());
  let res;
  try {
    res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
  } catch (_e) {
    return { ok: false, reason: "unavailable" };
  }
  const out = await res.json().catch(() => ({}));
  if (!out.success) return { ok: false, reason: (out["error-codes"] || ["failed"]).join(",") };
  const expected = String(env.TURNSTILE_EXPECTED_HOSTNAMES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (expected.length && !expected.includes(out.hostname))
    return { ok: false, reason: "hostname_mismatch" };
  return { ok: true };
}

async function rateLimited(env, ip, scope) {
  const limit = Number(env.RATE_LIMIT_PER_HOUR || 10);
  const now = new Date(nowIso(env));
  const window = now.toISOString().slice(0, 13); // UTC hour
  const bucket = await keyedHash(
    env.HASH_KEY,
    "rl|" + scope + "|" + (ip || "unknown") + "|" + window.slice(0, 10)
  );
  const row = await env.DB.prepare(
    "INSERT INTO rate_limits (bucket, window_start, hits) VALUES (?1, ?2, 1) " +
      "ON CONFLICT(bucket, window_start) DO UPDATE SET hits = hits + 1 RETURNING hits"
  )
    .bind(bucket, window)
    .first();
  return row && row.hits > limit;
}

async function guardPublicPost(request, env, scope) {
  const origin = request.headers.get("Origin") || "";
  const cors = corsHeaders(env, origin);
  const url = new URL(request.url);
  if (url.protocol !== "https:" && env.ALLOW_HTTP !== "true")
    return { response: fail(403, "https_required", cors) };
  if (!origin || !allowedOrigins(env).includes(origin))
    return { response: fail(403, "origin_not_allowed", {}) };
  if (!configReady(env)) return { response: fail(503, "intake_not_configured", cors) };
  const parsed = await readJson(request);
  if (parsed.error) return { response: fail(parsed.status, parsed.error, cors) };
  const ip = request.headers.get("CF-Connecting-IP") || "";
  if (await rateLimited(env, ip, scope))
    return { response: fail(429, "rate_limited", Object.assign({ "Retry-After": "3600" }, cors)) };
  const body = parsed.body;
  if (body && typeof body === "object" && isHoneypotFilled(body)) {
    // Pretend success so bots learn nothing; store nothing.
    return {
      response: json(200, { ok: true, reference: newReference("BIUG") }, cors),
      honeypot: true,
    };
  }
  const token = body && (body["cf-turnstile-response"] || body.turnstile_token);
  const ts = await verifyTurnstile(env, token, ip);
  if (!ts.ok) return { response: fail(403, "verification_failed", cors) };
  return { body, cors };
}

// ---------- public handlers ----------

async function handleWaitlist(request, env) {
  const g = await guardPublicPost(request, env, "waitlist");
  if (g.response) return g.response;
  const v = validateApplication(g.body);
  if (!v.ok) return fail(400, "validation_failed", g.cors, v.errors);
  const a = v.value;
  const created = nowIso(env);
  const emailHash = await keyedHash(env.HASH_KEY, a.email);
  const phoneHash = await keyedHash(env.HASH_KEY, a.phone);

  // Duplicate: same contact already applied and not yet expired -> acknowledge, do not store twice.
  const dup = await env.DB.prepare(
    "SELECT id FROM applications WHERE ((?1 IS NOT NULL AND email_hash = ?1) OR (?2 IS NOT NULL AND phone_hash = ?2)) LIMIT 1"
  )
    .bind(emailHash, phoneHash)
    .first();
  if (dup) return json(200, { ok: true, reference: dup.id, duplicate: true }, g.cors);

  const id = newReference("BIUG");
  await env.DB.prepare(
    `INSERT INTO applications (id, created_at, expires_at, form_language, consent_version, consent_at, guardian_consent,
       name_enc, email_enc, phone_enc, email_hash, phone_hash, phone_has_whatsapp, preferred_contact, province, age_range,
       primary_language, education_level, areas_of_interest, internet_access_level, device_access, referral_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?2, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)`
  )
    .bind(
      id,
      created,
      plusDays(created, RETENTION_DAYS.applications),
      a.form_language,
      a.consent_version,
      a.guardian_consent ? 1 : 0,
      await encryptField(env.DATA_KEY, a.full_name),
      await encryptField(env.DATA_KEY, a.email),
      await encryptField(env.DATA_KEY, a.phone),
      emailHash,
      phoneHash,
      a.phone_has_whatsapp ? 1 : 0,
      a.preferred_contact,
      a.province,
      a.age_range,
      a.primary_language,
      a.education_level,
      JSON.stringify(a.areas_of_interest),
      a.internet_access_level,
      a.device_access,
      a.referral_source
    )
    .run();
  return json(201, { ok: true, reference: id }, g.cors);
}

async function handleSupport(request, env) {
  const g = await guardPublicPost(request, env, "support");
  if (g.response) return g.response;
  const v = validateSupport(g.body);
  if (!v.ok) return fail(400, "validation_failed", g.cors, v.errors);
  const s = v.value;
  const created = nowIso(env);
  const id = newReference("SUP");
  await env.DB.prepare(
    `INSERT INTO support_messages (id, created_at, expires_at, form_language, name_enc, email_enc, email_hash, message_enc, page_path)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
  )
    .bind(
      id,
      created,
      plusDays(created, RETENTION_DAYS.support_messages),
      s.form_language,
      await encryptField(env.DATA_KEY, s.name),
      await encryptField(env.DATA_KEY, s.email),
      await keyedHash(env.HASH_KEY, s.email),
      await encryptField(env.DATA_KEY, s.message),
      s.page_path
    )
    .run();
  return json(201, { ok: true, reference: id }, g.cors);
}

async function handlePrivacyRequest(request, env) {
  const g = await guardPublicPost(request, env, "privacy");
  if (g.response) return g.response;
  const v = validatePrivacyRequest(g.body);
  if (!v.ok) return fail(400, "validation_failed", g.cors, v.errors);
  const p = v.value;
  const created = nowIso(env);
  const id = newReference("PRV");
  await env.DB.prepare(
    `INSERT INTO privacy_requests (id, created_at, expires_at, request_type, email_hash, phone_hash, form_language)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  )
    .bind(
      id,
      created,
      plusDays(created, RETENTION_DAYS.privacy_requests),
      p.request_type,
      await keyedHash(env.HASH_KEY, p.email),
      await keyedHash(env.HASH_KEY, p.phone),
      p.form_language
    )
    .run();
  // Same answer whether or not we hold data for this contact: no account enumeration.
  return json(202, { ok: true, reference: id }, g.cors);
}

// ---------- admin ----------

function b64urlToBytes(s) {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(t + "===".slice((t.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Verify a Cloudflare Access JWT (RS256) against the team's JWKS. */
export async function verifyAccessJwt(token, { teamDomain, aud, jwks, now }) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch (_e) {
    return false;
  }
  if (header.alg !== "RS256") return false;
  const keys =
    jwks || (await (await fetch(`https://${teamDomain}/cdn-cgi/access/certs`)).json()).keys;
  const jwk = (keys || []).find((k) => k.kid === header.kid);
  if (!jwk) return false;
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + "." + parts[1])
  );
  if (!ok) return false;
  const t = Math.floor((now || Date.now()) / 1000);
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) return false;
  if (payload.exp && payload.exp < t) return false;
  if (teamDomain && payload.iss !== `https://${teamDomain}`) return false;
  return payload.email || payload.sub || "access-user";
}

async function adminActor(request, env) {
  const token = String(env.ADMIN_TOKEN || "");
  if (token.length < 32) return null; // admin disabled unless a strong token is configured
  const auth = request.headers.get("Authorization") || "";
  const presented = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!timingSafeEqual(presented, token)) return null;
  if (env.ACCESS_AUD && env.ACCESS_TEAM_DOMAIN) {
    const who = await verifyAccessJwt(request.headers.get("Cf-Access-Jwt-Assertion"), {
      teamDomain: env.ACCESS_TEAM_DOMAIN,
      aud: env.ACCESS_AUD,
    });
    return who || null;
  }
  return "admin-token";
}

async function audit(env, actor, action, detail) {
  await env.DB.prepare(
    "INSERT INTO admin_audit (at, actor, action, detail) VALUES (?1, ?2, ?3, ?4)"
  )
    .bind(
      nowIso(env),
      String(actor).slice(0, 120),
      action,
      detail ? JSON.stringify(detail).slice(0, 500) : null
    )
    .run();
}

function csvCell(v) {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // spreadsheet formula injection guard
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function exportApplications(env) {
  const { results } = await env.DB.prepare("SELECT * FROM applications ORDER BY created_at").all();
  const out = [];
  for (const r of results) {
    out.push({
      reference: r.id,
      created_at: r.created_at,
      expires_at: r.expires_at,
      status: r.status,
      form_language: r.form_language,
      consent_version: r.consent_version,
      guardian_consent: !!r.guardian_consent,
      full_name: await decryptField(env.DATA_KEY, r.name_enc),
      email: await decryptField(env.DATA_KEY, r.email_enc),
      phone: await decryptField(env.DATA_KEY, r.phone_enc),
      phone_has_whatsapp: !!r.phone_has_whatsapp,
      preferred_contact: r.preferred_contact,
      province: r.province,
      age_range: r.age_range,
      primary_language: r.primary_language,
      education_level: r.education_level,
      areas_of_interest: JSON.parse(r.areas_of_interest || "[]").join("|"),
      internet_access_level: r.internet_access_level,
      device_access: r.device_access,
      referral_source: r.referral_source,
    });
  }
  return out;
}

export async function runRetention(env) {
  const now = nowIso(env);
  const counts = {};
  for (const table of ["applications", "support_messages", "privacy_requests"]) {
    const r = await env.DB.prepare(`DELETE FROM ${table} WHERE expires_at <= ?1`).bind(now).run();
    counts[table] = r.meta ? r.meta.changes : 0;
  }
  const cutoffHour = new Date(new Date(now).getTime() - 2 * DAY_MS).toISOString().slice(0, 13);
  const rl = await env.DB.prepare("DELETE FROM rate_limits WHERE window_start < ?1")
    .bind(cutoffHour)
    .run();
  counts.rate_limits = rl.meta ? rl.meta.changes : 0;
  const au = await env.DB.prepare("DELETE FROM admin_audit WHERE at <= ?1")
    .bind(plusDays(now, -RETENTION_DAYS.admin_audit))
    .run();
  counts.admin_audit = au.meta ? au.meta.changes : 0;
  return counts;
}

async function handleAdmin(request, env, path) {
  const actor = await adminActor(request, env);
  if (!actor) return fail(401, "unauthorized");
  const url = new URL(request.url);
  if (url.protocol !== "https:" && env.ALLOW_HTTP !== "true") return fail(403, "https_required");

  if (request.method === "GET" && path === "/admin/stats") {
    const q = (sql) =>
      env.DB.prepare(sql)
        .all()
        .then((r) => r.results);
    const stats = {
      applications_total: (await env.DB.prepare("SELECT COUNT(*) AS n FROM applications").first())
        .n,
      by_province: await q(
        "SELECT province, COUNT(*) AS n FROM applications GROUP BY province ORDER BY n DESC"
      ),
      by_age_range: await q("SELECT age_range, COUNT(*) AS n FROM applications GROUP BY age_range"),
      by_internet_access: await q(
        "SELECT internet_access_level, COUNT(*) AS n FROM applications GROUP BY internet_access_level"
      ),
      support_messages: (await env.DB.prepare("SELECT COUNT(*) AS n FROM support_messages").first())
        .n,
      privacy_requests_pending: (
        await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM privacy_requests WHERE status='pending'"
        ).first()
      ).n,
    };
    await audit(env, actor, "stats");
    return json(200, { ok: true, stats });
  }

  if (request.method === "GET" && path === "/admin/applications") {
    const rows = await exportApplications(env);
    await audit(env, actor, "export_applications", {
      rows: rows.length,
      format: url.searchParams.get("format") || "json",
    });
    if (url.searchParams.get("format") === "csv") {
      const cols = rows.length ? Object.keys(rows[0]) : ["reference"];
      const csv = [cols.join(",")]
        .concat(rows.map((r) => cols.map((c) => csvCell(r[c])).join(",")))
        .join("\r\n");
      return new Response(csv, {
        status: 200,
        headers: securityHeaders({
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="biug-applications.csv"',
        }),
      });
    }
    return json(200, { ok: true, applications: rows });
  }

  if (request.method === "GET" && path === "/admin/privacy-requests") {
    const { results } = await env.DB.prepare(
      "SELECT id, created_at, request_type, form_language, status, completed_at, records_erased, " +
        "(SELECT COUNT(*) FROM applications a WHERE (p.email_hash IS NOT NULL AND a.email_hash = p.email_hash) OR (p.phone_hash IS NOT NULL AND a.phone_hash = p.phone_hash)) AS matching_applications " +
        "FROM privacy_requests p ORDER BY created_at"
    ).all();
    await audit(env, actor, "list_privacy_requests", { rows: results.length });
    return json(200, { ok: true, requests: results });
  }

  if (request.method === "POST" && path === "/admin/erase") {
    const parsed = await readJson(request);
    if (parsed.error) return fail(parsed.status, parsed.error);
    const b = parsed.body || {};
    let emailHash = b.email ? await keyedHash(env.HASH_KEY, normaliseEmail(b.email)) : null;
    let phoneHash = b.phone_number
      ? await keyedHash(env.HASH_KEY, normalisePhone(b.phone_number))
      : null;
    if (b.privacy_request_id) {
      const pr = await env.DB.prepare(
        "SELECT email_hash, phone_hash FROM privacy_requests WHERE id = ?1"
      )
        .bind(b.privacy_request_id)
        .first();
      if (!pr) return fail(404, "privacy_request_not_found");
      emailHash = emailHash || pr.email_hash;
      phoneHash = phoneHash || pr.phone_hash;
    }
    if (!emailHash && !phoneHash && !b.reference) return fail(400, "identifier_required");
    const a = await env.DB.prepare(
      "DELETE FROM applications WHERE (?1 IS NOT NULL AND email_hash = ?1) OR (?2 IS NOT NULL AND phone_hash = ?2) OR (?3 IS NOT NULL AND id = ?3)"
    )
      .bind(emailHash, phoneHash, b.reference || null)
      .run();
    const s = await env.DB.prepare(
      "DELETE FROM support_messages WHERE ?1 IS NOT NULL AND email_hash = ?1"
    )
      .bind(emailHash)
      .run();
    const erased = (a.meta ? a.meta.changes : 0) + (s.meta ? s.meta.changes : 0);
    if (b.privacy_request_id) {
      await env.DB.prepare(
        "UPDATE privacy_requests SET status='completed', completed_at=?2, records_erased=?3 WHERE id=?1"
      )
        .bind(b.privacy_request_id, nowIso(env), erased)
        .run();
    }
    await audit(env, actor, "erase", {
      records_erased: erased,
      privacy_request_id: b.privacy_request_id || null,
    });
    return json(200, { ok: true, records_erased: erased });
  }

  if (request.method === "POST" && path === "/admin/purge") {
    const counts = await runRetention(env);
    await audit(env, actor, "purge", counts);
    return json(200, { ok: true, deleted: counts });
  }

  return fail(404, "not_found");
}

// ---------- entry points ----------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      const cors = corsHeaders(env, origin);
      if (!cors["Access-Control-Allow-Origin"])
        return new Response(null, { status: 403, headers: securityHeaders() });
      return new Response(null, { status: 204, headers: securityHeaders(cors) });
    }

    try {
      if (path.startsWith("/admin/")) return await handleAdmin(request, env, path);
      if (request.method === "GET" && path === "/api/health") {
        return json(
          200,
          { ok: true, service: "biug-academy-intake", configured: configReady(env) },
          corsHeaders(env, origin)
        );
      }
      if (request.method === "POST" && path === "/api/waitlist")
        return await handleWaitlist(request, env);
      if (request.method === "POST" && path === "/api/support")
        return await handleSupport(request, env);
      if (request.method === "POST" && path === "/api/privacy-request")
        return await handlePrivacyRequest(request, env);
      return fail(404, "not_found", corsHeaders(env, origin));
    } catch (err) {
      // Never echo payloads or stack traces; log only the error class.
      console.error("intake_error", err && err.name, err && err.message);
      return fail(500, "internal_error", corsHeaders(env, origin));
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runRetention(env).then((counts) => audit(env, "cron", "purge", counts)));
  },
};
