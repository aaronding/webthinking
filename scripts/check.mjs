// Checks the site before it is deployed: the Worker parses, and every local file
// the pages link to exists. Plain Node, no dependencies.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const pages = ['index.html', '404.html'];
// These paths are passed through to the demos' own repos by worker.js.
const proxied = /^\/(gcwind|ScorpionSolitaire)(\/|$)/;
const problems = [];

for (const page of pages) {
  const html = readFileSync(join(root, page), 'utf8');
  for (const [, ref] of html.matchAll(/\b(?:href|src)="(\/[^"]*)"/g)) {
    if (ref.startsWith('//') || proxied.test(ref)) continue;
    const path = ref.split(/[?#]/)[0];
    if (path === '/') continue;
    if (!existsSync(join(root, path))) problems.push(`${page}: ${ref} does not exist`);
  }
  if (!/<title>[^<]+<\/title>/.test(html)) problems.push(`${page}: no title`);
}

const config = readFileSync(join(root, 'wrangler.jsonc'), 'utf8');
if (!/"name":\s*"webthinking-tools"/.test(config)) problems.push('wrangler.jsonc: the Worker is not named webthinking-tools');

const version = readFileSync(join(root, 'VERSION'), 'utf8').trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) problems.push(`VERSION: "${version}" is not X.Y.Z`);
if (!readFileSync(join(root, 'index.html'), 'utf8').includes(`<span id="version">v${version}</span>`)) {
  problems.push(`index.html: the footer does not show v${version}`);
}

if (problems.length) {
  console.error(problems.map((p) => `✘ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`✔ ${pages.length} pages and the Worker config look right`);
