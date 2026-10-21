# Prodigy League Leaderboard

Individual stat leaders (PPG, RPG, APG, SPG, BPG, 3PM, FG%, 3P%, FT%, and more) for the
NXT, Frosh and Prep divisions, with per-game and season-total views and a sortable table
of every player. Stats come live from the Superstat API.

## How it works

- `api/leaderboard.js` — Vercel serverless function. Uses your Superstat API key to list the
  club's teams, find the Fall 2026 teams, read every completed match's box score, and sum
  them into season lines per player. Vercel caches the result for 10 minutes.
- `lib/divisions.js` — which Superstat teams belong to which division. Edit this to add or
  rename teams.
- `index.html`, `app.js`, `styles.css` — the page. Division dropdown, team filter,
  Per game / Totals toggle. Link to a division directly with `#nxt`, `#frosh` or `#prep`.

Per-game leaders need at least half the games of the division's most-played player.
Percentage leaders also need attempts: FG% 2 FGA per game, 3P% and FT% 1 attempt per game.

## Deploy to Vercel

1. NXT, Frosh and Prep are three separate Superstat clubs, and each API key reads one club.
   Switch to each club in Superstat, open **Settings → API keys**, and create a key there.
2. Push this folder to a GitHub repo and import it at vercel.com/new (no build settings needed),
   or run `npx vercel` from this folder.
3. In the Vercel project, go to **Settings → Environment Variables**, add
   `SUPERSTAT_API_KEYS` with all three keys separated by commas, then redeploy.

Keep the key out of the code and out of git. It only lives in Vercel.

## Checking it

- `/?demo` shows made-up stats so you can look at the design without a key.
- `/api/leaderboard?debug=1` lists every team the key can see, with ids and league labels.
  If a team shows as "not found", compare its name here with `lib/divisions.js`. To pin a
  team to an exact Superstat team, add `id: "<team id>"` to it in `lib/divisions.js`.
- Matching rule: the team name must match, and the team's league/division label must
  contain "Fall 2026" (Superstat also has older teams with the same names).

## Run locally

```bash
ruby dev-server.rb
```

It asks for each club's key (hidden), then serves the site at http://localhost:3000.
The keys stay in that process and are never written to disk or sent to the browser.

Superstat asks that public pages credit them; the page shows "Powered by Superstat" next to the stats.
