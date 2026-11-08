"use strict";

function createPgStore(db) {
  return {
    async withTransaction(fn) {
      if (typeof db.connect !== "function") return fn(createPgStore(db));
      const client = await db.connect();
      const tx = createPgStore(client);
      try {
        await client.query("BEGIN");
        const result = await fn(tx);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch (_rollbackError) {
          /* The original error is the one that matters. */
        }
        throw error;
      } finally {
        client.release();
      }
    },

    async createAccount(row) {
      const result = await db.query(
        `INSERT INTO academy_accounts (
           id, login_name, password_hash, display_name, "role", locale, age_attested_18, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id, login_name, password_hash, display_name, "role", locale, age_attested_18, status, created_at`,
        [
          row.id,
          row.login_name,
          row.password_hash,
          row.display_name,
          row.role,
          row.locale,
          row.age_attested_18,
          row.status,
        ]
      );
      return mapAccount(result.rows[0]);
    },

    async findAccountById(id) {
      const result = await db.query(
        `SELECT id, login_name, password_hash, display_name, "role", locale, age_attested_18, status, created_at
         FROM academy_accounts WHERE id = $1`,
        [id]
      );
      return mapAccount(result.rows[0]);
    },

    async findAccountByLogin(loginName) {
      const result = await db.query(
        `SELECT id, login_name, password_hash, display_name, "role", locale, age_attested_18, status, created_at
         FROM academy_accounts WHERE login_name = $1`,
        [String(loginName || "").toLowerCase()]
      );
      return mapAccount(result.rows[0]);
    },

    async listAccounts() {
      const result = await db.query(
        `SELECT id, login_name, password_hash, display_name, "role", locale, age_attested_18, status, created_at
         FROM academy_accounts ORDER BY created_at ASC`
      );
      return result.rows.map(mapAccount);
    },

    async setAccountStatus(id, status) {
      const result = await db.query(
        `UPDATE academy_accounts SET status = $2 WHERE id = $1
         RETURNING id, login_name, password_hash, display_name, "role", locale, age_attested_18, status, created_at`,
        [id, status]
      );
      return mapAccount(result.rows[0]);
    },

    async createSession(row) {
      const result = await db.query(
        `INSERT INTO academy_sessions (token_hash, account_id, expires_at, revoked_at)
         VALUES ($1,$2,$3,$4)
         RETURNING token_hash, account_id, expires_at, revoked_at`,
        [row.token_hash, row.account_id, row.expires_at, row.revoked_at || null]
      );
      return result.rows[0];
    },

    async findSessionByTokenHash(tokenHash) {
      const result = await db.query(
        `SELECT token_hash, account_id, expires_at, revoked_at FROM academy_sessions WHERE token_hash = $1`,
        [tokenHash]
      );
      return result.rows[0] || null;
    },

    async revokeSession(tokenHash, revokedAt) {
      await db.query(
        `UPDATE academy_sessions SET revoked_at = $2 WHERE token_hash = $1 AND revoked_at IS NULL`,
        [tokenHash, revokedAt]
      );
    },

    async revokeSessionsForAccount(accountId, revokedAt) {
      await db.query(
        `UPDATE academy_sessions SET revoked_at = $2 WHERE account_id = $1 AND revoked_at IS NULL`,
        [accountId, revokedAt]
      );
    },

    async createCohort(row) {
      const result = await db.query(
        `INSERT INTO academy_cohorts (id, slug, name, track, summary, created_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, slug, name, track, summary, created_by, created_at`,
        [row.id, row.slug, row.name, row.track, row.summary, row.created_by]
      );
      return result.rows[0];
    },

    async findCohortById(id) {
      const result = await db.query(
        `SELECT id, slug, name, track, summary, created_by, created_at FROM academy_cohorts WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    async findCohortBySlug(slug) {
      const result = await db.query(
        `SELECT id, slug, name, track, summary, created_by, created_at FROM academy_cohorts WHERE slug = $1`,
        [slug]
      );
      return result.rows[0] || null;
    },

    async listCohorts() {
      const result = await db.query(
        `SELECT id, slug, name, track, summary, created_by, created_at FROM academy_cohorts ORDER BY created_at ASC`
      );
      return result.rows;
    },

    async addMembership(row) {
      const result = await db.query(
        `INSERT INTO academy_memberships (cohort_id, account_id, membership_role)
         VALUES ($1,$2,$3)
         RETURNING cohort_id, account_id, membership_role, created_at`,
        [row.cohort_id, row.account_id, row.membership_role]
      );
      return result.rows[0];
    },

    async findMembership(cohortId, accountId) {
      const result = await db.query(
        `SELECT cohort_id, account_id, membership_role, created_at
         FROM academy_memberships WHERE cohort_id = $1 AND account_id = $2`,
        [cohortId, accountId]
      );
      return result.rows[0] || null;
    },

    async listMembershipsForAccount(accountId) {
      const result = await db.query(
        `SELECT cohort_id, account_id, membership_role, created_at
         FROM academy_memberships WHERE account_id = $1`,
        [accountId]
      );
      return result.rows;
    },

    async listMembershipsForCohort(cohortId) {
      const result = await db.query(
        `SELECT cohort_id, account_id, membership_role, created_at
         FROM academy_memberships WHERE cohort_id = $1`,
        [cohortId]
      );
      return result.rows;
    },

    async assignCourse(row) {
      await db.query(`INSERT INTO academy_cohort_courses (cohort_id, course_id) VALUES ($1,$2)`, [
        row.cohort_id,
        row.course_id,
      ]);
      return { cohort_id: row.cohort_id, course_id: row.course_id };
    },

    async listCourseIdsForCohort(cohortId) {
      const result = await db.query(
        `SELECT course_id FROM academy_cohort_courses WHERE cohort_id = $1 ORDER BY assigned_at ASC`,
        [cohortId]
      );
      return result.rows.map((row) => row.course_id);
    },

    async completeProgress(row) {
      const result = await db.query(
        `INSERT INTO academy_progress (account_id, cohort_id, module_id, status, completed_at)
         VALUES ($1,$2,$3,'completed',$4)
         ON CONFLICT (account_id, cohort_id, module_id) DO NOTHING
         RETURNING account_id, cohort_id, module_id, status, completed_at`,
        [row.account_id, row.cohort_id, row.module_id, row.completed_at]
      );
      if (result.rows[0]) return result.rows[0];
      const existing = await db.query(
        `SELECT account_id, cohort_id, module_id, status, completed_at
         FROM academy_progress WHERE account_id = $1 AND cohort_id = $2 AND module_id = $3`,
        [row.account_id, row.cohort_id, row.module_id]
      );
      return existing.rows[0];
    },

    async listProgressForAccountCohort(accountId, cohortId) {
      const result = await db.query(
        `SELECT account_id, cohort_id, module_id, status, completed_at
         FROM academy_progress WHERE account_id = $1 AND cohort_id = $2`,
        [accountId, cohortId]
      );
      return result.rows;
    },

    async listProgressForCohort(cohortId) {
      const result = await db.query(
        `SELECT account_id, cohort_id, module_id, status, completed_at FROM academy_progress WHERE cohort_id = $1`,
        [cohortId]
      );
      return result.rows;
    },

    async grantBadge(row) {
      const result = await db.query(
        `INSERT INTO academy_badges_earned (account_id, cohort_id, badge_id, source_module_id, earned_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (account_id, cohort_id, badge_id) DO NOTHING
         RETURNING account_id, cohort_id, badge_id, source_module_id, earned_at`,
        [row.account_id, row.cohort_id, row.badge_id, row.source_module_id || null, row.earned_at]
      );
      if (result.rows[0]) return result.rows[0];
      const existing = await db.query(
        `SELECT account_id, cohort_id, badge_id, source_module_id, earned_at
         FROM academy_badges_earned WHERE account_id = $1 AND cohort_id = $2 AND badge_id = $3`,
        [row.account_id, row.cohort_id, row.badge_id]
      );
      return existing.rows[0];
    },

    async revokeBadge(accountId, cohortId, badgeId) {
      await db.query(
        `DELETE FROM academy_badges_earned WHERE account_id = $1 AND cohort_id = $2 AND badge_id = $3`,
        [accountId, cohortId, badgeId]
      );
    },

    async listBadges(accountId, cohortId) {
      const result = await db.query(
        `SELECT account_id, cohort_id, badge_id, source_module_id, earned_at
         FROM academy_badges_earned WHERE account_id = $1 AND cohort_id = $2`,
        [accountId, cohortId]
      );
      return result.rows;
    },
  };
}

function mapAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    login_name: row.login_name,
    password_hash: row.password_hash,
    display_name: row.display_name,
    role: row.role,
    locale: row.locale,
    age_attested_18: row.age_attested_18 === true,
    status: row.status,
    created_at: row.created_at,
  };
}

module.exports = { createPgStore };
