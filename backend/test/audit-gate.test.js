"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { evaluate } = require("../scripts/audit-gate");

const ZOD = "https://github.com/advisories/GHSA-mrhx-c7xc-m3w5";
const audit = {
  vulnerabilities: {
    zod: { severity: "high", via: [{ url: ZOD, severity: "high" }] },
    openai: { severity: "high", via: ["zod"] },
    qs: {
      severity: "moderate",
      via: [{ url: "https://github.com/advisories/GHSA-x", severity: "moderate" }],
    },
  },
};
const exception = {
  advisory: "GHSA-mrhx-c7xc-m3w5",
  packages: ["zod", "openai"],
  expires: "2026-12-31",
};

describe("audit gate", () => {
  it("accepts high findings covered by a current exception, including transitive ones", () => {
    const r = evaluate(audit, [exception], "2026-11-13");
    assert.deepEqual(r.failures, []);
    assert.equal(r.accepted.length, 2);
    assert.equal(r.reported.length, 1, "moderate findings are reported, not blocking");
  });

  it("fails when the exception has expired", () => {
    const r = evaluate(audit, [exception], "2027-01-01");
    assert.ok(r.failures.some((f) => f.includes("expired")));
    assert.ok(r.failures.some((f) => f.startsWith("zod")));
  });

  it("fails on a high finding with no exception", () => {
    const r = evaluate(audit, [], "2026-11-13");
    assert.equal(r.failures.length, 2);
  });

  it("does not let an exception for one package cover another", () => {
    const r = evaluate(audit, [{ ...exception, packages: ["zod"] }], "2026-11-13");
    assert.deepEqual(
      r.failures.map((f) => f.split(" ")[0]),
      ["openai"]
    );
  });

  it("fails on critical findings", () => {
    const r = evaluate(
      { vulnerabilities: { x: { severity: "critical", via: [{ url: "GHSA-crit-crit-crit" }] } } },
      [],
      "2026-11-13"
    );
    assert.equal(r.failures.length, 1);
  });
});
