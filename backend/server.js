"use strict";

require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");

const path = require("path");
const { getPool, checkDbConnection } = require("./db");
const { personalIntakeOpen, intakeClosedBody, supportClosedBody } = require("./learning/gates");
const { createLearningRouter } = require("./learning/http");
const {
  queueApplicationEmails,
  queueSupportRequestEmail,
  dispatchPendingEmails,
  startOutboxWorker,
} = require("./email_outbox");

const PORT = Number(process.env.PORT) || 3000;
const MIN_PHONE_DIGITS = 8;
const MIN_MOTIVATION_LENGTH = 20;

const PROVINCE_MAP = {
  bengo: "Bengo",
  benguela: "Benguela",
  bie: "Bié",
  bié: "Bié",
  cabinda: "Cabinda",
  "cuando cubango": "Cuando Cubango",
  cunene: "Cunene",
  huambo: "Huambo",
  huila: "Huíla",
  huíla: "Huíla",
  luanda: "Luanda",
  "lunda norte": "Lunda Norte",
  "lunda sul": "Lunda Sul",
  malanje: "Malanje",
  moxico: "Moxico",
  namibe: "Namibe",
  uige: "Uíge",
  uíge: "Uíge",
  zaire: "Zaire",
};

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("244")) return `+${digits}`;
  return `+${digits}`;
}

function phoneDigitsOk(value) {
  return String(value || "").replace(/\D/g, "").length >= MIN_PHONE_DIGITS;
}

function normalizeProvince(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const key = raw.toLowerCase().replace(/\s+/g, " ");
  return PROVINCE_MAP[key] || raw.replace(/\b\w/g, (char) => char.toUpperCase());
}

function preprocessInterests(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

const waitlistBodySchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  phone_number: z.string().trim().min(3).max(40).refine(phoneDigitsOk),
  whatsapp_number: z
    .preprocess((v) => (v == null ? "" : v), z.string().trim().max(40))
    .refine((v) => v === "" || phoneDigitsOk(v)),
  province: z.string().trim().min(1).max(120),
  municipality: z.string().trim().min(1).max(120),
  age_range: z.string().trim().min(1).max(60),
  primary_language: z.string().trim().min(1).max(60),
  education_level: z.string().trim().min(1).max(120),
  areas_of_interest: z.preprocess(
    preprocessInterests,
    z.array(z.string().trim().min(1).max(100)).min(1)
  ),
  technical_background: z.string().trim().min(1).max(2000),
  internet_access_level: z.string().trim().min(1).max(120),
  device_access: z.string().trim().min(1).max(120),
  employment_status: z.string().trim().min(1).max(120),
  linkedin_optional: z.preprocess((v) => (v == null ? "" : v), z.string().trim().max(240)),
  github_optional: z.preprocess((v) => (v == null ? "" : v), z.string().trim().max(240)),
  motivation_statement: z.string().trim().min(MIN_MOTIVATION_LENGTH).max(4000),
  consent_checkbox: z.preprocess(
    (v) => (v === true || v === "true" || v === "yes" || v === "on" ? true : v),
    z.boolean().refine((v) => v === true)
  ),
  source_platform: z.preprocess(
    (v) => (v == null || String(v).trim() === "" ? "website-waitlist" : v),
    z.string().trim().max(80)
  ),
  browser_language: z.preprocess((v) => (v == null ? "" : v), z.string().trim().max(40)),
  timezone: z.preprocess((v) => (v == null ? "" : v), z.string().trim().max(80)),
  referral_source: z.preprocess((v) => (v == null ? "" : v), z.string().trim().max(240)),
  submission_timestamp: z.preprocess(
    (v) => (v == null || v === "" ? new Date().toISOString() : v),
    z.string().datetime({ offset: true })
  ),
  honeypot: z.preprocess((v) => (v == null ? "" : v), z.string().max(120)),
});

const supportBodySchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  message: z.string().trim().min(3).max(5000),
  page_url: z.preprocess((v) => (v == null ? "" : v), z.string().trim().max(1000)),
});

function isSimplifiedPayload(body) {
  return body && body.contact && !body.email && !body.phone_number;
}

function normalizeSimplifiedPayload(body) {
  const contact = String(body.contact || "").trim();
  const email = looksLikeEmail(contact) ? contact : `pending-${Date.now()}@pending.local`;
  const phone = looksLikeEmail(contact) ? "+244000000000" : normalizePhone(contact);
  return {
    full_name: body.full_name || body.name || "",
    email,
    phone_number: phone,
    whatsapp_number: phone,
    province: normalizeProvince(body.province || "Luanda"),
    municipality: body.municipality || body.city || "N/A",
    age_range: body.age_range || "18-24",
    primary_language: body.primary_language || "Portuguese",
    education_level: body.education_level || "Not specified",
    areas_of_interest: [body.interest || "General"],
    technical_background: body.technical_background || body.current_role || "Not specified",
    internet_access_level: body.internet_access_level || "Limited",
    device_access: body.device_access || "Smartphone only",
    employment_status: body.employment_status || "Not specified",
    linkedin_optional: body.linkedin_optional || "",
    github_optional: body.github_optional || "",
    motivation_statement: body.motivation || body.why_join || "Wants to join BIU.G Academy.",
    consent_checkbox: true,
    source_platform: body.source_platform || "website-waitlist",
    browser_language: body.browser_language || "",
    timezone: body.timezone || "",
    referral_source: body.referral_source || "",
    submission_timestamp: body.submission_timestamp || new Date().toISOString(),
    honeypot: "",
  };
}

function buildAllowedOrigins() {
  const raw = (process.env.FRONTEND_ORIGIN || "").trim().replace(/\/+$/, "");
  const origins = new Set();
  if (raw) {
    origins.add(raw);
    if (raw.startsWith("https://") && !raw.includes("www.")) {
      origins.add(raw.replace("https://", "https://www."));
    }
  }
  if (process.env.NODE_ENV !== "production") {
    [3000, 5173, 5500, 8080].forEach((port) => {
      origins.add(`http://localhost:${port}`);
      origins.add(`http://127.0.0.1:${port}`);
    });
  }
  return origins;
}

const allowedOrigins = buildAllowedOrigins();
const app = express();
app.set("trust proxy", 1);
app.use(
  helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } })
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept", "X-BIUG-Client"],
  })
);
app.use(express.json({ limit: "256kb" }));

const publicPostLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many submissions. Try again later." },
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "biug-academy-intake-api", status: "healthy" });
});
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "biug-academy-intake-api", status: "healthy" });
});
app.get("/health/db", async (_req, res) => {
  try {
    await getPool().query("SELECT 1");
    return res.json({ ok: true, database: "connected" });
  } catch (_error) {
    return res.status(500).json({ ok: false, database: "unavailable" });
  }
});
app.get("/health/email", async (_req, res) => {
  try {
    const result = await getPool().query(
      `SELECT status, COUNT(*)::int AS count FROM email_outbox GROUP BY status`
    );
    return res.json({
      ok: Boolean(process.env.RESEND_API_KEY),
      provider_configured: Boolean(process.env.RESEND_API_KEY),
      outbox: result.rows,
    });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "email outbox unavailable" });
  }
});

app.post("/api/waitlist", publicPostLimiter, async (req, res) => {
  if (!personalIntakeOpen(process.env)) {
    return res.status(403).json(intakeClosedBody());
  }
  const input = isSimplifiedPayload(req.body) ? normalizeSimplifiedPayload(req.body) : req.body;
  if (input && String(input.honeypot || "").trim() !== "") {
    return res.status(202).json({ ok: true, status: "accepted" });
  }

  const parsed = waitlistBodySchema.safeParse(input);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: parsed.error.errors.map((e) => `${e.path.join(".") || "body"}: ${e.message}`),
    });
  }

  const b = parsed.data;
  const row = {
    full_name: b.full_name.trim(),
    email: b.email.trim().toLowerCase(),
    phone_number: normalizePhone(b.phone_number),
    whatsapp_number: b.whatsapp_number ? normalizePhone(b.whatsapp_number) : "",
    province: normalizeProvince(b.province),
    municipality: b.municipality.trim(),
    age_range: b.age_range.trim(),
    primary_language: b.primary_language.trim(),
    education_level: b.education_level.trim(),
    areas_of_interest: b.areas_of_interest,
    technical_background: b.technical_background.trim(),
    internet_access_level: b.internet_access_level.trim(),
    device_access: b.device_access.trim(),
    employment_status: b.employment_status.trim(),
    linkedin_optional: b.linkedin_optional,
    github_optional: b.github_optional,
    motivation_statement: b.motivation_statement.trim(),
    consent_checkbox: true,
    source_platform: b.source_platform.trim(),
    browser_language: (b.browser_language || req.headers["accept-language"] || "")
      .toString()
      .slice(0, 40),
    timezone: b.timezone.trim(),
    referral_source: b.referral_source.trim(),
    submission_timestamp: b.submission_timestamp,
    raw_form_payload: input,
  };

  const pool = getPool();
  const client = await pool.connect();
  let application;

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `${row.email}|${row.phone_number}`,
    ]);

    const duplicate = await client.query(
      `SELECT id FROM waitlist_applications
       WHERE lower(email) = lower($1) OR phone_number = $2
       ORDER BY created_at DESC LIMIT 1`,
      [row.email, row.phone_number]
    );
    if (duplicate.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        error: "Duplicate submission detected. Your application is already in review.",
        applicant_id: duplicate.rows[0].id,
      });
    }

    const inserted = await client.query(
      `INSERT INTO waitlist_applications (
        full_name, email, phone_number, whatsapp_number, province, municipality, age_range,
        primary_language, education_level, areas_of_interest, technical_background,
        internet_access_level, device_access, employment_status, linkedin_optional,
        github_optional, motivation_statement, consent_checkbox, source_platform,
        browser_language, timezone, referral_source, submission_timestamp, raw_form_payload
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24::jsonb
      ) RETURNING *`,
      [
        row.full_name,
        row.email,
        row.phone_number,
        row.whatsapp_number,
        row.province,
        row.municipality,
        row.age_range,
        row.primary_language,
        row.education_level,
        JSON.stringify(row.areas_of_interest),
        row.technical_background,
        row.internet_access_level,
        row.device_access,
        row.employment_status,
        row.linkedin_optional,
        row.github_optional,
        row.motivation_statement,
        row.consent_checkbox,
        row.source_platform,
        row.browser_language,
        row.timezone,
        row.referral_source,
        row.submission_timestamp,
        JSON.stringify(row.raw_form_payload),
      ]
    );

    application = inserted.rows[0];
    await queueApplicationEmails(client, application);
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {}
    console.error("Application transaction failed", error);
    return res.status(500).json({ success: false, error: "Could not save application." });
  } finally {
    client.release();
  }

  try {
    await dispatchPendingEmails(pool, 2);
  } catch (error) {
    console.error("Immediate email dispatch failed", error);
  }

  const emailState = await pool.query(
    `SELECT message_type, status, attempts FROM email_outbox
     WHERE application_id = $1 ORDER BY message_type`,
    [application.id]
  );
  return res.status(201).json({
    ok: true,
    applicant_id: application.id,
    status: "received",
    emails: emailState.rows,
  });
});

app.post("/api/support", publicPostLimiter, async (req, res) => {
  if (!personalIntakeOpen(process.env)) {
    return res.status(403).json(supportClosedBody());
  }
  const parsed = supportBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "Invalid support request." });
  }

  const pool = getPool();
  const client = await pool.connect();
  let supportRequest;
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO support_requests (name, email, message, page_url)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [parsed.data.name, parsed.data.email.toLowerCase(), parsed.data.message, parsed.data.page_url]
    );
    supportRequest = inserted.rows[0];
    await queueSupportRequestEmail(client, supportRequest);
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {}
    console.error("Support request transaction failed", error);
    return res.status(500).json({ success: false, error: "Could not save support request." });
  } finally {
    client.release();
  }

  try {
    await dispatchPendingEmails(pool, 1);
  } catch (error) {
    console.error("Immediate support email dispatch failed", error);
  }

  return res
    .status(201)
    .json({ ok: true, support_request_id: supportRequest.id, status: "received" });
});

app.use("/api", createLearningRouter({ env: process.env }));
app.use(
  "/learn",
  express.static(path.join(__dirname, "..", "portal", "learn"), {
    index: "index.html",
    setHeaders(res) {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
    },
  })
);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, error: "Internal server error" });
});

async function start() {
  try {
    await checkDbConnection();
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  }
  const pool = getPool();
  startOutboxWorker(pool);
  app.listen(PORT, "0.0.0.0", () => console.log(`BIU.G Academy backend listening on port ${PORT}`));
}

if (require.main === module) start();

module.exports = { app, start };
