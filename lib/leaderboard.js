// Pulls Fall 2026 box scores from the Superstat API and sums them into per-player season lines.
// Pure apart from `fetchImpl`, so it can be exercised with a mocked fetch.

import { LEAGUE } from './divisions.js';

const BASE = 'https://api.superstatsport.com/v1';
const CONCURRENCY = 6;

const norm = s => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

// Superstat box-score field → our short key.
const FIELDS = {
  points: 'pts',
  fieldGoalsMade: 'fgm',
  fieldGoalsAttempted: 'fga',
  threePointersMade: 'tpm',
  threePointersAttempted: 'tpa',
  freeThrowsMade: 'ftm',
  freeThrowsAttempted: 'fta',
  offensiveRebounds: 'oreb',
  defensiveRebounds: 'dreb',
  rebounds: 'reb',
  assists: 'ast',
  steals: 'stl',
  blocks: 'blk',
  turnovers: 'tov',
  fouls: 'pf',
  minutes: 'min',
  efficiency: 'eff',
};

function makeClient(apiKey, fetchImpl) {
  return async function get(path, attempt = 0) {
    const res = await fetchImpl(BASE + path, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });
    if (res.status === 429 && attempt < 3) {
      const wait = Number(res.headers?.get?.('retry-after')) * 1000 || 1000 * 2 ** attempt;
      await new Promise(r => setTimeout(r, wait));
      return get(path, attempt + 1);
    }
    let body;
    try { body = await res.json(); } catch { body = null; }
    if (!res.ok || body?.error) {
      const msg = body?.error?.message || `HTTP ${res.status}`;
      const err = new Error(`${path}: ${msg}`);
      err.status = res.status;
      err.code = body?.error?.code;
      throw err;
    }
    return body.data;
  };
}

async function pool(items, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }));
  return out;
}

function pickTeam(cfg, clubTeams, warnings) {
  if (cfg.id) return clubTeams.find(t => t.id === cfg.id) || null;
  const candidates = clubTeams.filter(t => norm(t.name) === norm(cfg.name));
  const inSeason = candidates.filter(t =>
    norm([t.name, t.league, t.division, t.clubName].join(' ')).includes(LEAGUE.seasonMatch));
  if (inSeason.length > 1) {
    warnings.push(`${cfg.name}: ${inSeason.length} teams match "${LEAGUE.seasonMatch}"; using the newest. Pin one with an id.`);
  }
  if (inSeason.length) {
    return inSeason.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  }
  if (candidates.length === 1) {
    warnings.push(`${cfg.name}: no "${LEAGUE.seasonMatch}" label found; using the only team with that name.`);
    return candidates[0];
  }
  return null;
}

// A team can see the same game twice (its own recording and one shared by the opponent).
// Keep one per date + opponent, preferring the team's own recording.
function dedupeMatches(matches, teamId) {
  const byGame = new Map();
  for (const m of matches) {
    const side = m.team?.id === teamId ? 'team' : m.opponent?.id === teamId ? 'opponent' : null;
    if (!side) continue;
    const other = side === 'team' ? m.opponent : m.team;
    const key = `${String(m.playedAt).slice(0, 10)}|${norm(other?.name)}`;
    const own = (side === 'team') === (m.recordedBy === 'team');
    const prev = byGame.get(key);
    if (!prev || (own && !prev.own)) byGame.set(key, { match: m, side, own });
  }
  return [...byGame.values()];
}

// Each Superstat key belongs to one club, and the divisions live in separate clubs,
// so this takes one key per club. Every team remembers which key can read it.
export async function buildLeaderboard({ apiKeys, fetchImpl = fetch, debug = false }) {
  if (!apiKeys?.length) throw new Error('SUPERSTAT_API_KEYS is not set');
  const warnings = [];

  const clubs = [];
  const clubTeams = [];
  const seen = new Set();
  await Promise.all(apiKeys.map(async (key, i) => {
    const get = makeClient(key, fetchImpl);
    let keyClubs;
    try {
      keyClubs = await get('/clubs');
    } catch (err) {
      warnings.push(`API key #${i + 1}: ${err.message}`);
      return;
    }
    for (const club of keyClubs) {
      clubs.push({ id: club.id, name: club.name, key: i + 1 });
      for (const t of await get(`/clubs/${club.id}/teams`)) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        // The season label ("... (Fall 2026)") is on the club, not the team.
        clubTeams.push({ ...t, clubName: club.name, get });
      }
    }
  }));
  if (!clubs.length) throw new Error(warnings.join('; ') || 'No clubs found for these API keys');

  if (debug) {
    return {
      clubs,
      teams: clubTeams.map(t => ({ id: t.id, name: t.name, club: t.clubName, league: t.league, division: t.division, createdAt: t.createdAt })),
    };
  }

  const boxCache = new Map();
  const getBox = (team, id) => {
    if (!boxCache.has(id)) boxCache.set(id, team.get(`/matches/${id}/box-score`));
    return boxCache.get(id);
  };

  const divisions = [];
  for (const div of LEAGUE.divisions) {
    const teams = await pool(div.teams, async cfg => {
      const team = pickTeam(cfg, clubTeams, warnings);
      if (!team) return { ...cfg, status: 'missing', games: 0, players: [] };
      try {
        const matches = (await team.get(`/teams/${team.id}/matches`)).filter(m => m.status === 'complete');
        const games = dedupeMatches(matches, team.id);
        const boxes = await pool(games, g => getBox(team, g.match.id).then(box => ({ box, side: g.side })));
        const players = new Map();
        for (const { box, side } of boxes) {
          for (const row of box?.[side]?.players ?? []) {
            const key = norm(row.name);
            if (!key) continue;
            let p = players.get(key);
            if (!p) {
              // Roster entries without a name come through as just the jersey, e.g. "#8".
              const name = /^#?\d+$/.test(row.name.trim()) ? `Unnamed #${row.name.replace('#', '').trim()}` : row.name;
              p = { name, number: row.jerseyNumber ?? '', team: cfg.short, gp: 0 };
              players.set(key, p);
            }
            if (!p.number && row.jerseyNumber) p.number = row.jerseyNumber;
            p.gp += 1;
            for (const [field, k] of Object.entries(FIELDS)) {
              if (typeof row[field] === 'number') p[k] = (p[k] ?? 0) + row[field];
            }
          }
        }
        return { ...cfg, id: team.id, status: 'ok', games: games.length, players: [...players.values()] };
      } catch (err) {
        warnings.push(`${cfg.name}: ${err.message}`);
        return { ...cfg, id: team.id, status: 'error', error: err.message, games: 0, players: [] };
      }
    });

    divisions.push({
      id: div.id,
      name: div.name,
      teams: teams.map(({ players, ...t }) => t),
      players: teams.flatMap(t => t.players),
    });
  }

  return {
    league: LEAGUE.name,
    season: LEAGUE.season,
    updated: new Date().toISOString(),
    warnings,
    divisions,
  };
}
