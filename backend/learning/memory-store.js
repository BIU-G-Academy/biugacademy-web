"use strict";

function copy(value) {
  return value == null ? value : { ...value };
}

function createMemoryStore() {
  const accounts = new Map();
  const sessions = new Map();
  const cohorts = new Map();
  const memberships = [];
  const assignments = [];
  const progress = [];
  const badges = [];

  const store = {
    async withTransaction(fn) {
      return fn(store);
    },

    async createAccount(row) {
      accounts.set(row.id, { ...row });
      return copy(accounts.get(row.id));
    },

    async findAccountById(id) {
      return copy(accounts.get(id));
    },

    async findAccountByLogin(loginName) {
      const needle = String(loginName || "").toLowerCase();
      for (const account of accounts.values()) {
        if (account.login_name === needle) return copy(account);
      }
      return null;
    },

    async listAccounts() {
      return [...accounts.values()].map(copy);
    },

    async setAccountStatus(id, status) {
      const account = accounts.get(id);
      if (!account) return null;
      account.status = status;
      return copy(account);
    },

    async createSession(row) {
      sessions.set(row.token_hash, { ...row, revoked_at: null });
      return copy(sessions.get(row.token_hash));
    },

    async findSessionByTokenHash(tokenHash) {
      return copy(sessions.get(tokenHash));
    },

    async revokeSession(tokenHash, revokedAt) {
      const session = sessions.get(tokenHash);
      if (!session || session.revoked_at) return;
      session.revoked_at = revokedAt;
    },

    async revokeSessionsForAccount(accountId, revokedAt) {
      for (const session of sessions.values()) {
        if (session.account_id === accountId && !session.revoked_at) session.revoked_at = revokedAt;
      }
    },

    async createCohort(row) {
      cohorts.set(row.id, { ...row });
      return copy(cohorts.get(row.id));
    },

    async findCohortById(id) {
      return copy(cohorts.get(id));
    },

    async findCohortBySlug(slug) {
      for (const cohort of cohorts.values()) {
        if (cohort.slug === slug) return copy(cohort);
      }
      return null;
    },

    async listCohorts() {
      return [...cohorts.values()].map(copy);
    },

    async addMembership(row) {
      memberships.push({ ...row });
      return copy(row);
    },

    async findMembership(cohortId, accountId) {
      const found = memberships.find(
        (row) => row.cohort_id === cohortId && row.account_id === accountId
      );
      return copy(found);
    },

    async listMembershipsForAccount(accountId) {
      return memberships.filter((row) => row.account_id === accountId).map(copy);
    },

    async listMembershipsForCohort(cohortId) {
      return memberships.filter((row) => row.cohort_id === cohortId).map(copy);
    },

    async assignCourse(row) {
      assignments.push({ ...row });
      return copy(row);
    },

    async listCourseIdsForCohort(cohortId) {
      return assignments.filter((row) => row.cohort_id === cohortId).map((row) => row.course_id);
    },

    async completeProgress(row) {
      const existing = progress.find(
        (item) =>
          item.account_id === row.account_id &&
          item.cohort_id === row.cohort_id &&
          item.module_id === row.module_id
      );
      if (existing) return copy(existing);
      progress.push({ ...row });
      return copy(row);
    },

    async listProgressForAccountCohort(accountId, cohortId) {
      return progress
        .filter((row) => row.account_id === accountId && row.cohort_id === cohortId)
        .map(copy);
    },

    async listProgressForCohort(cohortId) {
      return progress.filter((row) => row.cohort_id === cohortId).map(copy);
    },

    async grantBadge(row) {
      const existing = badges.find(
        (item) =>
          item.account_id === row.account_id &&
          item.cohort_id === row.cohort_id &&
          item.badge_id === row.badge_id
      );
      if (existing) return copy(existing);
      badges.push({ ...row });
      return copy(row);
    },

    async revokeBadge(accountId, cohortId, badgeId) {
      const index = badges.findIndex(
        (item) =>
          item.account_id === accountId && item.cohort_id === cohortId && item.badge_id === badgeId
      );
      if (index >= 0) badges.splice(index, 1);
    },

    async listBadges(accountId, cohortId) {
      return badges
        .filter((row) => row.account_id === accountId && row.cohort_id === cohortId)
        .map(copy);
    },
  };

  return store;
}

module.exports = { createMemoryStore };
