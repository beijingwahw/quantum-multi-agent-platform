/**
 * The README-count guard — the b67#6 law pointed at this repo's own front
 * page: "counts follow the data in the same edit that moves it — the README
 * now says 78/78, re-derived from the run's own arithmetic. Any field that
 * carries data is a copy of the data." The headline batch/error counts in
 * README.md are such a copy, and they had drifted (88/704 against the
 * registry's 93/726) while the suite stayed green. This test convicts that
 * drift on every run, the same way render-agree.test.ts owns the committed
 * report.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { DECLARED_TOTAL_BATCHES, DECLARED_TOTAL_ERRORS } from "../src/kernel/registry.js";

test("the README's headline counts equal the registry's declared totals", () => {
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const headline = `**${DECLARED_TOTAL_BATCHES} batches / ${DECLARED_TOTAL_ERRORS} errors**`;
  assert.ok(
    readme.includes(headline),
    `README.md must carry "${headline}" — a count that drifts from the registry is the exact prose-drift this repo exists to convict (update README with the registry change)`,
  );
});
