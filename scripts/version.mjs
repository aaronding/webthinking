// Sets the site's version: `node scripts/version.mjs fix|minor|major`, or an exact `1.2.3`.
// VERSION is the source of truth; the footer in index.html shows it. Prints the new version.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const asked = process.argv[2];
const current = readFileSync(`${root}VERSION`, 'utf8').trim();
const [major, minor, fix] = current.split('.').map(Number);

const next = {
  major: `${major + 1}.0.0`,
  minor: `${major}.${minor + 1}.0`,
  fix: `${major}.${minor}.${fix + 1}`,
}[asked] ?? (/^\d+\.\d+\.\d+$/.test(asked ?? '') ? asked : null);
if (!next) {
  console.error('Usage: node scripts/version.mjs fix|minor|major|X.Y.Z');
  process.exit(1);
}

writeFileSync(`${root}VERSION`, `${next}\n`);
const html = readFileSync(`${root}index.html`, 'utf8');
writeFileSync(
  `${root}index.html`,
  html.replace(/(<span id="version">)[^<]*(<\/span>)/, `$1v${next}$2`),
);
console.log(next);
