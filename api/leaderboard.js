// Vercel serverless function: GET /api/leaderboard
// Cached at Vercel's edge for 10 minutes so visitors don't hit the Superstat API on every load.

import { buildLeaderboard } from '../lib/leaderboard.js';

export default async function handler(req, res) {
  const debug = req.query?.debug === '1';
  try {
    // One key per Superstat club (NXT, Frosh and Prep are separate clubs). Accepts a
    // comma-separated SUPERSTAT_API_KEYS and/or one variable per division.
    const env = process.env;
    const apiKeys = [...new Set(
      [env.SUPERSTAT_API_KEYS, env.SUPERSTAT_API_KEY, env.NXT_KEY, env.FROSH_KEY, env.PREP_KEY]
        .flatMap(v => String(v || '').split(','))
        .map(k => k.trim())
        .filter(Boolean),
    )];
    const data = await buildLeaderboard({ apiKeys, debug });
    // A run where some team failed is only kept for a minute, so it heals quickly.
    const cache = debug ? 'no-store'
      : data.warnings?.length ? 's-maxage=60, stale-while-revalidate=600'
      : 's-maxage=600, stale-while-revalidate=86400';
    res.setHeader('Cache-Control', cache);
    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.setHeader('Cache-Control', 'no-store');
    res.status(err.status === 401 ? 401 : 500).json({ error: err.message });
  }
}
