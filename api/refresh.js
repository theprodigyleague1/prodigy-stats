// Vercel cron target (see vercel.json): once a day, ask Vercel to rebuild the site,
// which re-runs scripts/build-data.mjs and publishes fresh stats.
// Needs DEPLOY_HOOK_URL (Vercel → Settings → Git → Deploy Hooks).

export default async function handler(req, res) {
  // Vercel sends "Authorization: Bearer $CRON_SECRET" when CRON_SECRET is set.
  const secret = process.env.CRON_SECRET;
  const allowed = secret
    ? req.headers.authorization === `Bearer ${secret}`
    : String(req.headers['user-agent'] || '').startsWith('vercel-cron');
  if (!allowed) return res.status(401).json({ error: 'unauthorized' });

  const hook = process.env.DEPLOY_HOOK_URL;
  if (!hook) return res.status(500).json({ error: 'DEPLOY_HOOK_URL is not set' });

  const r = await fetch(hook, { method: 'POST' });
  res.setHeader('Cache-Control', 'no-store');
  res.status(r.ok ? 200 : 502).json({ rebuildTriggered: r.ok, status: r.status });
}
