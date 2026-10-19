/**
 * Server-side validation for BIU.G Academy intake payloads.
 * Pure functions (no I/O) so they can be unit-tested in Node and run in the Worker.
 *
 * Only allow-listed fields are kept. Anything else the browser sends is dropped,
 * which is how the "collect the minimum" rule is enforced on the server side.
 */

export const CONSENT_VERSIONS = ["2026-10-19"];
export const FORM_LANGUAGES = ["pt", "en", "fr"];

// Angola's 21 provinces (Lei n.º 14/24, divisão político-administrativa) + outside Angola.
export const PROVINCES = [
  "Bengo",
  "Benguela",
  "Bié",
  "Cabinda",
  "Cuando",
  "Cubango",
  "Cuanza Norte",
  "Cuanza Sul",
  "Cunene",
  "Huambo",
  "Huíla",
  "Icolo e Bengo",
  "Luanda",
  "Lunda Norte",
  "Lunda Sul",
  "Malanje",
  "Moxico",
  "Moxico Leste",
  "Namibe",
  "Uíge",
  "Zaire",
  "Outside Angola",
];
export const AGE_RANGES = ["16-17", "18-24", "25-34", "35-44", "45+"];
export const MINOR_AGE_RANGES = ["16-17"];
export const PRIMARY_LANGUAGES = [
  "Portuguese",
  "Umbundu",
  "Kimbundu",
  "Kikongo",
  "Chokwe",
  "English",
  "French",
  "Other",
];
export const EDUCATION_LEVELS = ["Primary", "Secondary", "Technical", "University", "Other"];
export const AREAS = [
  "financial-literacy",
  "digital-skills",
  "entrepreneurship",
  "technical-careers",
];
export const INTERNET_LEVELS = [
  "Stable home internet",
  "Mobile data only",
  "Shared/limited access",
  "Very limited access",
];
export const DEVICES = [
  "Smartphone only",
  "Smartphone + laptop",
  "Shared computer access",
  "No personal device",
];
export const CONTACT_CHANNELS = ["whatsapp", "sms", "call", "email"];
export const PRIVACY_REQUEST_TYPES = ["deletion", "access", "rectification"];

const EMAIL_RE =
  /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u;
// Control characters (except tab/newline) are rejected in free text.
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

function isTrue(v) {
  return v === true || v === "true" || v === "yes" || v === "on" || v === 1 || v === "1";
}

export function normaliseEmail(v) {
  return str(v).toLowerCase();
}

/**
 * Normalise a phone number to E.164-like digits. Angolan local numbers
 * (9 digits starting with 9) get the +244 prefix.
 */
export function normalisePhone(v) {
  const raw = str(v);
  if (!raw) return "";
  if (!/^[+\d\s().-]{7,25}$/.test(raw)) return null;
  let digits = raw.replace(/[^\d]/g, "");
  if (raw.startsWith("00")) digits = digits.slice(2);
  else if (!raw.startsWith("+") && digits.length === 9 && digits.startsWith("9")) {
    digits = "244" + digits;
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return "+" + digits;
}

/** Keep only a hostname or a short campaign tag, never a full URL with query string. */
export function sanitiseReferral(v) {
  const raw = str(v);
  if (!raw || raw === "direct") return raw ? "direct" : null;
  try {
    const u = new URL(raw);
    return u.hostname.slice(0, 100) || null;
  } catch (_e) {
    const tag = raw.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 50);
    return tag || null;
  }
}

function oneOf(errors, field, value, allowed, required) {
  if (value === "" || value === undefined || value === null) {
    if (required) errors.push(field);
    return null;
  }
  if (!allowed.includes(value)) {
    errors.push(field);
    return null;
  }
  return value;
}

/** Common anti-abuse checks shared by every public endpoint. */
export function isHoneypotFilled(body) {
  return str(body && (body.website || body.honeypot)).length > 0;
}

export function validateApplication(body) {
  const errors = [];
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, errors: ["body"] };
  }

  const full_name = str(body.full_name).replace(/\s+/g, " ");
  if (full_name.length < 2 || full_name.length > 100 || !NAME_RE.test(full_name)) {
    errors.push("full_name");
  }

  const email = normaliseEmail(body.email);
  if (email && (email.length > 254 || !EMAIL_RE.test(email))) errors.push("email");

  const phone = normalisePhone(body.phone_number);
  if (phone === null) errors.push("phone_number");

  if (!email && !phone && !errors.includes("email") && !errors.includes("phone_number")) {
    errors.push("contact"); // at least one way to reach the applicant
  }

  const form_language = oneOf(
    errors,
    "form_language",
    str(body.form_language) || "pt",
    FORM_LANGUAGES,
    true
  );
  const province = oneOf(errors, "province", str(body.province), PROVINCES, true);
  const age_range = oneOf(errors, "age_range", str(body.age_range), AGE_RANGES, true);
  const primary_language = oneOf(
    errors,
    "primary_language",
    str(body.primary_language),
    PRIMARY_LANGUAGES,
    true
  );
  const education_level = oneOf(
    errors,
    "education_level",
    str(body.education_level),
    EDUCATION_LEVELS,
    true
  );
  const internet_access_level = oneOf(
    errors,
    "internet_access_level",
    str(body.internet_access_level),
    INTERNET_LEVELS,
    false
  );
  const device_access = oneOf(errors, "device_access", str(body.device_access), DEVICES, false);
  const preferred_contact = oneOf(
    errors,
    "preferred_contact",
    str(body.preferred_contact),
    CONTACT_CHANNELS,
    false
  );

  let areas = body.areas_of_interest;
  if (typeof areas === "string") areas = [areas];
  if (!Array.isArray(areas)) areas = [];
  areas = [...new Set(areas.map(str))];
  if (areas.length < 1 || areas.length > AREAS.length || areas.some((a) => !AREAS.includes(a))) {
    errors.push("areas_of_interest");
  }

  if (!isTrue(body.consent_privacy)) errors.push("consent_privacy");
  const consent_version = str(body.consent_version);
  if (!CONSENT_VERSIONS.includes(consent_version)) errors.push("consent_version");

  const guardian_consent = isTrue(body.guardian_consent);
  if (age_range && MINOR_AGE_RANGES.includes(age_range) && !guardian_consent) {
    errors.push("guardian_consent");
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      full_name,
      email: email || null,
      phone: phone || null,
      phone_has_whatsapp: phone ? isTrue(body.phone_has_whatsapp) : false,
      preferred_contact,
      province,
      age_range,
      primary_language,
      education_level,
      areas_of_interest: areas,
      internet_access_level,
      device_access,
      form_language,
      consent_version,
      guardian_consent,
      referral_source: sanitiseReferral(body.referral_source),
    },
  };
}

export function validateSupport(body) {
  const errors = [];
  if (!body || typeof body !== "object" || Array.isArray(body))
    return { ok: false, errors: ["body"] };
  const name = str(body.name).replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 100 || !NAME_RE.test(name)) errors.push("name");
  const email = normaliseEmail(body.email);
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) errors.push("email");
  const message = str(body.message);
  if (message.length < 5 || message.length > 2000 || CONTROL_RE.test(message))
    errors.push("message");
  if (!isTrue(body.consent_privacy)) errors.push("consent_privacy");
  const form_language = oneOf(
    errors,
    "form_language",
    str(body.form_language) || "pt",
    FORM_LANGUAGES,
    true
  );
  let page_path = null;
  try {
    page_path = body.page_url ? new URL(str(body.page_url)).pathname.slice(0, 200) : null;
  } catch (_e) {
    page_path = null;
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { name, email, message, form_language, page_path } };
}

export function validatePrivacyRequest(body) {
  const errors = [];
  if (!body || typeof body !== "object" || Array.isArray(body))
    return { ok: false, errors: ["body"] };
  const request_type = oneOf(
    errors,
    "request_type",
    str(body.request_type) || "deletion",
    PRIVACY_REQUEST_TYPES,
    true
  );
  const email = normaliseEmail(body.email);
  if (email && (email.length > 254 || !EMAIL_RE.test(email))) errors.push("email");
  const phone = normalisePhone(body.phone_number);
  if (phone === null) errors.push("phone_number");
  if (!email && !phone && !errors.includes("email") && !errors.includes("phone_number"))
    errors.push("contact");
  const form_language = oneOf(
    errors,
    "form_language",
    str(body.form_language) || "pt",
    FORM_LANGUAGES,
    true
  );
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: { request_type, email: email || null, phone: phone || null, form_language },
  };
}
