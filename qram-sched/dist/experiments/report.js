/** Shared report helpers: every experiment writes a self-contained markdown report to out/reports/. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
export const reportDir = resolve(import.meta.dirname, "../../out/reports");
export function writeReport(name, body) {
    const file = resolve(reportDir, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body, "utf8");
    return file;
}
export function table(headers, rows) {
    const head = `| ${headers.join(" | ")} |`;
    const sep = `| ${headers.map(() => "---").join(" | ")} |`;
    const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
    return [head, sep, body].join("\n");
}
export function fitSlope(xs, ys) {
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0;
    let den = 0;
    for (let i = 0; i < xs.length; i++) {
        num += (xs[i] - mx) * (ys[i] - my);
        den += (xs[i] - mx) ** 2;
    }
    return num / den;
}
export function fmt(x, digits = 3) {
    if (!Number.isFinite(x))
        return String(x);
    return x.toFixed(digits);
}
