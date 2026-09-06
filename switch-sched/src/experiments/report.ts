/** Report writer: markdown files into reports/, one per experiment. */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const reportsDir = resolve(process.cwd(), 'reports');

export function writeReport(name: string, body: string): void {
  mkdirSync(reportsDir, { recursive: true });
  const path = resolve(reportsDir, `${name}.md`);
  writeFileSync(path, `# ${name}\n\n${body}\n`, 'utf8');
  console.log(`wrote ${path}`);
}
