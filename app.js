// Prodigy League leaderboards.
// Loads season player lines from /api/leaderboard (Superstat API) and renders
// category leaders plus a sortable player table for the chosen division.

const DEMO = new URLSearchParams(location.search).has('demo');
const TOP_N = 5;

// Demo data is a script (sets window.DEMO_DATA) so ?demo also works when opened from disk.
function loadDemo() {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'data/demo.js';
    s.onload = () => resolve(window.DEMO_DATA);
    s.onerror = () => reject(new Error('data/demo.js not found'));
    document.head.appendChild(s);
  });
}

async function loadLive() {
  // Under dev-server.rb there's no serverless function, so build the same data in the
  // browser and send Superstat calls through the local proxy, which adds the key.
  // The page only sees placeholders ("dev:0", "dev:1"…); the proxy swaps in the real key.
  const dev = ['localhost', '127.0.0.1'].includes(location.hostname) &&
    await fetch('/__dev/ping').then(r => (r.ok ? r.json() : null), () => null);
  if (dev) {
    const { buildLeaderboard } = await import('./lib/leaderboard.js');
    const fetchImpl = (url, opts) => fetch(url.replace('https://api.superstatsport.com', '/__dev/superstat'), opts);
    const apiKeys = Array.from({ length: dev.keys ?? 1 }, (_, i) => `dev:${i}`);
    return buildLeaderboard({ apiKeys, fetchImpl });
  }
  // Normal path: stats saved at deploy time (refreshed daily), no Superstat call.
  const saved = await fetch('/data/leaderboard.json').catch(() => null);
  if (saved?.ok) return saved.json();
  const res = await fetch('/api/leaderboard');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

const pct = (m, a) => (a > 0 ? m / a : null);

// kind: 'count' → per game or total depending on mode; 'pct' → same in both modes.
const CATEGORIES = [
  { id: 'pts', label: 'Points', abbr: { pg: 'PPG', tot: 'PTS' }, kind: 'count' },
  { id: 'reb', label: 'Rebounds', abbr: { pg: 'RPG', tot: 'REB' }, kind: 'count' },
  { id: 'ast', label: 'Assists', abbr: { pg: 'APG', tot: 'AST' }, kind: 'count' },
  { id: 'stl', label: 'Steals', abbr: { pg: 'SPG', tot: 'STL' }, kind: 'count' },
  { id: 'blk', label: 'Blocks', abbr: { pg: 'BPG', tot: 'BLK' }, kind: 'count' },
  { id: 'tpm', label: '3-Pointers Made', abbr: { pg: '3PM/G', tot: '3PM' }, kind: 'count' },
  { id: 'fg', label: 'Field Goal %', abbr: { pg: 'FG%', tot: 'FG%' }, kind: 'pct', m: 'fgm', a: 'fga', minPerGame: 2 },
  { id: 'tp', label: '3-Point %', abbr: { pg: '3P%', tot: '3P%' }, kind: 'pct', m: 'tpm', a: 'tpa', minPerGame: 1 },
  { id: 'ft', label: 'Free Throw %', abbr: { pg: 'FT%', tot: 'FT%' }, kind: 'pct', m: 'ftm', a: 'fta', minPerGame: 1 },
  { id: 'oreb', label: 'Offensive Rebounds', abbr: { pg: 'ORPG', tot: 'OREB' }, kind: 'count' },
  { id: 'dreb', label: 'Defensive Rebounds', abbr: { pg: 'DRPG', tot: 'DREB' }, kind: 'count' },
  { id: 'eff', label: 'Efficiency', abbr: { pg: 'EFF/G', tot: 'EFF' }, kind: 'count' },
];

function catValue(cat, p, mode) {
  if (cat.kind === 'pct') return pct(p[cat.m] ?? 0, p[cat.a] ?? 0);
  const v = p[cat.id];
  if (v === undefined) return null;
  return mode === 'pg' ? (p.gp > 0 ? v / p.gp : null) : v;
}

function fmt(cat, v, mode) {
  if (v === null || v === undefined) return '—';
  if (cat.kind === 'pct') return (v * 100).toFixed(1) + '%';
  return mode === 'pg' ? v.toFixed(1) : String(Math.round(v));
}

// ---------- State & rendering ----------

const state = {
  data: null,
  divisionId: null,
  mode: 'pg',
  team: 'all',
  search: '',
  sort: { key: 'pts', dir: -1 },
};

const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const currentDivision = () => state.data.divisions.find(d => d.id === state.divisionId);

function render() {
  const div = currentDivision();
  document.title = `${div.name} Leaderboard · ${state.data.league}`;
  $('#division-name').textContent = `${div.name} Division`;

  renderTeamFilter(div);
  renderStatus(div);

  const players = div.players.filter(p => state.team === 'all' || p.team === state.team);
  const maxGP = Math.max(0, ...players.map(p => p.gp));
  // Qualifying games: half of the most games anyone in view has played.
  const qualGP = Math.max(1, Math.ceil(maxGP * 0.5));
  const minGP = state.mode === 'pg' ? qualGP : 1;

  $('#qual-note').textContent = players.length
    ? (state.mode === 'pg'
      ? `Per-game leaders need at least ${minGP} game${minGP === 1 ? '' : 's'} played. Percentages also need a minimum number of attempts.`
      : `Season totals. Percentage leaders need a minimum number of attempts (based on ${qualGP} game${qualGP === 1 ? '' : 's'}).`)
    : '';

  renderLeaders(players, minGP, qualGP);
  renderTable(players);
}

function renderTeamFilter(div) {
  const sel = $('#team');
  if (sel.dataset.div !== div.id) {
    sel.innerHTML = `<option value="all">All teams</option>` +
      div.teams.map(t => `<option value="${esc(t.short)}">${esc(t.short)}</option>`).join('');
    sel.dataset.div = div.id;
  }
  if (![...sel.options].some(o => o.value === state.team)) state.team = 'all';
  sel.value = state.team;
}

function renderStatus(div) {
  const reporting = div.teams.filter(t => t.status === 'ok' && t.games > 0);
  const pending = div.teams.filter(t => !(t.status === 'ok' && t.games > 0));
  const games = div.teams.reduce((n, t) => n + (t.games || 0), 0);
  let html = `<strong>${reporting.length} of ${div.teams.length}</strong> teams reporting · ${games} team-games`;
  if (pending.length) {
    html += ` · Waiting on ${pending.map(t => {
      const why = t.status === 'missing' ? "Team not found. Is this division's club API key added?"
        : t.status === 'error' ? t.error : 'No completed games yet';
      return `<span class="pending" title="${esc(why)}">${esc(t.short)}</span>`;
    }).join(', ')}`;
  }
  $('#status').innerHTML = html;
}

function renderLeaders(players, minGP, qualGP) {
  const grid = $('#leaders');
  if (!players.length) {
    grid.innerHTML = `<div class="empty"><h3>No stats yet</h3>
      <p>Leaders appear here once games for this division finish processing in Superstat.</p></div>`;
    return;
  }
  const cards = [];
  for (const cat of CATEGORIES) {
    const hasData = players.some(p => cat.kind === 'pct' ? (p[cat.a] ?? 0) > 0 : p[cat.id] !== undefined);
    if (!hasData) continue;
    const ranked = players
      .filter(p => p.gp >= minGP && (cat.kind !== 'pct' || (p[cat.a] ?? 0) >= cat.minPerGame * qualGP))
      .map(p => ({ p, v: catValue(cat, p, state.mode) }))
      .filter(x => x.v !== null)
      .sort((a, b) => b.v - a.v || a.p.name.localeCompare(b.p.name))
      .slice(0, TOP_N);
    if (!ranked.length) continue;
    const [first, ...rest] = ranked;
    const label = cat.kind === 'count' && state.mode === 'pg' ? `${cat.label} per game` : cat.label;
    cards.push(`
      <article class="card">
        <header class="card-head">
          <h3>${esc(label)}</h3>
          <span class="abbr">${esc(cat.abbr[state.mode])}</span>
        </header>
        <div class="leader">
          <div class="rank rank-1">1</div>
          <div class="who">
            <div class="pname">${esc(first.p.name)}</div>
            <div class="pteam">${esc(first.p.team)}${first.p.number ? ` · #${esc(first.p.number)}` : ''}</div>
          </div>
          <div class="big${cat.kind === 'pct' ? ' is-pct' : ''}">${fmt(cat, first.v, state.mode)}</div>
        </div>
        <ol class="runners">
          ${rest.map((x, i) => `
            <li>
              <span class="rank">${i + 2}</span>
              <span class="who"><span class="pname">${esc(x.p.name)}</span><span class="pteam">${esc(x.p.team)}</span></span>
              <span class="val">${fmt(cat, x.v, state.mode)}</span>
            </li>`).join('')}
        </ol>
      </article>`);
  }
  grid.innerHTML = cards.join('') ||
    `<div class="empty"><h3>No qualified players</h3><p>Switch to Totals or pick All teams.</p></div>`;
}

const TABLE_COLS = [
  { key: 'name', label: 'Player', text: true },
  { key: 'team', label: 'Team', text: true },
  { key: 'gp', label: 'GP', raw: true },
  { key: 'min', label: 'MIN' },
  { key: 'pts', label: 'PTS' },
  { key: 'reb', label: 'REB' },
  { key: 'oreb', label: 'OREB' },
  { key: 'dreb', label: 'DREB' },
  { key: 'ast', label: 'AST' },
  { key: 'stl', label: 'STL' },
  { key: 'blk', label: 'BLK' },
  { key: 'tov', label: 'TO' },
  { key: 'pf', label: 'PF' },
  { key: 'fgm', label: 'FGM' },
  { key: 'fga', label: 'FGA' },
  { key: 'fg', label: 'FG%', pct: ['fgm', 'fga'] },
  { key: 'tpm', label: '3PM' },
  { key: 'tpa', label: '3PA' },
  { key: 'tp', label: '3P%', pct: ['tpm', 'tpa'] },
  { key: 'ftm', label: 'FTM' },
  { key: 'fta', label: 'FTA' },
  { key: 'ft', label: 'FT%', pct: ['ftm', 'fta'] },
  { key: 'eff', label: 'EFF' },
];

function colValue(col, p) {
  if (col.text) return p[col.key] ?? '';
  if (col.pct) return pct(p[col.pct[0]] ?? 0, p[col.pct[1]] ?? 0);
  const v = p[col.key];
  if (v === undefined) return null;
  if (col.raw || state.mode === 'tot') return v;
  return p.gp > 0 ? v / p.gp : null;
}

function colFmt(col, v) {
  if (col.text) return esc(v);
  if (v === null) return '—';
  if (col.pct) return (v * 100).toFixed(1);
  if (col.raw || state.mode === 'tot') return String(Math.round(v));
  return v.toFixed(1);
}

function renderTable(players) {
  const cols = TABLE_COLS.filter(c => c.text || c.raw ||
    players.some(p => (c.pct ? (p[c.pct[1]] ?? 0) > 0 : p[c.key] !== undefined)));
  const q = state.search.trim().toLowerCase();
  const rows = players.filter(p => !q || p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q));
  const sortCol = cols.find(c => c.key === state.sort.key) || cols.find(c => c.key === 'pts') || cols[0];
  rows.sort((a, b) => {
    const va = colValue(sortCol, a), vb = colValue(sortCol, b);
    if (sortCol.text) return state.sort.dir * String(va).localeCompare(String(vb));
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return state.sort.dir * (va - vb) || a.name.localeCompare(b.name);
  });

  $('#table-title').textContent = state.mode === 'pg' ? 'All players · per game' : 'All players · totals';
  $('#players thead').innerHTML = `<tr>${cols.map(c => {
    const active = c.key === sortCol.key;
    const aria = active ? (state.sort.dir === 1 ? 'ascending' : 'descending') : 'none';
    return `<th scope="col" class="${c.text ? 'txt' : 'num'}${active ? ' active' : ''}" aria-sort="${aria}">` +
      `<button type="button" data-key="${c.key}">${c.label}${active ? (state.sort.dir === 1 ? ' ▲' : ' ▼') : ''}</button></th>`;
  }).join('')}</tr>`;
  $('#players tbody').innerHTML = rows.length
    ? rows.map(p => `<tr>${cols.map(c => {
        if (c.key === 'name') {
          return `<th scope="row" class="txt">${esc(p.name)}${p.number ? ` <span class="num-badge">#${esc(p.number)}</span>` : ''}</th>`;
        }
        return `<td class="${c.text ? 'txt' : 'num'}${c.key === sortCol.key ? ' active' : ''}">${colFmt(c, colValue(c, p))}</td>`;
      }).join('')}</tr>`).join('')
    : `<tr><td colspan="${cols.length}" class="none">No players to show.</td></tr>`;
}

// ---------- Wiring ----------

function setDivision(id, updateHash = true) {
  state.divisionId = id;
  state.team = 'all';
  $('#division').value = id;
  if (updateHash) history.replaceState(null, '', `${location.search}#${id}`);
  try { localStorage.setItem('pl-division', id); } catch {}
  render();
}

function showFatal(title, detail) {
  $('#leaders').innerHTML = `<div class="empty"><h3>${esc(title)}</h3><p>${esc(detail)}</p></div>`;
  $('#board').setAttribute('aria-busy', 'false');
}

async function init() {
  if (DEMO) $('#demo-banner').hidden = false;
  $('#leaders').innerHTML = Array.from({ length: 6 }, () => '<div class="card skeleton"></div>').join('');

  try {
    state.data = DEMO ? await loadDemo() : await loadLive();
  } catch (err) {
    showFatal("Couldn't load stats", err.message);
    return;
  }
  $('#board').setAttribute('aria-busy', 'false');
  if (state.data.warnings?.length) console.warn('Leaderboard warnings:\n' + state.data.warnings.join('\n'));

  $('#season').textContent = state.data.season;
  const updated = new Date(state.data.updated);
  if (!Number.isNaN(+updated)) {
    $('#updated').textContent = `Updated ${updated.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
  }

  const ids = state.data.divisions.map(d => d.id);
  $('#division').innerHTML = state.data.divisions
    .map(d => `<option value="${esc(d.id)}">${esc(d.name)} Division</option>`).join('');

  let saved = null;
  try { saved = localStorage.getItem('pl-division'); } catch {}
  const fromHash = location.hash.slice(1).toLowerCase();
  const initial = ids.includes(fromHash) ? fromHash : ids.includes(saved) ? saved : ids[0];

  $('#division').addEventListener('change', e => setDivision(e.target.value));
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1).toLowerCase();
    if (ids.includes(id) && id !== state.divisionId) setDivision(id, false);
  });
  $('#team').addEventListener('change', e => { state.team = e.target.value; render(); });
  document.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => {
    state.mode = btn.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    render();
  }));
  $('#search').addEventListener('input', e => { state.search = e.target.value; render(); });
  $('#players thead').addEventListener('click', e => {
    const btn = e.target.closest('button[data-key]');
    if (!btn) return;
    const key = btn.dataset.key;
    const isText = key === 'name' || key === 'team';
    state.sort = state.sort.key === key ? { key, dir: -state.sort.dir } : { key, dir: isText ? 1 : -1 };
    render();
  });

  setDivision(initial, !fromHash);
}

init();
