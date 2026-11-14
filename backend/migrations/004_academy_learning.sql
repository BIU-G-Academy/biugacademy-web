-- Learning MVP schema. Not applied by this pull request.
-- Course text lives in backend/learning/catalog.js. These tables store
-- accounts, sessions, cohorts, assignments, progress, and earned badges.
-- Contact fields, government identifiers, and free-text reflections are intentionally absent.

CREATE TABLE IF NOT EXISTS academy_accounts (
  id UUID PRIMARY KEY,
  login_name TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  "role" TEXT NOT NULL CHECK ("role" IN ('learner', 'instructor', 'admin')),
  locale TEXT NOT NULL DEFAULT 'pt' CHECK (locale IN ('pt', 'en')),
  age_attested_18 BOOLEAN NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT academy_accounts_age_pilot CHECK (age_attested_18 = TRUE),
  CONSTRAINT academy_accounts_login_shape CHECK (login_name ~ '^[a-z0-9][a-z0-9-]{2,39}$')
);

CREATE TABLE IF NOT EXISTS academy_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES academy_accounts (id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_academy_sessions_account
  ON academy_sessions (account_id);

CREATE TABLE IF NOT EXISTS academy_cohorts (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  track TEXT NOT NULL CHECK (track IN ('developer', 'nondeveloper')),
  summary TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES academy_accounts (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academy_memberships (
  cohort_id UUID NOT NULL REFERENCES academy_cohorts (id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES academy_accounts (id) ON DELETE CASCADE,
  membership_role TEXT NOT NULL CHECK (membership_role IN ('learner', 'instructor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cohort_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_academy_memberships_account
  ON academy_memberships (account_id);

CREATE TABLE IF NOT EXISTS academy_cohort_courses (
  cohort_id UUID NOT NULL REFERENCES academy_cohorts (id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cohort_id, course_id)
);

CREATE TABLE IF NOT EXISTS academy_progress (
  account_id UUID NOT NULL REFERENCES academy_accounts (id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES academy_cohorts (id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed')),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, cohort_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_academy_progress_cohort
  ON academy_progress (cohort_id);

CREATE TABLE IF NOT EXISTS academy_badges_earned (
  account_id UUID NOT NULL REFERENCES academy_accounts (id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES academy_cohorts (id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  source_module_id TEXT,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, cohort_id, badge_id)
);
