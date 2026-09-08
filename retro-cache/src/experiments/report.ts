import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { RcError } from "../kernel/state.js";

export function writeReport(name: string, content: string): string {
  const dir = resolve(process.cwd(), "out", "reports");
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, name);
  writeFileSync(path, content, "utf8");
  return path;
}

/** format one report number. A non-finite value is a named offense at the
 *  render boundary: (Number.NaN).toFixed() would happily print "NaN" (and
 *  Infinity "Infinity") into the ledger prose — the same NaN-rides-past-
 *  every-threshold hole the audit layer rejects rows for (RC_NON_FINITE),
 *  closed here at the printer itself. */
export function fmt(x: number, digits = 6): string {
  if (!Number.isFinite(x)) throw new RcError("RC_NON_FINITE", `fmt: cannot render a non-finite number (got ${x})`);
  return x.toFixed(digits);
}
