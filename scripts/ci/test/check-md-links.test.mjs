import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { brokenLinks, extractLinks } from "../check-md-links.mjs";

describe("markdown link checker", () => {
  it("extracts inline and reference links, ignoring code", () => {
    const md = "[a](x.md) ![i](img.png \"t\")\n[ref]: ../y.md\n`[no](skip.md)`\n```\n[no](skip2.md)\n```";
    assert.deepEqual(extractLinks(md).sort(), ["../y.md", "img.png", "x.md"]);
  });

  it("reports only missing relative targets", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "mdlinks-"));
    fs.mkdirSync(path.join(repo, "docs/sub"), { recursive: true });
    const files = {
      "README.md": "[ok](docs/a.md) [dir](docs/sub/) [web](https://example.org) [anchor](#x) [bad](docs/missing.md)",
      "docs/a.md": "[up](../README.md#top) [abs](/docs/sub/b.md) [bad](nope.md)",
      "docs/sub/b.md": "x",
    };
    for (const [f, t] of Object.entries(files)) fs.writeFileSync(path.join(repo, f), t);
    const broken = brokenLinks(repo, Object.keys(files));
    fs.rmSync(repo, { recursive: true, force: true });
    assert.deepEqual(broken, ["README.md: docs/missing.md", "docs/a.md: nope.md"]);
  });
});
