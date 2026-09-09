/**
 * The books-agree render guard — batch 90's own conviction held by the suite
 * that convicted it as ungated: the committed out/reports artifact and a
 * fresh renderRegistry() of the same registry are asserted identical on
 * every run. The render is a derived data copy of the registry, and the
 * count-drift law owns it exactly as it owns prose counts — two landing
 * waves once shipped registry updates without re-rendering (the committed
 * report carried eighty-eight batches against the registry's eighty-nine).
 *
 * Line endings are normalized on both sides: CRLF checkouts must not
 * false-convict an identity git itself will normalize.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { renderRegistry } from "../src/experiments/render.js";

const committedPath = resolve(process.cwd(), "out", "reports", "the-burial-record.md");
const normalize = (s: string): string => s.replace(/\r\n/g, "\n");

test("the books agree: the committed render is identical to a fresh render of the registry", () => {
  const committed = normalize(readFileSync(committedPath, "utf8"));
  const fresh = normalize(renderRegistry());
  assert.equal(committed, fresh, "the committed report lags the registry — re-run npm run repro and commit the render with the registry change");
});
