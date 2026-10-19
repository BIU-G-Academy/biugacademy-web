-- BIU.G Academy first-party intake: initial schema.
-- Contact fields are encrypted in the Worker (AES-256-GCM) before they reach D1.
-- Lookups (dedupe, deletion requests) use keyed HMAC-SHA-256 hashes, never plaintext.

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,                -- public reference, e.g. BIUG-7K3M9Q2T
  created_at TEXT NOT NULL,           -- ISO 8601 UTC, set by the server
  expires_at TEXT NOT NULL,           -- retention deadline (created_at + 12 months)
  form_language TEXT NOT NULL,        -- pt | en | fr
  consent_version TEXT NOT NULL,      -- privacy notice version the applicant accepted
  consent_at TEXT NOT NULL,
  guardian_consent INTEGER NOT NULL DEFAULT 0,
  name_enc TEXT NOT NULL,             -- encrypted full name
  email_enc TEXT,                     -- encrypted email (optional)
  phone_enc TEXT,                     -- encrypted phone (optional)
  email_hash TEXT,                    -- HMAC of normalised email
  phone_hash TEXT,                    -- HMAC of normalised phone
  phone_has_whatsapp INTEGER NOT NULL DEFAULT 0,
  preferred_contact TEXT,
  province TEXT NOT NULL,
  age_range TEXT NOT NULL,
  primary_language TEXT NOT NULL,
  education_level TEXT NOT NULL,
  areas_of_interest TEXT NOT NULL,    -- JSON array of allow-listed values
  internet_access_level TEXT,
  device_access TEXT,
  referral_source TEXT,               -- hostname or utm/ref tag only, never a full URL
  status TEXT NOT NULL DEFAULT 'received'
);
CREATE INDEX IF NOT EXISTS idx_applications_email_hash ON applications(email_hash);
CREATE INDEX IF NOT EXISTS idx_applications_phone_hash ON applications(phone_hash);
CREATE INDEX IF NOT EXISTS idx_applications_expires_at ON applications(expires_at);

CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,           -- created_at + 6 months
  form_language TEXT NOT NULL,
  name_enc TEXT NOT NULL,
  email_enc TEXT NOT NULL,
  email_hash TEXT NOT NULL,
  message_enc TEXT NOT NULL,
  page_path TEXT
);
CREATE INDEX IF NOT EXISTS idx_support_email_hash ON support_messages(email_hash);
CREATE INDEX IF NOT EXISTS idx_support_expires_at ON support_messages(expires_at);

-- Deletion / access requests. Holds hashes only, so the record can outlive the data it erased.
CREATE TABLE IF NOT EXISTS privacy_requests (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,           -- created_at + 24 months (proof of compliance)
  request_type TEXT NOT NULL,         -- deletion | access | rectification
  email_hash TEXT,
  phone_hash TEXT,
  form_language TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | completed | rejected
  completed_at TEXT,
  records_erased INTEGER
);
CREATE INDEX IF NOT EXISTS idx_privacy_status ON privacy_requests(status);

-- Fixed-window rate limiting. Key is an HMAC of (client IP + UTC day); rows live < 48 h.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT NOT NULL,
  window_start TEXT NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

-- Administrator audit trail. No personal data: action, time, counts, actor label.
CREATE TABLE IF NOT EXISTS admin_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT
);
