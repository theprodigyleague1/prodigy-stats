// Vercel serverless function: GET /api/leaderboard
// Cached at Vercel's edge for 10 minutes so visitors don't hit the Superstat API on every load.

import { buildLeaderboard } from '../lib/leaderboard.js';

export default async function handler(req, res) {
  const debug = req.query?.debug === '1';
  try {
    // One key per Superstat club, comma-separated (NXT, Frosh and Prep are separate clubs).
    const apiKeys = String(process.env.SUPERSTAT_API_KEYS || process.env.SUPERSTAT_API_KEY || '')
      .split(',').map(k => k.trim()).filter(Boolean);
    const data = await buildLeaderboard({ apiKeys, debug });
    res.setHeader('Cache-Control', debug ? 'no-store' : 's-maxage=600, stale-while-revalidate=86400');
    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.setHeader('Cache-Control', 'no-store');
    res.status(err.status === 401 ? 401 : 500).json({ error: err.message });
  }
}
