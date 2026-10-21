// Vercel serverless function: GET /api/leaderboard
// Fallback only — the page normally reads data/leaderboard.json, built at deploy time.
// Cached at Vercel's edge for a day so it rarely reaches the Superstat API either.

import { buildLeaderboard } from '../lib/leaderboard.js';
import { apiKeysFromEnv } from '../lib/keys.js';

export default async function handler(req, res) {
  const debug = req.query?.debug === '1';
  try {
    const data = await buildLeaderboard({ apiKeys: apiKeysFromEnv(), debug });
    // A run where some team failed is only kept for a minute, so it heals quickly.
    const cache = debug ? 'no-store'
      : data.warnings?.length ? 's-maxage=60, stale-while-revalidate=600'
      : 's-maxage=86400, stale-while-revalidate=86400';
    res.setHeader('Cache-Control', cache);
    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.setHeader('Cache-Control', 'no-store');
    res.status(err.status === 401 ? 401 : 500).json({ error: err.message });
  }
}
