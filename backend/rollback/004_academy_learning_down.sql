-- Rollback for 004_academy_learning.sql.
-- DO NOT run this against production, UAT, or any database that holds real
-- learner records. This file is not in backend/migrations and is not applied
-- by `npm run migrate`.
--
-- Effect: drops learning tables only. Waitlist and email outbox tables stay.
-- Active sessions stop working because academy_sessions is removed.
-- Take a backup first if any row might matter, then run manually:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/rollback/004_academy_learning_down.sql

DROP TABLE IF EXISTS academy_badges_earned;
DROP TABLE IF EXISTS academy_progress;
DROP TABLE IF EXISTS academy_cohort_courses;
DROP TABLE IF EXISTS academy_memberships;
DROP TABLE IF EXISTS academy_sessions;
DROP TABLE IF EXISTS academy_cohorts;
DROP TABLE IF EXISTS academy_accounts;
