import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const site = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, site), "utf8");

for (const path of [
  "pt/privacidade/index.html",
  "en/privacy/index.html",
  "fr/confidentialite/index.html",
  "pt/entrar-primeira-turma/index.html",
  "en/waitlist/index.html",
  "fr/rejoindre-premiere-cohorte/index.html",
  "apply/index.html",
]) {
  test(`${path} does not expose an intake or privacy submission form`, () => {
    const html = read(path);
    assert.doesNotMatch(html, /<(?:form|input|textarea|select)\b/i);
    assert.doesNotMatch(html, /CONTROLLER ADDRESS|ENDEREÇO DO RESPONSÁVEL|ADRESSE DU RESPONSABLE/i);
    assert.doesNotMatch(html, /formsubmit\.co|data-intake-form/i);
  });
}

test("privacy pages retain an explicit contact route", () => {
  for (const path of ["pt/privacidade", "en/privacy", "fr/confidentialite"]) {
    assert.match(read(`${path}/index.html`), /href="mailto:support@biugacademy\.org"/);
  }
});
