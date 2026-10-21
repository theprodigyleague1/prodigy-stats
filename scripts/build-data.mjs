// Runs during the Vercel build. Copies the page into public/ (Vercel's output folder)
// and pulls every box score once, saving public/data/leaderboard.json, which the page
// loads as a plain static file. Visitors never touch the Superstat API; the data
// refreshes whenever the site is rebuilt (daily cron).
//
// If any team fails to load, the build fails on purpose so Vercel keeps serving the
// previous good deployment instead of publishing partial stats.

import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { buildLeaderboard } from '../lib/leaderboard.js';
import { apiKeysFromEnv } from '../lib/keys.js';

const root = new URL('../', import.meta.url);
const out = new URL('public/', root);
const STATIC = ['index.html', 'app.js', 'styles.css', 'data/demo.js', 'lib/leaderboard.js', 'lib/divisions.js'];

await rm(out, { recursive: true, force: true });
for (const file of STATIC) {
  await mkdir(new URL(file.replace(/[^/]+$/, ''), out), { recursive: true });
  await cp(new URL(file, root), new URL(file, out));
}

const apiKeys = apiKeysFromEnv();
if (!apiKeys.length) {
  console.warn('No Superstat API keys set; skipping data build. The page will fall back to /api/leaderboard.');
  process.exit(0);
}

const started = Date.now();
const data = await buildLeaderboard({ apiKeys });
const failed = data.divisions.flatMap(d => d.teams).filter(t => t.status === 'error');
if (failed.length) {
  console.error('Teams failed to load:\n' + failed.map(t => `  ${t.name}: ${t.error}`).join('\n'));
  process.exit(1);
}

await mkdir(new URL('data/', out), { recursive: true });
await writeFile(new URL('data/leaderboard.json', out), JSON.stringify(data));

for (const d of data.divisions) {
  const reporting = d.teams.filter(t => t.status === 'ok').length;
  console.log(`${d.name}: ${d.players.length} players, ${reporting}/${d.teams.length} teams`);
}
if (data.warnings.length) console.warn('Warnings:\n  ' + data.warnings.join('\n  '));
console.log(`Saved public/data/leaderboard.json in ${((Date.now() - started) / 1000).toFixed(1)}s`);
