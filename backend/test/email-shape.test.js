"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { looksLikeEmail } = require("../server");

describe("looksLikeEmail", () => {
  it("accepts ordinary addresses", () => {
    for (const v of ["a@b.co", "nome.apelido@exemplo.ao", " x+tag@sub.domain.org "]) {
      assert.equal(looksLikeEmail(v), true, v);
    }
  });

  it("rejects malformed values", () => {
    for (const v of [
      "",
      "a",
      "a@b",
      "@b.co",
      "a@@b.co",
      "a@b.",
      "a@.co",
      "a b@c.co",
      "+244923000000",
    ]) {
      assert.equal(looksLikeEmail(v), false, v);
    }
  });

  it("rejects over-long input and stays fast on pathological input", () => {
    assert.equal(looksLikeEmail(`${"a".repeat(400)}@b.co`), false);
    const evil = `a@${"a.".repeat(50000)}`; // ReDoS-shaped for the old regex
    const start = process.hrtime.bigint();
    looksLikeEmail(evil);
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    assert.ok(ms < 50, `took ${ms}ms`);
  });
});
