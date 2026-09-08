/**
 * EXP5 — THE ATLAS: render the registry, enforce the discipline, emit
 * reports/atlas.md + reports/atlas.json.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkAtlas, runMachineCertificates, verdictGroups } from "../atlas/check.js";
import { ATLAS } from "../atlas/entries.js";
import { VERDOC_ORDER, type AtlasEntry, type Verdict } from "../atlas/types.js";
import { reportDir, table, writeReport } from "./report.js";
import { pathToFileURL } from "node:url";

const VERDICT_BLURB: Readonly<Record<Verdict, string>> = {
  "P-EXACT": "Already exactly polynomial — there is nothing left to accelerate.",
  "CONDITIONAL-WALL": "NP-hard: an exact polynomial quantum algorithm would imply NP ⊆ BQP (one shared, visible conditional).",
  "QUERY-WALL": "Black-box access is capped at quadratic — the (2q+1)²/N certificate, machine-checked.",
  "HW-WAIT": "A certified (typically quadratic) quantum speedup exists; it waits on fault-tolerant hardware.",
  "INFO-WALL": "The wall is informational (online/adversarial); quantum search does not move it.",
  "VERIFICATION-GAP": "The quantum side changes the witness structure (QMA / StoqMA), not the search speed.",
  HEURISTIC: "Empirical performance claims, sized and reproducible — no complexity-class movement.",
  "MECHANISM-SETTLED": "A mechanism-design property settled at theorem level by exact algebra in a workspace prototype — positive or no-go; physics, not search speed.",
  OPEN: "Annotated with the precise open question.",
};

function certSummary(e: AtlasEntry): string {
  return e.certs.map((c) => `${c.kind}:${c.ref}`).join("; ");
}

function run(): void {
  const groups = verdictGroups();
  const { violations } = checkAtlas();
  const machine = runMachineCertificates();

  const sections: string[] = [];
  for (const verdict of VERDOC_ORDER) {
    const list = groups[verdict];
    if (list.length === 0) continue;
    sections.push(
      `## ${verdict} (${list.length})\n\n${VERDICT_BLURB[verdict]}\n\n${table(
        ["problem", "classical", "quantum upper", "quantum lower", "certificates"],
        list.map((e) => [e.problem, e.classical.cls, e.quantumUpper, e.quantumLower, certSummary(e)]),
      )}`,
    );
  }

  const machineTable = table(
    ["machine certificate", "verdict", "detail"],
    machine.map((m) => [m.id, m.pass ? "PASS" : "FAIL", m.detail]),
  );

  const body = `# The BQP x NP Scheduling Complexity Atlas\n\nEvery row carries certificates; \`npm test\` re-runs the machine ones.\n\n${sections.join("\n\n")}\n\n## Machine certificates (re-executed at repro time)\n\n${machineTable}\n\n## Discipline check\n\n${violations.length === 0 ? "0 violations — every verdict is certificate-backed." : `VIOLATIONS:\n${violations.map((v) => `- ${v}`).join("\n")}`}\n`;
  const md = writeReport("atlas.md", body);

  const json = JSON.stringify(
    {
      generated: "repro",
      violations,
      machine: machine.map((m) => ({ id: m.id, pass: m.pass, detail: m.detail })),
      entries: ATLAS,
    },
    null,
    2,
  );
  const jsonFile = resolve(reportDir, "atlas.json");
  writeFileSync(jsonFile, json, "utf8");

  if (violations.length > 0 || machine.some((m) => !m.pass)) {
    throw new Error(`atlas discipline failed: ${[...violations, ...machine.filter((m) => !m.pass).map((m) => m.id)].join("; ")}`);
  }
  console.log(`exp5 done -> ${md}, ${jsonFile}`);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  run();
}
